# Sprint 10 — Bagian B (privasi, kinerja, polesan integrasi) · Ringkasan

Cabang `feat/sprint-10-privasi`, sudah di-merge dengan `main` (termasuk Sprint 6 dan perbaikan review Sprint 2/4/5). Rencana: [`PRIVASI-PLAN.md`](PRIVASI-PLAN.md). Bagian A (platform/ops): [`SUMMARY.md`](SUMMARY.md).

## Acceptance criteria

| # | Kriteria | Status |
|---|---|---|
| 2 | Halaman "Data Saya" `/privasi`: lihat & ekspor (Excel + PDF) absensi pribadi, riwayat pengajuan & keputusan persetujuan, data profil (NIK tersamar), status persetujuan + versi kebijakan | ✓ `PrivacyController` + `App\Domain\Privacy` (`MyData`, `ExportMyData`, `MyDataSections`); ekspor berisi **semua** data (6 sheet/tabel: Profil, Persetujuan data, Absensi harian, Log absensi termasuk koordinat/IP/perangkat tanpa gambar selfie, Pengajuan saya, Keputusan saya), diaudit `privacy.data_exported`. Desktop (kolom samping kanan, tabel) + ponsel (satu kolom, daftar), terang/gelap dicek di browser |
| 2 | Cabut persetujuan menonaktifkan check-in GPS/selfie + memberi tahu HR | ✓ `RevokeAttendanceConsent` (mekanisme Sprint 2) kini mengirim `ConsentRevokedNotification` (type `attendance.consent_revoked`, baris pengaturan `system` — in-app terkunci) ke HR aktif perusahaan yang sama; idempoten (tanpa notifikasi ganda). Dari Data Saya juga bisa "Berikan persetujuan" lagi |
| 2 | Kebijakan privasi berversi | ✓ `config/privacy.php` (`PRIVACY_POLICY_VERSION`, `PRIVACY_POLICY_DATE`, `PRIVACY_CONTACT`) + Markdown Indonesia `resources/markdown/privacy-policy.md` (placeholder `{{perusahaan}}`, `{{retensi_selfie_bulan}}`, `{{kontak}}`, …; komentar editor dibuang, HTML mentah di-escape, tautan `javascript:` diblokir). Halaman publik `/kebijakan-privasi` (ditaut dari login; di dalam shell bila login). Versi persetujuan absensi mengikuti versi kebijakan → naik versi = semua menyetujui ulang |
| 2 | Uji: hanya data sendiri, alur cabut, HR diberi tahu, isi ekspor | ✓ `tests/Feature/Privacy/*` (14 test): data sendiri vs approver, NIK mentah tidak pernah terkirim, persetujuan ulang setelah versi naik, tamu/nonaktif ditolak, isi Excel per sheet tanpa baris orang lain, PDF, audit, format tak dikenal 404, cabut → check-in ditolak + HR (bukan HR nonaktif/perusahaan lain) diberi tahu sekali, kebijakan publik/escape |
| 3 | Sapuan N+1 semua halaman utama + uji regresi jumlah query | ✓ `tests/Feature/Performance/PageQueryCountTest.php`: 40 halaman (dashboard ×3, portofolio, absensi ×6, pengajuan/persetujuan ×7, workspace/board/list/kalender/dokumen/file/aktivitas/pengaturan/ringkasan, tugas saya, inbox, feed, cari, pengaturan notifikasi, menu, admin karyawan/organisasi/audit, struktur, Data Saya). Data demo + `PerformanceFixtures::grow()` (±40 karyawan × 3 minggu, pengajuan menunggu, tugas berlabel/penugas, notifikasi, log mencurigakan, file, tim, workspace, audit, milestone/risiko/update) **dua kali** → jumlah query tidak boleh naik (N+1) dan tidak melewati anggaran. Hasil: **tidak ada N+1** di halaman mana pun (strict mode Sprint 10A sudah menutup lazy loading); yang ditemukan & diperbaiki: halaman Audit 500 untuk entri bersubjek User di strict mode, `MyData` kini memuat salinan user sendiri |
| 3 | Indeks sesuai DATABASE.md | ✓ Semua indeks yang didokumentasikan ada. Audit FK/pola query → migrasi `2026_10_07_100000_add_performance_indexes`: `tasks (status_id, position)` (pindah kartu/ubah/hapus kolom mencari per status tanpa workspace), parsial `request_approvals (delegated_from_id)` (visibilitas "penyetuju ATAU pemberi delegasi"), parsial `attachments (drive_file_id)` ("Dipakai di tugas"). Rollback diuji. DATABASE.md diperbarui |
| 3 | Lighthouse ≥ 90 halaman Absensi di ponsel | ✓ lihat tabel di bawah: kondisi mirip produksi **98 / 100 / 93 / 100**; HTTP/1.1 tanpa HTTP/2 **89–93** |
| — | `throttle:check-in` di route check-in/out (catatan bagian A) | ✓ sudah terpasang di GPS & QR (`routes/attendance.php`) |
| 4a | Once-prop `attendanceStatus` tetap `null` setelah login | ✓ dikunci per user (`->as('attendanceStatus:'.$userId)`): klien tidak lagi melewatkannya setelah login; tambalan reload di Dashboard Saya dihapus; test header `X-Inertia-Except-Once-Props` |
| 4b | Dashboard HR: "Tandai ditinjau" & "Koreksi" | ✓ `ReviewList` (`ReviewButton`, endpoint Sprint 3) dan `MissingCheckOutList` (`CorrectionDialog`, jam masuk terisi); tombol hanya bila `can_review` / `can_correct` (Policy) — Direksi melihat baca-saja; test |
| 4c | Ringkasan harian tidak menggandakan persetujuan | ✓ `InboxActionSection` melewati type yang punya seksi kaya (`notifications.digest.inbox_section_excludes`: `task.overdue`, `request.submitted`; digabung dengan versi Sprint 6 di `main`); test isi ringkasan |
| 4d | Provider ⌘K Pengajuan | ✓ `RequestSearchProvider` (grup "Pengajuan", `config/search.php`): milik sendiri → `/pengajuan/{id}`, menunggu keputusan → `/persetujuan/{id}`, di dalam `EmployeeRequest::visibleTo`; palet ⌘K kini menampilkan nomor panjang tanpa terpotong; test |
| 4e | Widget Direksi "belum check-in" | ✓ `PortfolioDashboard::attendance()` memakai `TodayAttendance` (bulk `ScheduleSnapshot`): total = terjadwal hari ini, angka sama dengan Dashboard HR; test (akhir pekan = 0) |
| 4f | Balapan kode divisi/tim/unit Direksi → galat validasi, bukan 500 | ✓ `UniqueViolations::asValidation()` di `SaveDivision`, `SaveTeam`, `RestoreDivision`, `RestoreTeam`; test |
| 4g | Koreksi HR di hari setengah-cuti/dinas | ✓ `CorrectAttendance` hanya menolak cuti/izin/sakit **sehari penuh**; setengah hari & dinas bisa dikoreksi (mis. lupa check-out), status permintaan & `request_id` tetap, tanpa menit terlambat/pulang cepat (sama dengan CheckIn/CheckOut); test |
| 4h | Dashboard Sprint 9 menghitung setengah-cuti/dinas yang check-in sebagai hadir | ✓ `TodayAttendance` (Dashboard HR, Divisi, widget Direksi) & `PersonalDashboard` (hari kerja + hadir); cuti sehari penuh tetap "cuti"; test |
| 5 | README/docs | ✓ README (§Privasi, §Kinerja, CSP), ARCHITECTURE §5, DATABASE (indeks, versi persetujuan), HOW-TO-NOTIFY (type baru, digest, provider), `.env.example`, `.env.production.example`, catatan sisa sprint lama ditandai selesai |

