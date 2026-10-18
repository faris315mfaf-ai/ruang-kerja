# Fase 1 — Celah isolasi yang ditemukan suite kebocoran

Hasil suite `tests/Feature/Tenancy/` (Langkah 1, 18 Okt 2026) dengan dua perusahaan: A (`homeWorld()`, penanda `ZZA0H0M`) dan B (`foreignWorld()`, penanda `ZZB0C0R`, data di semua modul). Setiap baris di bawah dirujuk oleh tes yang dilewati/dikecualikan; Langkah 2 menutupnya, lalu entri tes dihapus (daftar `known*Gaps()` gagal bila celahnya sudah tertutup, tes ber-skip bersyarat otomatis hijau).

Jalankan dengan ringkasan: `TENANCY_DEBUG=1 vendor/bin/pest tests/Feature/Tenancy`.

## Celah terdeteksi

| No | Rute / job | Peran A | Gejala | Kemungkinan penyebab (file:line) | Tes | Langkah |
|---|---|---|---|---|---|---|
| C1 | `GET admin/audit` (polos, `?q=`, filter) | super_admin | Halaman audit menampilkan entri audit **sistem** perusahaan B (`user_id` null, mis. `attendance.closed` "Audit sistem ZZB0C0R") | `app/Models/AuditLog.php:75-76` (`scopeVisibleTo`: `whereNull('user_id')` tanpa batas perusahaan); `app/Policies/AuditLogPolicy.php:14-22` (hanya cek izin); `audit_logs` tanpa `company_id` | `ListingLeakTest` › `knownListingGaps()` (3 entri) | 2a |
| C5 | `notifications:send-daily-digests` (ringkasan harian 07.30) | semua penerima A | Hari libur perusahaan B membatalkan ringkasan harian perusahaan A pada tanggal yang sama (hari kerja biasa bagi A) | `app/Domain/Attendance/Support/HolidayAwareWorkdayCalendar.php:22` (`Holiday::query()->whereDate(...)` tanpa `company_id`) | `BackgroundLeakTest` › "a holiday of company B does not cancel company A's working day" (skip bersyarat) | 2a |
| C9 | `SendAttendanceWhatsApp` (salinan check-in/out ke grup) | — (karyawan B) | Absen karyawan B, termasuk foto selfie berstempel, terkirim ke **grup WhatsApp yang sama** dengan perusahaan A (satu `group_jid` global) | `app/Domain/Notifications/Jobs/SendAttendanceWhatsApp.php:73`, `app/Domain/Attendance/Actions/CheckIn.php:168`, `app/Domain/Attendance/Actions/CheckOut.php:154` (`config('notifications.channels.whatsapp.group_jid')`) | `BackgroundLeakTest` › "attendance WhatsApp copies of company B never reach company A's group" (dataset: B tanpa grup / B dengan grup sendiri; skip dihapus) | 2c — **tertutup** `64354d63`: grup per perusahaan `companies.settings.whatsapp.group_jid` (`CompanySettings`, `EvolutionWhatsApp::attendanceGroupFor`) |

## Diperiksa dan bersih

- **451 pasangan metode + rute ber-parameter** (web + `api/v1`; 43 pola URI dikecualikan dengan alasan di `routeLeakExceptions()`) × Super Admin/HR/Direksi A dengan instans B: tidak ada GET 2xx, tidak ada tulis 2xx, tidak ada isi respons berpenanda B, sidik jari data B (`tenancyFingerprint()`, 102 tabel lewat `config/tenancy.php`) tidak berubah. Kontrol positif: 103 URL GET yang sama terjangkau oleh pemilik B sendiri.
- **250 URL GET** tanpa parameter (atau hanya data A/format/enum) × 3 varian × 5 peran A, termasuk prop Inertia tertunda, JSON `api/v1`, `.xlsx` dan data view sumber PDF: bersih kecuali C1.
- **Job terjadwal** (semua entri `routes/console.php`, 9 titik waktu Jumat kerja): 46 kiriman ke A dan 46 ke B (Inbox, broadcast, FCM, email, ringkasan harian) tanpa penanda perusahaan lain.
- **Kanal broadcast**: 10 nama kanal dari 8 definisi `routes/channels.php` menolak 5 peran A (403/404), menerima pemilik B.

## Celah dari rencana yang tidak terlihat oleh suite ini

Tidak menimbulkan kebocoran yang bisa diamati lewat respons, notifikasi, atau kanal dengan data uji ini; tetap dikerjakan di Langkah 2 sesuai rencana (`shimmying-scribbling-finch.md`):

| Rencana | Celah | Mengapa tidak terdeteksi |
|---|---|---|
| #2 | `request_sequences` & `requests.number` global (`RequestNumberGenerator.php:22-30`) | Bukan kebocoran isi; nomor B ikut menaikkan penghitung A (perlu tes nomor khusus di 2a) |
| #3 | `employee_profiles.employee_number` unik global | Hanya bentrok saat nomor sama (validasi), tidak membocorkan data |
| #4 | Asumsi "perusahaan pertama" (Fortify, GoogleOAuth, CreateSuperAdmin, CreateWorkspace, SaveTaskTemplate) | Jalur cadangan; semua aktor uji punya `company_id` |
| #6 | `HrDashboard.php:164` `User::role(Hr)` lintas perusahaan | Hanya dipakai untuk hitungan/penerima; tidak tampil sebagai nama B di dashboard A |
| #7 | Binding ULID workspace (`routes/workspaces.php:40-41`) | Gate menolak (404) — terbukti di RouteBindingLeakTest |
| #8 | Validasi `exists` tanpa perusahaan | Suite memanggil rute dengan payload kosong; injeksi id B di payload belum diuji (kandidat tes 2a) |
| #9 | Shared Drive tunggal, nama perusahaan email global — **tertutup 2c** (`a5ddce37` Shared Drive per perusahaan, `0a44895b` nama perusahaan penerima di email; `CompanyIntegrationsTest`) | Drive palsu di tes; layout email memakai `branding.company_name` yang sama untuk dua perusahaan (tidak berpenanda) |
| #10 | Kunci cache `MetricCache`, once-prop `attendanceStatus:{userId}` | Id pengguna unik global, jadi tidak bertabrakan sekarang |
| #11 | Berkas privat tanpa prefiks perusahaan | Jalur unik per baris; tidak terbaca lintas perusahaan lewat rute (selfie 403/404) |
| #12 | Zona waktu & scheduler global | **Ditutup (2b):** zona = `companies.timezone` lewat `CurrentCompany::timezone()` (web `officeTimezone`, aplikasi `office_timezone`); tugas berjam lokal per perusahaan (`CompanySchedule`, klaim `scheduled_runs`), job/perintah terjadwal per perusahaan (`ForEachCompany`). Diuji `CompanyTimezoneTest`, `CompanyScheduleTest` (WIB/WITA/WIT) |
