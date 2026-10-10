# Sesi ponsel

**Terakhir diperbarui:** 10 Okt 2026 (Tahap 1 — absensi & tugas API selesai) · ZCode (GLM)

## Tugas berjalan
**Tahap 1 — API v1 aplikasi Android (Expo)** — **fondasi + absensi + tugas selesai, belum push** (menunggu perintah pemilik). Tugas #18 di `docs/PEMBAGIAN-TUGAS.md`; rencana induk `docs/fitur/aplikasi-ponsel-rencana.md`.

Endpoint live (prefix `/api/v1`, token Sanctum per perangkat):
- `POST /auth/login` {email, password, device{platform, device_id_hash(64-hex), name?, os_version?, app_version?}} → `{token, user}` ringkas (id/nama/email/jabatan/divisi/work_mode). 403 ber-`code`: `password_change_required`, `two_factor_required` (Super Admin — TOTP belum didukung aplikasi). Kredensial lewat `AuthenticateEmployee` (pesan generik 422). Login ulang perangkat sama mengganti token lama.
- `POST /auth/logout` (revoke token ini saja), `GET /auth/saya`.
- `GET /perangkat` (milik saya; `is_current` dari nama token; `push_token` tak pernah dikirim), `DELETE /perangkat/{device}` (hapus baris + semua token instalasi itu), `PUT /perangkat/{device}/push-token` {token}.
- **Absensi** (pemilik token sendiri, presenter/Action/Policy web dipakai ulang): `GET /absensi/hari-ini` → `{today{action, schedule, day, locations[]}, serverTime}`; `POST /absensi/check-in` & `/absensi/check-out` (multipart; limiter `check-in` 6/menit per user) — penolakan bisnis 422 `{message, reason, context}` **identik web** (lewat `CheckInController::rejected()`), sukses 201 `{result}` AttendancePresenter (work_plan → tugas otomatis + salinan WhatsApp ditangani Action); `GET /absensi/riwayat?bulan=YYYY-MM` → `{period, recap}` (RecapPeriod/MonthlyRecap/RecapPresenter web; bulan salah jatuh ke bulan berjalan). `device_id` check-in = 64-hex (hash SHA-256), berbeda dari web yang bebas string.
- **Tugas**: `GET /tugas/hari-ini` (query `TugasHariIni`: segmen pribadi/tim/semua + counts); `GET /tugas?saya=0|1` (paginate 20, `Task::visibleTo`, presenter `TaskSummary` ringkas); `GET /tugas/{task}` (detail ringkas; tak terlihat → 404); `PATCH /tugas/{task}/status` `{status_id}` **atau** `{done: bool}` — Action `MoveTask` web di balik `TaskPolicy::move` (penerima boleh menyelesaikan; aturan sunting 9 Okt tak menyentuh move); `done:true` ikut target web CompletionTarget (workspace tim → kolom Review dulu, workspace pribadi → Done), `done:false` buka kembali ke kolom terbuka pertama. **Tanpa rute buat/sunting/hapus tugas** — penugasan atasan lewat web (Tahap 1).
- Limiter: `api-v1` 60/menit per user, `api-login` 10/menit per IP (429 JSON Indonesia). Komentar penanda di `routes/api.php` untuk agen berikutnya: "inbox, workspace, pengajuan, briefing".

## Worktree / branch
`/Users/godam/PROYEK/ruang-kerja-ponsel` · `glm/ponsel-api` · https://ruangkerja-ponsel.test · DB dev `ruangkerja_ponsel`, DB test `ruangkerja_testing_ponsel`

## Sudah selesai (Tahap 1, 10 Okt)
- `db02fa2` endpoint absensi ponsel: `Api/Attendance/{MyAttendanceController,AttendanceHistoryController,CheckInController,CheckOutController}` + FormRequest `Api/AttendanceCheckInRequest`/`AttendanceCheckOutRequest` (mirror web + `device_id` 64-hex; check-out tanpa work_plan) + test `AttendanceApiTest.php` (8 test)
- `87a7dcd` endpoint tugas ponsel: `Api/Task/{TaskController,TaskStatusController}` + FormRequest `Api/TaskStatusRequest` (HidesInvisibleWorkspaces; pilih `status_id` **atau** `done`) + presenter `Http/Resources/Api/TaskSummary` + test `TaskApiTest.php` (8 test)
- `6397f07` cast `(string)` env `SANCTUM_STATEFUL_DOMAINS` di `config/sanctum.php` (galat Larastan level 8 yang tertinggal)
- `3016c4f` pasang Sanctum (satu-satunya paket baru `laravel/sanctum`); token tanpa abilities granular & tanpa expiration (dicabut per perangkat) — catatan keputusan di `config/sanctum.php`
- `e2f276c` merge `glm/catatan-minimal` ke branch ini (konflik hanya `docs/fitur/aplikasi-ponsel-rencana.md`, digabung manual)
- `29723c3` fix halaman `/kebijakan-privasi`: controller kini melempar `transcriptRetentionDays` (view sudah memakainya sejak `a6ad8ba`)
- `1e692a0` `routes/api.php` + registrasi `api:` di `bootstrap/app.php` (`EnsureActiveEmployee` di grup api, dipatok setelah auth) + limiter `api-v1`/`api-login`
- `d36846e` migrasi Sanctum `tokenable` → `ulidMorphs` (bigint bawaan tidak cocok PK ULID; tabel dibuat ulang di DB dev)
- `df4cb07` endpoint auth (`Api/Auth/AuthController`), perangkat (`Api/Devices/DeviceController`), FormRequest `Api/LoginRequest`+`Api/PushTokenRequest` (pesan Indonesia), `Device::sanctumTokenName("device:{id}")` konvensi nama token, `RevokeDevice` ikut mencabut token Sanctum dalam transaksi, test `tests/Feature/Api/AuthApiTest.php` + `DeviceApiTest.php` (16 test)