## Lighthouse — halaman Absensi, ponsel (Moto G Power teremulasi, 4G lambat tersimulasi)

| Kondisi | Kinerja | Aksesibilitas | Best practices | SEO |
|---|---|---|---|---|
| Sebelum · `php artisan serve` mentah (tanpa gzip) | 59 | 100 | 93 | 91 |
| Sebelum · HTTP/1.1 + gzip | 82 | 100 | 93 | 91 |
| Sebelum · HTTPS + HTTP/2 + gzip (≈ produksi) | 95–96 | 100 | 93 | 91 |
| Sebelum, bila tile peta tidak diblokir CSP (lihat temuan) · HTTP/1.1 + gzip | 69 | 100 | 89 | 100 |
| **Sesudah · HTTP/1.1 + gzip** | **89–93** | 100 | 93 | 100 |
| **Sesudah · HTTPS + HTTP/2 + gzip (≈ produksi)** | **98** (FCP 1,6 s · LCP 2,1 s · TBT 0 · CLS 0,002) | **100** | **93** | **100** |

Cara ukur (`scripts/lighthouse-absensi.sh`, langkah di kepala skrip): `npm run build`; `PHP_CLI_SERVER_WORKERS=4 php artisan serve --port=8795`; `node scripts/lighthouse-proxy.mjs 8797 8795 cert.pem key.pem` (sertifikat self-signed sekali pakai) meniru produksi — HTTPS + HTTP/2 (Caddy), gzip (`encode`), cache `immutable` untuk `/build/assets` (docker/app/Caddyfile); login demo `anggota@demo.test` lewat `POST /login/demo` → cookie sesi dikirim Lighthouse via `--extra-headers`; `npx lighthouse@12` (tidak dipasang sebagai dependensi). Mesin dipakai bersama ±10 agen, jadi skor HTTP/1.1 berfluktuasi ±3.

