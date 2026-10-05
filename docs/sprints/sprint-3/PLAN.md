# Sprint 3 — Rencana: QR dinamis, tinjauan HR, rekap & ekspor

Acuan: `docs/PROMPTS.md` blok Sprint 3 (acceptance criteria), `docs/PRD.md` M2, `docs/ARCHITECTURE.md` §3.2, §4, §5, `docs/DATABASE.md` §2 (`qr_tokens`), Sprint 2 (`docs/sprints/sprint-2/{PLAN,SUMMARY}.md`), mockup `Kiosk`, `RekapAbsensi`, `MRiwayatAbsensi`, `DashboardHR`/`MDashboardHR` (bagian absensi hari ini), `Absensi` (tab QR).

Dibangun di atas Sprint 2: `ScheduleResolver`, `LocationVerifier`, `FraudDetector`, `AttendanceLogWriter`, `CheckIn`/`CheckOut`, rute & policy selfie, `AuditLogger`.

## 1. Akun kiosk & halaman `/kiosk/{location}`

**Keputusan: kiosk = akun perangkat di tabel `kiosks` dengan guard sesi `kiosk` sendiri, bukan baris `users`.**
Alasan: akun kiosk bukan karyawan; menaruhnya di `users` berarti setiap daftar karyawan, scope `visibleTo`, tutup hari, pengingat, pencarian, dan modul sprint lain (dibangun paralel) harus mengecualikannya. Dengan guard terpisah, sesi kiosk secara struktural tidak lolos middleware `auth` (guard `web`), dan middleware `RestrictKioskDevice` di grup `web` memaksa perangkat kiosk kembali ke halamannya untuk rute apa pun.

| Bagian | Berkas |
|---|---|
| Tabel | `kiosks` (`company_id`, `office_location_id`, `name`, `code`, `is_active`, `activation_token_hash`, `activation_expires_at`, `activated_at`, `last_seen_at`, `remember_token`, soft delete) |
| Guard | `config/auth.php` guard `kiosk` (session) + provider `kiosks` |
| Aktivasi | HR membuat kiosk di Admin › Lokasi & shift → tautan aktivasi sekali pakai (24 jam, hash SHA-256 di DB). Perangkat membuka tautan → konfirmasi (POST) → login guard `kiosk` dengan remember-cookie. Tautan baru/nonaktifkan memutus perangkat lama (`activated_at` di sesi + rotasi `remember_token`) |
| Middleware | `RestrictKioskDevice` (grup web): sesi kiosk hanya boleh rute `kiosk.*`; lainnya → redirect ke `/kiosk/{location}` (JSON: 403). `EnsureKioskIsActive` di rute kiosk |
| Halaman | `pages/kiosk/show.tsx` tanpa AppLayout: jam besar, tanggal, nama lokasi · kiosk, QR (SVG dari server, `bacon/bacon-qr-code`, koreksi galat H + logo), bilah hitung mundur, kode kiosk, langkah 1-2-3, "Baru saja check-in" (nama depan + inisial, polling bersama kode) |
| Kode | `GET /kiosk/{location}/kode` (JSON) → payload `ruangkerja://checkin?l={location}&w={window}&s={HMAC}`; mencatat `qr_tokens` (upsert per jendela, `kiosk_id`) |

## 2. QR dinamis & check-in QR

- `QrCodeService`: `window = floor(unix / 30)`, `s = HMAC-SHA256(ATTENDANCE_QR_SECRET, "{location_id}|{window}")` (hex). Rahasia kosong → diturunkan dari `APP_KEY` (dicatat di SUMMARY; produksi wajib mengisi).
- Validasi server: format → `hash_equals` HMAC → jendela `|w − now| ≤ 1` → token pernah ditampilkan kiosk aktif (baris `qr_tokens`) → lokasi QR termasuk lokasi yang diizinkan untuk shift karyawan.
- `CheckIn`/`CheckOut` menerima `CheckInData|QrCheckInData` (satu `handle()`), method `qr`, tanpa selfie, `qr_token_id` terisi, GPS direkam bila dikirim. Flag baru `qr_location_mismatch` bila GPS jauh dari lokasi QR (menandai, tidak memblokir).
- Rute `POST absensi/check-in/qr`, `absensi/check-out/qr` dengan `throttle:check-in`.
- Frontend: `MethodSwitch` aktif (GPS + Selfie | Pindai QR); langkah `scan` di dialog/layar penuh memakai kamera belakang + `@zxing/browser` (dimuat lazy).

**Pustaka pemindai: `@zxing/browser`** (+ `@zxing/library`). Headless (memakai `<video>` dan hook kamera yang sudah ada, tampilan tetap mengikuti mockup), aktif dipelihara, TypeScript. `html5-qrcode` membawa UI sendiri dan tidak dirilis lagi sejak 2023.

## 3. HR › Absensi hari ini (`/absensi/hari-ini`)

- Kartu: Terjadwal, Hadir (termasuk terlambat), Cuti/izin/sakit, Belum check-in. Tabel per divisi dengan bilah distribusi. Daftar per orang dengan filter (lokasi, divisi, status, cari nama).
- Panel "Perlu ditinjau": log `is_suspicious` belum ditinjau (lingkup `visibleTo`), badge flag, "Lihat selfie" (bila policy mengizinkan; URL bertanda tangan diminta saat klik), "Tandai ditinjau" (`attendance.manage`, audit `attendance.log_reviewed`).
- Panel "Lupa check-out kemarin" dengan tombol Koreksi.
- Realtime: Echo `company.attendance` (atau `division.{id}.attendance` untuk Kadiv) → partial reload; fallback polling 60 detik.
- Akses: `attendance.view_all` atau memimpin divisi/punya bawahan langsung (data lewat `AttendanceDay::visibleTo`).