## Sudah selesai (Tahap 0, 9 Okt)
- `485d57b` klaim tugas di papan (`docs/PEMBAGIAN-TUGAS.md` baris 18)
- `12210cc` endpoint `assetlinks.json` + identitas paket — `config/branding.php` (`ANDROID_PACKAGE` default `store.spkd.ruangkerja`, `ANDROID_CERT_SHA256`), `routes/android.php`, test `tests/Feature/Android/AssetLinksTest.php`
- `1bf62f9` panduan identitas Android — keystore, cara ambil SHA-256, assetlinks (`docs/deploy/ANDROID-IDENTITAS.md`)
- `debb9a2` runbook akun & tooling Tahap 0 untuk pemilik (`docs/deploy/ANDROID-AKUN.md`: Play Console, Expo/EAS, Firebase/FCM, keystore, checklist)
- `807d8c6` taut silang runbook akun ↔ panduan identitas
- `4d2ce6f` fondasi devices — migrasi `devices` (rollback teruji), model + `DevicePlatform`, Actions `RegisterDevice`/`UpdateDevicePushToken`/`RevokeDevice` (advisory lock, maks 5 perangkat, audit `device.revoked`), `DevicePolicy` (hanya pemilik; HR & Super Admin sengaja tanpa akses), 11 test Pest; `docs/DATABASE.md` §8
- `bc1b1d2` halaman kebijakan privasi publik `/kebijakan-privasi` tanpa login (Blade mandiri tanpa shell Inertia; `/privasi` tetap halaman "Privasi & data saya" yang ter-autentikasi)

**Belum push** — menunggu perintah pemilik.

## Langkah berikutnya
1. **Tahap 1 lanjutan (agen berikutnya, backend):** Inbox feed (dan bila diminta workspace/pengajuan/briefing) — tambahkan di slot komentar "inbox, workspace, pengajuan, briefing" `routes/api.php`; pola: `auth:sanctum` + `throttle:api-v1` + Policy + presenter web dipakai ulang.
2. **Tahap 1 lanjutan (aplikasi Expo):** layar masuk memakai `POST /api/v1/auth/login`; simpan token aman di perangkat; handle 403 `password_change_required`/`two_factor_required`; 429 `code throttled`/`login_throttled`; layar absensi (hari-ini → check-in/out dengan selfie & work_plan, tampilkan `reason` penolakan) dan tugas (hari-ini, daftar `saya=1`, tombol selesai `done:true`).
3. Input pemilik yang menahan: SHA-256 sertifikat (`ANDROID_CERT_SHA256`), `BRANDING_COMPANY_NAME`, `PRIVACY_CONTACT`, dan keputusan final nama paket (default `store.spkd.ruangkerja` — sekali terbit di Play Store tidak bisa diubah).
4. Konten `/kebijakan-privasi` masih **draf**: menunggu persetujuan pemilik + pengisian `BRANDING_COMPANY_NAME` dan kontak.
5. Push + PR setelah izin pemilik.