Best practices 93 di lokal **hanya** karena Reverb tidak berjalan (galat konsol `ERR_CONNECTION_REFUSED` WebSocket dan skema `wss` vs `VITE_REVERB_SCHEME` lokal) — di produksi Reverb aktif dan CSP memuat origin `wss` yang sama.

Perubahan kinerja:
- **Mini-map kartu Absensi = sketsa SVG** (`map/geofence-sketch.tsx`, `sketchLayout()` di `lib/geo.ts` + Vitest): grid, radius geofence, titik kantor, "Anda di sini" — persis gaya mockup Absensi, tanpa Leaflet (±45 kB gz) dan tanpa tile OSM (yang menjadi elemen LCP 6,7 s). Peta OSM asli tetap di layar gagal check-in (dimuat saat idle) & pengaturan lokasi.
- **Shell desktop dipecah** (`layouts/app-layout.tsx`: `DesktopLayout` lazy, langsung di-prefetch di layar ≥ 768 px) → ponsel tidak mengunduh sidebar/topbar/menu.
- **Palet ⌘K (cmdk) dimuat saat pertama dibuka**; `Tooltip` membawa provider sendiri (Radix tooltip + floating-ui keluar dari bundel awal).
- Tidak ada tiptap/recharts/zxing/leaflet/dnd-kit di jalur Absensi (diverifikasi dari daftar request Lighthouse). Bundel awal app 558 → 514 kB (±156 kB gz).
- `<meta name="description">` (SEO 91 → 100).

## Temuan & perbaikan di luar daftar
- **CSP memblokir tile OpenStreetMap** di semua peta (Sprint 2 meminta `tile.openstreetmap.org` di `img-src`, belum ada) → ditambahkan + test.
- **Halaman Audit (Super Admin) 500 di local/testing** untuk entri yang subjeknya User (mis. `attendance.consent_granted`) karena `deleted_at` di strict mode → memakai `trashed()` bila ada; test.
- `RevokeAttendanceConsent` tidak memakai scope `role()` Spatie (melempar bila peran belum di-seed).
- Mekanisme placeholder `$upcoming` + `pages/placeholder.tsx` dihapus (modul terakhir, Privasi, sudah dibangun).

## Cara mencoba manual (https://ruangkerja.test)
1. `anggota@demo.test` → Menu (ponsel) / menu pengguna (desktop) → **Privasi & data saya**: lihat profil (NIK `••••…0007`), persetujuan, absensi, pengajuan; **Unduh Excel/PDF**; **Cabut persetujuan** → coba check-in GPS → ditolak; **Berikan persetujuan** lagi.
2. `hr@demo.test` → Inbox: "Rizky Aditya mencabut persetujuan data lokasi & selfie"; Dashboard HR → **Tandai ditinjau** pada "Perlu ditinjau", **Koreksi** pada "Lupa check-out kemarin" (bila ada).
3. Halaman login → "Kebijakan privasi" (tanpa login). Ubah `resources/markdown/privacy-policy.md`, naikkan `PRIVACY_POLICY_VERSION` → Data Saya menampilkan "Perlu persetujuan ulang".
4. ⌘K → ketik "izin" atau nomor pengajuan → grup **Pengajuan**.
5. `direksi@demo.test` → `/portofolio` → "Kehadiran hari ini" = angka terjadwal (sama dengan Dashboard HR).
6. `QUERY_COUNTS=1 php artisan test --filter=PageQueryCount` → jumlah query per halaman.

