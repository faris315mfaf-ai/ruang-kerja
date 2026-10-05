# Sprint 3 — Ringkasan: QR dinamis, tinjauan HR, rekap & ekspor

Cabang `feat/sprint-3-qr-rekap`. Dibangun di atas Sprint 2 (absensi inti) dan sudah di-merge dengan `main` (Sprint 4 pengajuan, perbaikan Sprint 1, Sprint 5/6/7/8/10).

## Acceptance criteria (docs/PROMPTS.md Sprint 3)

| Kriteria | Status | Bukti |
|---|---|---|
| Akun & halaman kiosk `/kiosk/{location}`: layar penuh, QR berganti tiap 30 dtk (HMAC(ATTENDANCE_QR_SECRET, location_id\|window)), jam besar, nama lokasi, tanpa navigasi | ✓ | `pages/kiosk/show.tsx` (mockup Kiosk), `QrCodeService`, `KioskScreen`, `GET /kiosk/{location}/kode` dipanggil tepat setelah tiap jendela |
| Akun kiosk hanya bisa membuka halaman ini | ✓ | Guard `kiosk` + `RestrictKioskDevice` (prioritas sebelum `auth`) + `AuthenticateKiosk`; `KioskTest` (11 URL → redirect ke kiosk, JSON → 403, lokasi lain → 403, nonaktif/dihapus/dipasang ulang → keluar) |
| Tab "Pindai QR" di dialog check-in (`@zxing/browser`), validasi HMAC & jendela ±1 di server, method = qr, GPS tetap direkam bila diizinkan | ✓ | `MethodSwitch` aktif, `flow/qr-scan.tsx`, `POST /absensi/check-in/qr` & `/check-out/qr` (`throttle:check-in`), `QrLocationVerifier`; `QrCheckInTest` 23 kasus |
| HR › Absensi Hari Ini: hadir/terlambat/belum/cuti per divisi, realtime Echo, filter, panel log mencurigakan + "Tandai sudah ditinjau" | ✓ | `/absensi/hari-ini` (DashboardHR/MDashboardHR): kartu, tabel per divisi + bilah distribusi, daftar per orang (filter status/divisi/nama), filter lokasi, "Perlu ditinjau", "Lupa check-out kemarin"; Echo `company.attendance` / `division.{id}.attendance` + polling 60 dtk; `AttendanceBoardTest` |
| Melihat selfie: hanya HR & atasan langsung, URL bertanda tangan 5 menit, setiap akses masuk audit_logs | ✓ | Policy `viewSelfie` tetap; **setiap** akses (juga pemilik) → `selfie.viewed` (`own` true/false); URL diminta saat klik (`GET absensi/log/{log}/selfie-url`); test Kadiv divisi lain ditolak + audit 3 akses |
| Koreksi manual oleh HR (method manual, wajib alasan, audit) | ✓ | `CorrectAttendance` + dialog Koreksi (papan & rekap); log baru `manual` dengan `corrected_by` & alasan, status dihitung ulang, `attendance.corrected` (nilai lama/baru); `AttendanceCorrectionTest` |
| Rekap bulanan per karyawan (hari kerja, hadir, terlambat kali & menit, alpha, cuti, izin, sakit, dinas, lembur jam) | ✓ | `MonthlyRecap` + `ScheduleResolver::forRange()`; `/absensi/rekap` (mockup RekapAbsensi) dengan panel detail kalender; `MonthlyRecapTest` (angka cocok data uji) |
| Ekspor Excel (maatwebsite/excel) & PDF (dompdf), kolom diatur di `config/payroll_export.php` | ✓ | `PayrollRecapExport`, `RecapPdf`, `PayrollColumn` (22 kolom tersedia); audit `attendance.exported`; `AttendanceRecapPageTest` |
| Halaman "Absensi Saya" rekap pribadi per bulan | ✓ | `/absensi/riwayat`: mobile = MRiwayatAbsensi (navigasi bulan, 4 kartu, kalender bulat, legenda, detail hari, Ajukan koreksi, Unduh rekap PDF), desktop = panel detail RekapAbsensi + detail hari |
| Job bulanan hapus selfie > ATTENDANCE_SELFIE_RETENTION_MONTHS | ✓ | `PurgeExpiredSelfiesJob` (tgl 1, 02.30 WIB) + `attendance:purge-selfies`; `SelfieRetentionTest` |
| Test: QR kedaluwarsa ditolak, HMAC palsu ditolak, kiosk tidak bisa membuka halaman lain, Kadiv tidak bisa melihat selfie divisi lain, akses selfie tercatat, angka rekap cocok | ✓ | `QrCheckInTest`, `KioskTest`, `SelfieAccessTest`, `MonthlyRecapTest`, `AttendanceRecapPageTest` |