## 4. Selfie, koreksi manual

- `AttendanceLogPolicy::viewSelfie` tetap: pemilik, HR (`attendance.view_selfie`), atasan langsung. **Setiap** akses (termasuk pemilik) dicatat `selfie.viewed`. Test eksplisit: Kadiv divisi lain ditolak.
- `GET absensi/log/{log}/selfie-url` (JSON) membuat URL bertanda tangan 5 menit saat diklik.
- `CorrectAttendance` (HR, `attendance.manage`, bukan absensi sendiri): jam masuk/pulang (waktu kantor), alasan wajib → log baru `method = manual`, `corrected_by`, `note = alasan`; hitung ulang status/terlambat/pulang cepat/jam kerja; audit `attendance.corrected` (nilai lama/baru). Hari berstatus dari pengajuan tidak bisa dikoreksi di sini.

## 5. Rekap bulanan & ekspor

- `MonthlyRecap` (service): periode = bulan (bulan berjalan s.d. hari ini). Jadwal dari `ScheduleResolver::forRange()` (baru; memuat penugasan & libur sekali, aturan sama dengan `forDate()`, diuji setara).
- Per karyawan: hari kerja, hadir (present/late/early_leave/wfh + perlu koreksi yang sudah check-in), terlambat kali & menit, alpha, cuti, izin, sakit, dinas, lembur (jam, dari `overtime_minutes`), pulang cepat, WFH, perlu koreksi, rata-rata jam masuk. Cuti/izin/sakit/dinas/lembur terisi otomatis begitu Sprint 4 menulis status & `overtime_minutes`.
- Halaman `/absensi/rekap` (desktop; mobile: banner "Rekap & ekspor bulanan tersedia di desktop"): filter bulan/divisi/cari, kartu ringkasan, tabel (@tanstack/react-table) + panel detail karyawan (kalender, statistik, log mencurigakan, daftar log, Koreksi absensi).
- Ekspor `GET /absensi/rekap/ekspor/{xlsx|pdf}` (`attendance.export`): Excel `maatwebsite/excel`, PDF `barryvdh/laravel-dompdf`; kolom & urutan di `config/payroll_export.php`. Audit `attendance.exported`.

**Paket PDF: `barryvdh/laravel-dompdf`** — PHP murni (tanpa Chrome/Node di server), jalan di Herd Windows, macOS, dan image Docker produksi tanpa dependensi sistem; cukup untuk tabel rekap.

## 6. Absensi Saya (`/absensi/riwayat`)

Rekap pribadi per bulan: desktop = panel seperti detail RekapAbsensi + daftar hari; mobile = mockup `MRiwayatAbsensi` (navigasi bulan, 4 kartu, kalender bulat, legenda, detail hari terpilih: Masuk/Pulang, tombol "Ajukan koreksi" → `/pengajuan`, "Unduh rekap (PDF)").

## 7. Retensi selfie

Job `PurgeExpiredSelfies` bulanan (tanggal 1, 02:30 WIB) + perintah `attendance:purge-selfies`: hapus berkas selfie yang `occurred_at` lebih tua dari `ATTENDANCE_SELFIE_RETENTION_MONTHS`, kosongkan `selfie_path` (satu-satunya kolom log yang boleh berubah selain tinjauan, hanya menjadi null). Token QR yang tidak dipakai dan berumur > 2 hari ikut dibersihkan setiap hari (`attendance:prune-qr-tokens`).

## Navigasi

`navigation.ts`: "Absensi hari ini" & "Rekap absensi" (HR, Super Admin, Direksi, Kadiv; rekap desktop-only), "Riwayat absensi" untuk semua (menu mobile). Kartu "5 hari kerja terakhir › Riwayat" menaut ke `/absensi/riwayat`.

## Test (Pest)

QR: payload valid, kedaluwarsa (w−2) ditolak, HMAC palsu ditolak, jendela masa depan ditolak, token tak pernah ditampilkan ditolak, lokasi lain ditolak, GPS direkam, flag mismatch, check-out QR. Kiosk: aktivasi sekali pakai/kedaluwarsa, tidak bisa membuka halaman lain (dashboard, absensi, admin, JSON, login), lokasi lain 403, nonaktif memutus sesi, tautan baru memutus perangkat lama. Selfie: Kadiv divisi lain ditolak, semua akses diaudit. Koreksi: validasi alasan, hitung ulang, audit, policy matriks. Rekap: angka cocok dengan data uji (status campuran, libur, lembur), `forRange` ≡ `forDate`. Ekspor xlsx/pdf + kolom config + izin. Papan hari ini: agregat & tinjau. Retensi: berkas lama terhapus, baru tetap. Vitest: parser payload QR, helper rekap/kalender.

## Risiko

- Sprint 4 paralel menulis `attendance_days` (status cuti dll., `overtime_minutes`, `request_id`); rekap hanya membaca kolom yang sudah ada.
- Kamera belakang & pemindaian butuh HTTPS (Herd `https://ruangkerja.test` sudah).
- CSP: SVG QR dirender inline dari server (tanpa skrip eksternal).