## Keputusan
- **Satu versi untuk kebijakan & persetujuan**: `attendance.consent.version` = `env('ATTENDANCE_CONSENT_VERSION', env('PRIVACY_POLICY_VERSION', '1.0'))` — mengubah kebijakan privasi meminta persetujuan ulang lokasi & selfie (UU PDP: persetujuan atas versi yang berlaku). Kebijakan khusus absensi (`/absensi/kebijakan-data`) tetap, kini menaut ke kebijakan lengkap.
- **Kebijakan sebagai Markdown di `resources/`**, dirender server (`Str::markdown`, HTML di-escape) agar pemilik bisa mengubah teks tanpa menyentuh kode; tetap di git (berversi).
- **Ekspor lengkap, tampilan ringkas**: layar menampilkan 31 hari / 20 pengajuan / 20 keputusan terakhir (`config/privacy.php`), unduhan berisi semuanya. NIK tetap tersamar di ekspor (salinan lengkap lewat HR); gambar selfie tidak disertakan (hanya status "Tersimpan").
- **Gate `viewOwnData`** (tanpa model) di `PrivacyServiceProvider`; query selalu berdasarkan user yang login.
- **Notifikasi HR** memakai event `system` (in-app terkunci) — pemberitahuan kepatuhan, tidak bisa dimatikan.
- **Uji N+1 berbasis pertumbuhan data**, bukan hanya angka mutlak: data dilipatgandakan dua kali dan jumlah query harus sama; anggaran = angka terukur + 5 (perubahan sah menaikkan anggaran di commit yang sama). Waktu dikunci (Rabu 7 Okt 2026 09.00 WIB) agar jadwal/"hari ini" stabil.
- **Sketsa SVG menggantikan peta OSM di kartu Absensi** (mockup memang sketsa grid + lingkaran); Leaflet hanya di layar yang butuh peta sungguhan.
- **Ringkasan harian**: daftar pengecualian di config (bukan hard-code) agar modul berikutnya cukup menambah satu baris.
- Item 4g: status permintaan dipertahankan; hari "setengah hari disetujui setelah check-in" (status hadir + `request_id`) dikoreksi tanpa menit terlambat/pulang cepat.

## Paket baru
Tidak ada. Lighthouse dijalankan lewat `npx -y lighthouse@12` (tidak masuk `package.json`). `npm install` hanya menyinkronkan dependensi yang ditambahkan `main` (Sprint 6).

## Status pemeriksaan
- `rk_test`: **1779 test lulus** (10.463 assertion).
- `composer lint` (Pint + Larastan level 8): bersih. `npm run typecheck`: bersih. `npm run lint` (`vp check`): bersih. `npm test` (Vitest): **264 lulus**.
- Migrasi baru: rollback + migrate diuji di DB dev.

## Sisa / risiko
- Anggaran query di `PageQueryCountTest` perlu dinaikkan bila fitur baru menambah query sah di sebuah halaman (pesan galat menyebut halaman & angkanya).
- Shared props + once-prop status absensi ±18–24 query per kunjungan penuh (hanya kunjungan pertama / tiap 5 menit untuk status absensi) — bisa dipangkas nanti (mis. cache status absensi per user).
- Bundel awal masih memuat pusher-js (±20 kB gz) dan sonner; memindahkan Echo ke import tertunda butuh perubahan di semua pemakai `useEcho` (modul lain) — tidak dikerjakan.
- Playwright (`npm run test:e2e`) tidak dijalankan ulang di sesi ini; shell desktop kini lazy (skeleton sama), screenshot acuan per mesin mungkin perlu dibuat ulang.
- Permintaan **hapus data** (PRD §8 "ekspor & hapus data atas permintaan") tetap lewat HR (kebijakan menyebutkannya); belum ada alur penghapusan otomatis.