## Keputusan yang diambil (implementasi Tahap 1)
- **Super Admin ditolak di API login** (403 `two_factor_required`): TOTP challenge belum diimplementasikan di API; menerima kata sandi saja akan menurunkan keamanan dibanding web. Buka kembali bila API mendukung tantangan TOTP.
- **Satu token aktif per instalasi**: token Sanctum dinamai `device:{id}` (`Device::sanctumTokenName`); login ulang menghapus token lama instalasi itu, mencabut perangkat menghapus baris + semua token instalasi — tanpa kolom tambahan di `personal_access_tokens`.
- **Penolakan check-in/out API = body web, verbatim**: controller API memanggil `App\Http\Controllers\Attendance\CheckInController::rejected()` sehingga `{message, reason, context}` 422 tidak pernah bergeser dari web.
- **Riwayat absensi API = rekap web** (`RecapPresenter::detail`), bukan hanya daftar log: aplikasi dapat kalender hari + angka rekap pribadi dari satu endpoint, konsisten dengan halaman "Absensi Saya".
- **`done:true` tugas mengikuti target web** (CompletionTarget): workspace tim dengan kolom Review → "Kirim ke Review" dulu (`is_done` false), workspace pribadi → langsung Done; `done:false` membuka kembali ke kolom terbuka pertama. Penolakan memakai pesan yang sama dengan `CompletePlannedTask` ("Tugas ini sudah selesai." dst).
- **API v1 tanpa rute buat/sunting/hapus tugas** (koordinator, Tahap 1): penugasan atasan tetap alur web; PATCH/DELETE/POST pada `/tugas` menjawab 405.
- **`device_id` check-in API divalidasi 64-hex** (hash SHA-256 aplikasi) — web tetap bebas string maks 128; check-out menerima payload sama **tanpa** `work_plan` (dikirim pun diabaikan).
- **Catatan test**: guard `sanctum` (`RequestGuard`) meng-cache user di instance-nya, dan app test dibagi antar permintaan dalam satu test — test yang berganti token wajib `app(Illuminate\Contracts\Auth\Factory::class)->forgetGuards()` dulu (helper `sebagaiToken`/`pakaiToken`). Produksi tidak terpengaruh (app baru per permintaan).
- `last_login_at` diisi lewat event `Login` → listener `RecordLogin` yang sama dengan web (Super Admin tak pernah sampai sana karena ditolak duluan).
- PUT push-token hanya **menetapkan/rotasi** token FCM (required, min 32); menghapus token = logout/cabut perangkat.

## Keputusan pengguna yang berlaku
- **9 Okt:** jalur **Expo native penuh** — TWA/Bubblewrap dan Capacitor **digugurkan** (usulan TWA→Capacitor di rencana §2 tidak dipakai; PRD §28 memang sudah menulis React Native/Expo, jadi tidak perlu diubah).
- **9 Okt:** Android diprioritaskan di atas Canvas.
- **10 Okt (koordinator):** APK fungsional dulu, daftar Play belakangan; Sanctum satu-satunya paket baru Tahap 1.
- Push/PR/deploy tetap menunggu perintah eksplisit pemilik.

## Butuh dari pemilik / integrator
- **Pemilik:** akun Play Console + Firebase + Expo/keystore (runbook `docs/deploy/ANDROID-AKUN.md`), SHA-256 sertifikat, nama paket final, `BRANDING_COMPANY_NAME`, `PRIVACY_CONTACT`.
- **Integrator:** isi `docs/CHANGELOG.md` saat merge.

## Verifikasi
- **10 Okt (Tahap 1 — absensi & tugas API):** `vendor/bin/pest tests/Feature/Api/` **32 lulus** (16 baru: `AttendanceApiTest.php` 8 + `TaskApiTest.php` 8); `vendor/bin/phpstan analyse --memory-limit=1G` (level 8, seluruh path konfigurasi) **tanpa galat** (termasuk perbaikan `config/sanctum.php`); `vendor/bin/pint` pada 18 berkas terkait bersih. Suite penuh tidak dijalankan (DB test dipakai terbatas per koordinator).
- **10 Okt (Tahap 1 — fondasi):** `vendor/bin/pest tests/Feature/Api/ tests/Feature/Devices/DeviceTest.php` **27 lulus** (16 baru); `vendor/bin/pint --test` (15 berkas terkait) PASS; `vendor/bin/phpstan analyse` (rute/controller/request/Domain Devices/AppServiceProvider/bootstrap/migrasi, level 8) **tanpa galat**. Migrasi dijalankan di DB dev `ruangkerja_ponsel` (`php artisan migrate --force`); suite penuh tidak dijalankan (DB test dipakai terbatas per koordinator).
- Sesi koding 9 Okt pagi (s.d. `bc1b1d2`): suite Pest **3.249 test lulus** (paralel), lint/typecheck bersih.
- Verifikasi ulang 9 Okt (agen dokumentasi): `composer lint` (Pint + Larastan), `npm run typecheck`, `npm run lint` **bersih**; test branch (`Android`, `Devices`, `Privacy`) **29 lulus**; total suite tetap **3.249 test**. Run paralel penuh di mesin yang sibuk memunculkan kegagalan sporadis `SQLSTATE[40P01]` (deadlock Postgres) saat setup DB per-proses — jumlahnya berubah-ubah antar run (17 lalu 37) dan selalu di tahap migrasi/drop tabel, jadi **bukan regresi branch**; jalankan ulang di mesin lebih sepi bila butuh suite penuh hijau.