Jumlah test: **1431 Pest** hijau setelah merge `main` (238 di `tests/Feature/Attendance`, 75 baru untuk Sprint 3), **209 Vitest**. `composer lint`, `npm run typecheck`, `npm run lint` hijau. Catatan: `composer test` paralel di mesin bersama sempat gagal dengan `out of shared memory` dari Postgres (lock table penuh karena banyak agent); suite yang sama dijalankan berurutan (`pest`, memory_limit 2G) seluruhnya hijau.

## Cara uji manual (https://ruangkerja.test, `php artisan migrate:fresh --seed`)

Seeder membuat kiosk **Lobi (KP-LOBI)** di Kantor Pusat dan, di lingkungan `local`, mencetak tautan aktivasi sekali pakai di output seeder.

1. **Kiosk** — buka tautan aktivasi dari output seeder (sebaiknya di jendela penyamaran/perangkat lain, karena browser itu akan dikunci sebagai kiosk) → "Aktifkan kiosk" → layar QR. Coba buka `/dashboard` di browser itu: kembali ke layar kiosk. Tautan baru dibuat HR di **Admin › Lokasi & shift › Kiosk QR › Tautan aktivasi**; menonaktifkan kiosk mengeluarkan perangkat dalam ≤ 30 dtk.
2. **Pindai QR** — **anggota@demo.test** (ponsel/HTTPS) → Absen → pilih **Pindai QR** → "Pindai QR & check-in" → arahkan kamera ke layar kiosk. Kode lama > 60 dtk ditolak "Kode QR sudah kedaluwarsa".
3. **hr@demo.test** → **Absensi hari ini** (sidebar Admin / menu mobile): kartu, per divisi, perlu ditinjau (14 log seeder ditandai), "Tandai ditinjau", daftar per orang + Koreksi, lupa check-out kemarin. Realtime bila Reverb jalan (pil "Langsung"), selain itu polling 60 dtk.
4. **Rekap absensi** (desktop) → pilih bulan/divisi/cari → klik baris → panel kalender, log mencurigakan, "Lihat N log absensi", "Koreksi absensi" → **Ekspor Excel / PDF**.
5. **Absensi saya** → Absen › 5 hari kerja terakhir › **Riwayat** (atau Menu › Riwayat absensi) → navigasi bulan, pilih tanggal, **Unduh rekap (PDF)**.
6. Retensi: `php artisan attendance:purge-selfies`.
7. Lihat selfie hanya muncul untuk log yang punya selfie (check-in GPS sungguhan); log dari seeder tidak punya berkas selfie.

## Keputusan

1. **Kiosk = tabel `kiosks` + guard sesi `kiosk`, bukan peran/baris `users`.** Akun perangkat bukan karyawan; di `users` ia akan muncul di daftar karyawan, scope `visibleTo`, tutup hari, pengingat, pencarian, dan modul paralel lain. Provider memakai driver kustom `kiosk-devices` (AttendanceServiceProvider) agar Larastan tetap menganggap `$request->user()` = `User` (dengan `model` di config, semua `$request->user()` di proyek menjadi `User|Kiosk`).
2. Login kiosk lewat **tautan aktivasi sekali pakai** (hash SHA-256, 24 jam; GET hanya konfirmasi agar pratinjau tautan tidak memakainya) → remember cookie. Pemasangan ulang memutus perangkat lama (`activated_at` di sesi + rotasi `remember_token`).
3. `RestrictKioskDevice` ditaruh di grup web **dan** di daftar prioritas sebelum `AuthenticatesRequests` (Laravel menaikkan `auth` di atas middleware grup yang di-append). Rute kiosk memakai `AuthenticateKiosk` (bukan `auth:kiosk`) supaya guard default tidak berganti.
4. Validasi QR: HMAC → jendela ±1 → kode **benar-benar ditampilkan** kiosk aktif (`qr_tokens`) → lokasi kiosk termasuk lokasi yang diizinkan shift karyawan (aturan sama dengan GPS). Tanda tangan dipotong 128 bit (32 hex) agar QR lebih renggang. Rahasia kosong diturunkan dari `APP_KEY` (produksi wajib mengisi `ATTENDANCE_QR_SECRET`).
5. QR memakai `CheckIn`/`CheckOut` yang sama (parameter `CheckInData|QrCheckInData`, `PresenceVerifier`): tanpa selfie, persetujuan data tetap wajib, GPS opsional; GPS jauh dari kiosk → flag `qr_location_mismatch` (menandai, tidak memblokir). QR juga dipakai untuk check-out.
6. "Baru saja check-in" di kiosk diambil bersama kode (polling 30 dtk), hanya nama depan + inisial.
7. Papan & rekap terbuka untuk HR/Direksi/Super Admin (seluruh perusahaan) dan siapa pun yang memimpin divisi atau punya bawahan langsung (cakupan `visibleTo`). "Tandai ditinjau" & koreksi: `attendance.manage` (HR, Super Admin), **tidak untuk absensi sendiri**. Ekspor: `attendance.export`.
8. Rekap: periode = bulan, bulan berjalan dihitung s.d. hari ini. Hari kerja = tanggal yang jadwalnya hari kerja (`ScheduleResolver`). Hadir = present/late/early_leave/wfh + perlu koreksi yang sudah check-in (terlambat termasuk Hadir). Alpha/cuti/izin/sakit/dinas = `attendance_days.status`; lembur = `overtime_minutes`. Rata-rata kehadiran = hadir ÷ (hari kerja − cuti/izin/sakit/dinas). Karyawan tanpa jadwal & tanpa catatan (mis. Direksi) tidak ditampilkan. Kartu "Hari kerja" = Senin–Jumat bulan itu dikurangi hari libur.
9. `ScheduleResolver::forRange()` (3 query untuk banyak karyawan × banyak tanggal) diuji setara dengan `forDate()` untuk setiap tanggal.
10. Koreksi manual: jam waktu kantor; jam pulang ≤ jam masuk = esok hari; hari lampau tanpa jam pulang tetap "Perlu koreksi"; hari berstatus dari pengajuan ditolak (ubah lewat pengajuan).
11. Setiap akses gambar selfie diaudit, termasuk pemilik (halaman Absensi & layar sukses memuat selfie sendiri → baris audit `own: true`). Membuat URL bertanda tangan tidak diaudit; mengakses gambarnya iya.
12. `attendance_logs.selfie_path` boleh diubah hanya menjadi null oleh job retensi; log tetap ada.
13. Kode QR yang tidak pernah dipindai dihapus harian setelah 2 hari (≈2.880 baris/kiosk/hari).
14. Warna QR memakai token baru `--qr-ink`/`--qr-paper` (sama di terang & gelap, demi kontras pemindai). Sakit di kalender memakai warna brand (token) karena tidak ada token ungu; legenda selalu menamai warnanya.
15. Rekap & ekspor hanya desktop (mobile: banner "Fitur ini tersedia di desktop." / tautan "Rekap & ekspor bulanan tersedia di desktop").
16. PDF memakai warna abu-abu hex di template Blade (dompdf tidak membaca CSS variable).

## Paket baru

- `barryvdh/laravel-dompdf` 3.1 — PDF rekap dari Blade, PHP murni (tanpa Chrome/Node di server), jalan di Herd Windows/macOS dan image Docker produksi.
- `bacon/bacon-qr-code` ^3 — sudah ter-install sebagai dependensi Fortify; kini diminta eksplisit karena dipakai langsung untuk SVG QR kiosk.
- `@zxing/browser` + `@zxing/library` — pemindai QR headless memakai `<video>` dan hook kamera yang sudah ada (tampilan mengikuti mockup), aktif dipelihara, bertipe TypeScript, dimuat lazy saat tab Pindai QR dibuka. `html5-qrcode` tidak dipilih: membawa UI sendiri dan tidak dirilis lagi sejak 2023.
- `maatwebsite/excel` sudah ada.

## Sisa pekerjaan / catatan

- Pemindaian kamera sungguhan belum bisa diuji otomatis (panel browser memblokir kamera); alur server diuji penuh oleh Pest, tampilan kiosk/papan/rekap/riwayat dicek di browser (desktop & 375 px, terang & gelap).
- Realtime papan butuh Reverb berjalan; tanpa itu otomatis polling 60 dtk.
- Kiosk yang sedang dibuka di browser HR saat uji coba akan mengunci browser itu sampai kiosk dinonaktifkan/dihapus (sengaja); gunakan jendela penyamaran.
- `companies.settings` (retensi selfie per perusahaan) belum dibaca; retensi masih dari env.
- Test `EmployeeManagementTest › … server-side search` (Sprint 1) sesekali merah: nama acak faker pengguna HR bisa mengandung "agus". Bukan dari slice ini; perbaikannya memberi nama tetap pada HR di test itu.
