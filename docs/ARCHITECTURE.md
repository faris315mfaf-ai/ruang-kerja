# Arsitektur — RuangKerja

## 1. Gambaran

```
                      ┌──────────────────────────── VPS Biznet Gio ─────────────────────────────┐
 Browser / PWA ─HTTPS─▶ Caddy ──▶ app (Laravel 13, PHP-FPM/FrankenPHP)  ──▶ PostgreSQL 17       │
       ▲               │   │        │  Inertia + React (SSR opsional)    ──▶ Redis 7 (cache,     │
       │ WSS           │   │        │                                         queue, session)    │
       └───────────────┼───┴──▶ reverb (WebSocket)                                               │
                       │          queue (Horizon) ── jobs: Drive sync, notifikasi, rekap         │
                       │          scheduler       ── tutup hari absensi, ringkasan harian        │
                       │          [F2] hocuspocus (Node) ── catatan realtime (Yjs)               │
                       └──────────────────────────────────────────────────────────────────────────┘
                                   │                         │
                         Google APIs (OAuth, Drive,     Object Storage S3-compatible
                         Picker, Calendar F2)           (selfie, lampiran privat, backup)
                                   │
                         [F2] WhatsApp provider · Email SMTP
```

**Prinsip**
- **Monolit modular.** Satu aplikasi Laravel, dipisah per domain. Tidak ada microservice kecuali Hocuspocus (Fase 2) karena Yjs paling matang di Node.
- **Inertia untuk web, API terpisah untuk mobile.** Web memakai controller Inertia. Fase 3 menambah `routes/api.php` (Sanctum) yang memanggil **Action** yang sama, jadi logika tidak diduplikasi.
- **Logika bisnis di Action, bukan controller.** Controller hanya validasi (FormRequest), otorisasi (Policy), panggil Action, kembalikan respons.

## 2. Struktur folder

```
app/
├── Domain/
│   ├── Organization/      Models, Actions (CreateEmployee, ImportEmployees), Enums (WorkMode, UserStatus)
│   ├── Attendance/
│   │   ├── Actions/       CheckIn, CheckOut, CloseDay, CorrectAttendance
│   │   ├── Services/      ScheduleResolver, GeofenceService, QrTokenService, FraudDetector
│   │   ├── Enums/         AttendanceStatus, AttendanceMethod, LogFlag
│   │   └── Models/
│   ├── Requests/          SubmitRequest, ApproveStep, RejectStep, ApprovalFlowResolver, LeaveBalanceService
│   ├── Workspaces/        CreateWorkspace, SyncDivisionMembers, WorkspaceRole
│   ├── Tasks/             CreateTask, MoveTask, AssignTask, PostComment, MentionParser, Lexorank
│   ├── Google/            GoogleClientFactory, DriveFolderService, DrivePermissionSync, DocCreator
│   ├── Notifications/     channels/ (InApp, Mail, WhatsApp F2), DailyDigest
│   └── Analytics/         MetricDefinitions, DashboardQueries (satu sumber kebenaran rumus)
├── Http/
│   ├── Controllers/       per modul, tipis
│   ├── Requests/          FormRequest
│   ├── Middleware/        EnsureActiveEmployee, EnsureConsentGiven
│   └── Resources/         transformasi data ke props Inertia / JSON API
├── Policies/
├── Events/ Listeners/     TaskMoved → broadcast + activity + notifikasi
└── Console/Commands/

resources/js/
├── app.tsx  ssr.tsx
├── layouts/               AppLayout (sidebar + topbar), AuthLayout, KioskLayout
├── pages/                 dashboard/, attendance/, requests/, workspaces/, tasks/, inbox/, admin/
├── components/ui/         shadcn/ui
├── components/            CommandPalette, UserAvatar, EmptyState, StatCard, PriorityIcon, StatusIcon
├── features/              attendance/CheckInDialog, tasks/KanbanBoard, tasks/TaskSheet, …
├── hooks/                 useEcho, useHotkeys, useGeolocation, useCamera
├── lib/                   utils, date (Asia/Jakarta), format
└── types/                 generated (spatie/laravel-typescript-transformer atau manual)

database/ migrations/ seeders/ factories/
tests/ Feature/ Unit/ Browser/
docker/ compose.yml compose.prod.yml Caddyfile
```

## 3. Alur penting

### 3.1 Check-in GPS + selfie
1. Klien meminta `navigator.geolocation` (`enableHighAccuracy`) dan kamera depan (`getUserMedia`). Foto dikompres ke JPEG ≤ 300 KB di klien.
2. `POST /attendance/check-in` (multipart): lat, lng, accuracy, client_time, selfie, device fingerprint.
3. Server: cek persetujuan → `ScheduleResolver` mencari jadwal & `work_date` (memperhitungkan shift lintas tengah malam) → `GeofenceService` menghitung jarak haversine ke lokasi kantor aktif → `FraudDetector` memberi flag → simpan selfie ke disk privat → buat `attendance_logs` + perbarui `attendance_days` dalam satu transaksi.
4. Respons berisi status (`Tepat waktu` / `Terlambat 12 menit`) + jarak. Event broadcast ke dashboard HR/Kadiv.
5. Di luar radius untuk karyawan `office`: **ditolak** dengan pesan jelas + opsi "Ajukan dinas luar/koreksi". Untuk `hybrid` di hari WFH atau `wfh/field`: diterima dengan method `wfh`.

### 3.2 QR dinamis
- Halaman kiosk `/kiosk/{location}` (login akun kiosk khusus) menampilkan QR berisi `ruangkerja://checkin?l={location}&w={window}&s={HMAC}` yang berganti tiap 30 detik.
- Karyawan memindai dengan kamera di halaman Check-in. Server memvalidasi HMAC, jendela waktu (± 1 jendela), dan tetap merekam GPS bila diizinkan.
- Implementasi (Sprint 3): akun kiosk = tabel `kiosks` + guard sesi `kiosk` (provider `kiosk-devices`, `AttendanceServiceProvider`). HR membuat kiosk dan tautan aktivasi sekali pakai (24 jam) beserta **kode aktivasi pendek** (8 karakter tanpa huruf/angka mirip, mis. `ABCD-2345`, diketik di layar `/kiosk` perangkat → `POST /kiosk/aktivasi`, maks. 5 percobaan/menit per IP dan kunci 15 menit setelah 10 kode salah; fitur dokumentasi 2026-10); perangkat yang membuka tautan atau memasukkan kode masuk sebagai kiosk (remember cookie). Tautan dan kode diterbitkan bersamaan dan memakai salah satunya membatalkan keduanya. Middleware `RestrictKioskDevice` (grup web, diprioritaskan sebelum `auth`) mengarahkan sesi kiosk ke `/kiosk/{location}` untuk rute apa pun selain `kiosk.*` (JSON: 403) dan mengakhiri sesi bila kiosk nonaktif/dihapus/dipasang di perangkat lain. Halaman kiosk mengambil kode baru dari `GET /kiosk/{location}/kode` tepat setelah tiap jendela 30 detik; SVG QR dibuat server (`bacon/bacon-qr-code`), rahasia HMAC tidak pernah ke klien. Pemindaian: `@zxing/browser` (dimuat lazy) → `POST /absensi/check-in/qr` atau `/check-out/qr` (limiter `check-in`) → `CheckIn`/`CheckOut` yang sama dengan GPS (method `qr`, tanpa selfie).

### 3.3 Tutup hari (scheduler, 00:30 waktu kantor tiap perusahaan, §3.9)
`CloseDay` untuk tanggal kemarin: setiap karyawan aktif yang terjadwal → bila tidak ada log dan tidak ada pengajuan disetujui → `absent`. Check-in tanpa check-out → `needs_correction` + notifikasi. Idempoten (aman dijalankan ulang).

### 3.4 Approval
`SubmitRequest` → `ApprovalFlowResolver` membuat baris `request_approvals` untuk langkah yang kondisinya terpenuhi, meresolusi penyetuju (atasan langsung, kepala divisi, peran, user, dengan delegasi) → langkah pertama `waiting`. `ApproveStep` memajukan langkah. Langkah terakhir disetujui → status `approved` → efek samping: kurangi saldo cuti, tulis `attendance_days` status cuti/izin/sakit/dinas, tambah `overtime_minutes`, atau terapkan koreksi. Semua dalam transaksi + audit log.

Aturan: pemohon tidak bisa menyetujui pengajuannya sendiri. Jika penyetuju = pemohon (mis. Kadiv tanpa atasan), langkah otomatis naik ke peran berikutnya.

### 3.5 Task realtime
- Pindah kartu: optimistic update di klien → `PATCH /tasks/{id}/move` (status_id, position lexorank di antara dua kartu) → event `TaskMoved` broadcast di private channel `workspace.{id}` → klien lain memperbarui board.
- Penomoran task: `UPDATE workspaces SET task_sequence = task_sequence + 1 … RETURNING` di dalam transaksi.
- Komentar: simpan JSON Tiptap → `MentionParser` mengambil node mention → `mentions` + notifikasi.
- Implementasi Sprint 6: event `task.created|updated|moved|deleted` dan `comment.posted|updated|deleted` di `private-workspace.{id}`, presence `presence-task.{id}` ("X sedang melihat"). Broadcast memakai antrean `realtime` dengan worker Horizon sendiri (`supervisor-realtime`) agar tidak menunggu job email. Klien (`features/tasks/realtime`) berbagi satu langganan per channel; bila WebSocket tidak tersambung, board/detail di-polling tiap 30 detik dengan indikator kecil. Mention hanya untuk orang yang bisa melihat workspace (`TaskAudience`).
- Tanda baca komentar (backlog Sprint 6): penunjuk baca per orang per tugas (`task_comment_reads`, `MarkCommentsRead`) maju saat bagian komentar detail terlihat (debounce), sekaligus menandai notifikasi komentar/mention tugas itu dibaca; event `comment.read` di presence `presence-task.{id}` memperbarui "Dibaca oleh" tanpa memuat ulang. Kartu board/list membawa `comments {count, unread}` dari subquery `BoardTasks::query($viewer)`; board memuat ulang kartu setelah `comment.posted|deleted`.
- Kehadiran per kartu board (backlog Sprint 6): callback kanal `workspace.{workspace}` kini mengembalikan `{id, name, avatar, read_only}` sehingga juga mengotorisasi presence `presence-workspace.{id}` (kanal private mengabaikan array itu). Satu langganan per tab; klien mengirim whisper `viewing` (tugas yang dibuka/diketik, heartbeat 12 detik, kedaluwarsa 30 detik) dan `sync` (tab baru minta diumumkan ulang). Workspace pribadi tidak bergabung. Logika murni di `features/tasks/realtime/board-presence.ts`.

### 3.6 Google Drive
- **Folder workspace:** saat workspace dibuat, job `CreateDriveFolder` (service account, impersonasi admin) membuat folder di Shared Drive, simpan `drive_folder_id`.
- **Sinkron izin:** anggota ditambah/dihapus → job `SyncDrivePermissions` menambah/mencabut izin `writer`/`reader` per email di folder tersebut. Idempoten, retry eksponensial, catat error di log.
- **Dokumen baru:** `DocCreator` membuat file Docs/Sheets/Slides di folder workspace → simpan `drive_files` → kembalikan `webViewLink`.
- **Lampirkan dari Drive:** Google Picker di klien memakai token OAuth pengguna (scope `drive.file`) → kirim `fileId` ke server → server mengambil metadata → `drive_files` + `attachments`.
- **Unggah:** unggah resumable langsung dari server ke folder workspace (batas 100 MB per file di Fase 1).
- Pratinjau di aplikasi memakai URL `…/preview` dalam iframe untuk file Google.

### 3.7 Webhook Google Form (Hiring, keputusan pemilik 6 Okt 2026)
- Google Apps Script di Form lowongan mengirim `POST /api/hiring/form/{token}` (rute di `routes/hiring.php`, **tanpa** middleware sesi/cookie/CSRF/Inertia; `throttle:60,1`). Badan JSON `{response_id, submitted_at, answers[], files[]}` ditandatangani `X-RuangKerja-Signature` = hex HMAC-SHA256 badan mentah dengan `hiring_positions.webhook_secret` (cast `encrypted`).
- `FormWebhookController` → `WebhookSignature::verify` (401) → status lowongan (410 bila ditutup) → `ReceiveFormSubmission` (idempoten per `response_id` lewat indeks unik, pemetaan field `FormSubmissionMapper`, checklist awal, audit `hiring.candidate_received`, notifikasi in-app ke HR). Tidak ada panggilan Google API dari server.

### 3.8 Video RuangKerja (LiveKit, keputusan pemilik 7 Okt 2026)
- Server media **LiveKit** (SFU WebRTC) di VPS rapat terpisah (`livekit.spkd.store`, Caddy + TURN/TLS 443, `docs/deploy/RAPAT-VIDEO.md`); aplikasi hanya membuat token dan menerima webhook, tidak meneruskan media.
- `POST /rapat/{id}/video/token` → `MeetingPolicy::joinVideo` (peserta/penyelenggara + jendela gabung) → `IssueVideoToken`: JWT HS256 (`firebase/php-jwt`, 10 menit) untuk ruang `rk-{meeting}-{yyyymmdd}`; browser (`livekit-client`) tersambung langsung ke `LIVEKIT_URL` (CSP `connect-src` dari `config/livekit.php`).
- Moderasi penyelenggara → `LiveKitRoomService` (Room Service API Twirp, sinkron 5 detik). Webhook `POST /api/livekit/webhook` (tanpa sesi/CSRF, tanda tangan JWT + sha256 badan, anti-replay) → `RecordVideoEvent` → `meeting_attendances` → kehadiran di detail rapat & isian awal notulen.

### 3.9 Zona waktu & penjadwal per perusahaan (Fase 1 multi-perusahaan, Langkah 2b)
- **Zona waktu kantor = `companies.timezone`** (zona IANA, divalidasi saat disimpan; bawaan `Asia/Jakarta`). Semua tanggal kantor & jam dihitung lewat `CurrentCompany::timezone()` (= `CompanyContext::timezone()`; tanpa perusahaan → `config('app.office_timezone')`): helper `OfficeTime`, `OfficeClock`, `ProjectClock`, `Period`, `ScheduleResolver`, `MeetingOccurrences`, `ReportDay`, `BriefingDay`/`BriefingPeriod`, `QuietHours`, digest, controller/FormRequest/query, dan SQL mentah (`AT TIME ZONE ?` sebagai binding). Web menerima shared prop `officeTimezone` (`lib/format.ts`: `officeTimezone()`, `officeDateFormat()`, `officeUtcOffset()`), aplikasi menerima `office_timezone` di `GET auth/saya` (`src/lib/zonaKantor.ts`).
- **Tugas berjam lokal** (`App\Domain\Tenancy\Scheduling\CompanySchedule`, didaftarkan di `routes/console.php`): saldo cuti 1 Jan 00.05, delegasi 00.10, tutup hari 00.30, tenggat 07.00, tugas berulang 07.00, otomasi "lewat tenggat" & tindak lanjut rapat 07.05, pengingat proyek & OKR Jumat 15.00, laporan harian 16.30 (hari kerja), snapshot burn-up 23.55. Event `Schedule::call($task)` berjalan **tiap 5 menit**; untuk tiap perusahaan aktif (`companies` tanpa soft delete) `LocalTask::isDueAt()` memeriksa jam lokal perusahaan sudah ≥ waktu tugas, hari cocok, dan keterlambatan ≤ batas kejar (bawaan 2 jam; tutup hari & delegasi 12 jam, saldo sehari) → **klaim idempoten** baris `scheduled_runs (task, company_id, local_date)` (`INSERT … ON CONFLICT DO NOTHING`; berjalan sekali per perusahaan per tanggal lokal walau scheduler jalan berulang atau di beberapa server) → pekerjaan dijalankan di dalam `CompanyContext::run($company)` (job yang di-dispatch mengingat perusahaannya; perintah artisan hanya melihat perusahaan itu). Gagal → klaim dilepas (diulang 5 menit kemudian), perusahaan lain tetap jalan. Klaim > 60 hari dihapus `tenancy:prune-scheduled-runs` (03.40).
- **Tugas per-instan** (pengingat check-in tiap 5 menit, ringkasan harian tiap 5 menit, pengingat rapat tiap menit) tetap satu event; job/perintahnya memakai `ForEachCompany::run()` — di dalam konteks hanya perusahaan itu, tanpa konteks tiap perusahaan dalam konteks & zonanya sendiri. Perintah yang dijalankan manual (`php artisan attendance:close-day` dll.) juga per perusahaan. Job/action terjadwal membatasi query ke `CurrentCompany::id()` bila ada konteks.
- **Job unik** yang di-dispatch per perusahaan memakai `uniqueId()` = `companyUniqueId()` (`CompanyAware`): kunci unik per perusahaan, sehingga job perusahaan kedua tidak terbuang. Pekerjaan yang mengembalikan `PendingDispatch` harus dihancurkan di dalam konteks (`LocalTask::perform()` membuang hasilnya di sana).
- **Tetap global** (zona aplikasi): retensi & pembersihan infrastruktur — selfie, QR kiosk, kunci idempotensi API, notifikasi lama, unggahan Drive, berkas impor, waktu bicara rapat, transkrip, data pelamar, permintaan reset sandi. Flag fitur (`features.*`) tetap global (per perusahaan = Fase 3).

## 4. Otorisasi

| Lapisan | Mekanisme |
|---|---|
| Peran global | `spatie/laravel-permission` (`super_admin`, `direksi`, `hr`, `kepala_divisi`, `anggota`) |
| Cakupan data | Policy + query scope: `Attendance::visibleTo($user)` → diri sendiri; bawahan langsung; divisi bila Kadiv; semua bila HR/Direksi/Super Admin |
| Workspace | `WorkspacePolicy` membaca `workspace_members.role` + aturan visibilitas. Direksi, HR (`workspaces.view_all`) dan Super Admin: lihat semua non-pribadi; bila bukan anggota **mode lihat saja** (`WorkspacePolicy::isViewOnly`, keputusan pemilik 6 Okt 2026). Workspace pribadi hanya pemilik (bahkan Super Admin tidak bisa membaca isi) |
| Data sensitif | Melihat selfie membutuhkan izin `attendance.view_selfie` (HR & atasan langsung) dan **selalu** dicatat `audit_logs` |
| Broadcast | `routes/channels.php` memakai Policy yang sama |

Uji wajib: setiap Policy punya test matriks peran × aksi.

## 5. Keamanan & privasi

- Sesi cookie `HttpOnly`, `Secure`, `SameSite=Lax`. CSRF untuk semua POST.
- **Login (keputusan pemilik 6 Okt 2026):** semua karyawan aktif masuk dengan email + kata sandi lewat Fortify (`AuthenticateEmployee`): satu pesan galat generik + timebox 200 ms untuk semua kegagalan (email tak dikenal, sandi salah/belum diatur, akun nonaktif), audit `user.login_failed` untuk akun yang dikenal. TOTP wajib hanya untuk Super Admin (`EnsureTwoFactorForSuperAdmin`; rute 2FA & konfirmasi sandi hanya Super Admin lewat `RestrictCredentialRoutes` + `UserPolicy::manageTwoFactor`). Login Google ditahan (rute `auth.google.*` & kode tetap, tidak ditampilkan).
- **Kata sandi:** aturan `PasswordValidationRules` → `PasswordPolicy` (keputusan pemilik 7 Okt 2026): karyawan "aturan bebas" (wajib, dikonfirmasi, maks 255, bukan sandi bawaan — `NotDefaultPassword`, `hash_equals`), Super Admin tetap ketat (min 8 + bukan email; produksi `uncompromised()`); atribut `passwordrules` browser hanya untuk Super Admin. **Sandi bawaan** `EMPLOYEE_DEFAULT_PASSWORD` (`config('auth.employee_default_password')`, `DefaultPassword` scoped, hash dibuat sekali per request/perintah): `CreateEmployee` (form & impor) memberikannya + wajib ganti kecuali Super Admin; HR "Sandi bawaan" di Atur kata sandi (nilai diambil saat diminta dari `GET admin/karyawan/{id}/kata-sandi/bawaan`, `no-store`); `ruangkerja:reset-default-passwords` (`ResetPasswordsToDefault`, chunk 100 per transaksi, audit `user.password_reset_to_default`). Ganti sendiri (`ChangeOwnPassword`, audit `user.password_changed`). HR mengatur (`SetEmployeePassword`, Policy `UserPolicy::setPassword` — akun super_admin/direksi/hr hanya oleh Super Admin, audit R-06 keputusan pemilik 8 Okt 2026; audit `user.password_set_by_hr` tanpa nilai, notifikasi `account.password_set_by_hr`); opsi `users.password_change_required` → `EnsurePasswordChanged` mengarahkan semua halaman ke Pengaturan › Keamanan sampai diganti.
- **Lupa kata sandi dengan persetujuan HR** (`routes/password-reset.php`, `/lupa-sandi`): `RequestPasswordReset` (timebox 400 ms, baris `password_reset_requests` hanya untuk karyawan aktif, token permintaan acak di sesi — DB menyimpan hash SHA-256, permintaan lama dibatalkan) → notifikasi "Perlu tindakan" `account.password_reset_requested` ke HR (permintaan Super Admin ke Super Admin lain; tanpa HR aktif → Super Admin) → halaman tunggu mem-polling `GET /lupa-sandi/status` (`{status}` saja; email tak dikenal & permintaan yang digantikan selalu `pending` lalu `expired` setelah 24 jam) → `DecidePasswordReset` (HR, alasan wajib saat menolak, audit, notifikasi diselesaikan) → status `approved` menerbitkan setup token sekali pakai ke sesi yang sama (30 menit) → `CompletePasswordReset` (sandi baru, semua sesi lain keluar, audit `user.password_reset_completed`) → login otomatis (Super Admin ber-TOTP diarahkan ke login agar kode tetap diminta). Job `ExpirePasswordResetRequests` (tiap jam) mengedaluwarsakan permintaan & menghapus yang selesai > 90 hari. Alur reset tautan email Fortify dihapus.
- Rate limit: login kata sandi 10/menit/IP (+5/menit per email+IP); lupa sandi 5/menit/IP + 5/jam per email, cek status 30/menit per permintaan, simpan sandi baru 6/menit/IP; ubah sandi sendiri 6/menit; HR atur sandi 20/menit; callback login Google (ditahan) 60/menit/IP + 10/menit per sesi; check-in 6/menit/user, API umum 120/menit. IP klien dibaca di belakang proxy tepercaya (`TRUSTED_PROXIES`, default rentang privat).
- Sesi: cookie `SESSION_SECURE_COOKIE=true` (wajib di produksi, HTTPS). Middleware `AuthenticateSession` aktif: sesi menyimpan hash sandi, jadi setiap penggantian sandi (sendiri, oleh HR, atau lupa sandi) mengeluarkan perangkat lain pada request berikutnya; ganti sendiri memanggil `logoutOtherDevices` (perangkat ini tetap masuk), HR & lupa sandi juga merotasi `remember_token` (`SessionTerminator`).
- Header keamanan dipasang **aplikasi** (`SecurityHeaders`, `config/security.php`) agar berlaku di balik proxy apa pun: HSTS (produksi), CSP ketat dengan nonce (izinkan domain Google untuk Picker, OAuth, pratinjau Drive, avatar), `Permissions-Policy` dasar hanya `geolocation=(self), camera=(self)` — `microphone=()` dan `display-capture=()` ditolak, dan keduanya hanya diberikan di dokumen rapat video `/rapat/{id}/gabung` & `/rapat/{id}/ruang` (`permissions_policy_meetings`, audit R-14; `EnsureFullPageLoad` memaksa navigasi Inertia ke dua rute itu jadi muat ulang penuh); `connect-src` menambah server LiveKit dari `LIVEKIT_URL`. Caddy menambah header dasar hanya bila belum ada. Checklist: `docs/security/ASVS-L1.md`.
- Selfie: disk privat, URL bertanda tangan 5 menit, job bulanan menghapus selfie lebih lama dari retensi.
- Token Google: cast `encrypted`. `APP_KEY` dirotasi dengan `APP_PREVIOUS_KEYS`.
- Persetujuan (UU PDP): layar persetujuan saat pertama kali check-in, versi kebijakan tercatat, karyawan dapat melihat data absensinya sendiri dan meminta ekspor.
- Privasi › Data Saya (Sprint 10, `/privasi`, `App\Domain\Privacy`): setiap karyawan aktif (Gate `viewOwnData`) melihat dan mengunduh (Excel/PDF) **hanya datanya sendiri** — profil (NIK selalu tersamar), riwayat persetujuan lokasi & selfie, seluruh absensi & log (termasuk koordinat dan data teknis, tanpa gambar selfie), pengajuan, dan keputusan persetujuan. Query selalu memakai id pengguna yang login (`MyData`); setiap ekspor diaudit (`privacy.data_exported`). Mencabut persetujuan (`RevokeAttendanceConsent`, dari Absensi atau Data Saya) menolak check-in GPS + selfie sampai disetujui lagi dan mengirim notifikasi `attendance.consent_revoked` ke HR perusahaan.
- Kebijakan privasi berversi: teks Markdown di `resources/markdown/privacy-policy.md` (diisi placeholder, HTML mentah di-escape), versi & tanggal di `config/privacy.php` (`PRIVACY_POLICY_VERSION`); versi persetujuan absensi mengikutinya (kecuali `ATTENDANCE_CONSENT_VERSION` diisi). Halaman publik `/kebijakan-privasi` (ditaut dari login) dirender dari templat Blade `resources/views/privacy/public.blade.php` (tamu) dan dari Markdown (karyawan masuk + API ponsel); ubah keduanya bersama, plus `resources/js/pages/attendance/privacy-policy.tsx` dan layar persetujuan (web `consent-content.tsx`, ponsel `app/absensi/persetujuan.tsx`). **Versi 2.0 (14 Okt 2026)** menambah: selfie bercap + lokasi dikirim ke grup WhatsApp perusahaan (di luar kendali aplikasi setelah terkirim, di luar retensi selfie), ubin peta OpenStreetMap lewat proxy server untuk Android (ponsel tidak menghubungi OSM) dan koordinat ke Nominatim dari server untuk nama tempat pada foto bercap di luar kantor, serta penyimpanan offline terenkripsi (SQLCipher) di ponsel termasuk antrean selfie/GPS/lampiran. Menaikkan versi memicu persetujuan ulang lokasi & selfie; versi/tanggal produksi diatur di `.env` server (`PRIVACY_POLICY_VERSION`, `PRIVACY_POLICY_DATE`).
- CSP `img-src` mengizinkan `https://tile.openstreetmap.org` (peta Leaflet di layar gagal check-in & pengaturan lokasi). Mini-map kartu Absensi berupa sketsa SVG tanpa tile (ringan di 4G).

## 6. Deploy

### compose.prod.yml (layanan)
| Layanan | Image | Catatan |
|---|---|---|
| `caddy` | caddy:2 | TLS otomatis, reverse proxy ke `app:8000` & `reverb:8080` (`/app`, `/apps`) |
| `app` | image aplikasi (`Dockerfile`, FrankenPHP mode klasik, Debian) | `php artisan optimize` saat start (entrypoint), user non-root |
| `queue` | image aplikasi | `php artisan horizon` |
| `scheduler` | image aplikasi | `php artisan schedule:work` |
| `reverb` | image aplikasi | `php artisan reverb:start --host=0.0.0.0 --port=8080` |
| `postgres` | `docker/postgres/Dockerfile` (postgres:17-alpine + pgBackRest) | volume persisten, tidak diekspos ke publik; `archive_mode=on`, `archive_timeout=60` → WAL ke object storage bila `PITR_ENABLED=true` |
| `redis` | redis:7 | `appendonly yes` |
| `pitr` | image `postgres` yang sama | pgBackRest: full Minggu / diff harian 01:30 WIB, retensi 4 full + 7 diff, `wal-check` tiap 10 menit (`scripts/pitr.sh`, `wal-check.sh`, `pitr-restore.sh`, `docs/deploy/PITR.md`) |
| `backup` | `docker/backup/Dockerfile` (postgres:17-alpine + rclone + supercronic) | 02:00 WIB, unggah ke object storage, retensi 30 hari (`scripts/backup.sh`, `scripts/restore.sh`) |

### Ukuran VPS
Puluhan pengguna: **4 vCPU / 8 GB RAM / 80–100 GB SSD** sudah lega. Pantau dengan Laravel Pulse. Skala vertikal bila CPU rata-rata > 60%.

### CI/CD (GitHub Actions)
1. `lint` → Pint, Larastan, ESLint, `tsc --noEmit`
2. `test` → Pest dengan service Postgres & Redis
3. `build` → image Docker (multi-stage, aset Vite di-build), push ke GHCR
4. `deploy` (`.github/workflows/deploy.yml`, setelah CI hijau di `main`, approval environment `production`) → SSH ke VPS → `scripts/deploy-remote.sh`: `docker compose pull && up -d --wait` → `php artisan migrate --force` → `db:seed` (peran) → `php artisan horizon:terminate` → cek `/health`

### Runbook singkat
- **Pulihkan DB ke titik waktu (RPO ±1 menit):** `pitr-restore --time "...+07"`, langkah di `docs/deploy/PITR.md` §5. Dari dump harian: `docker compose -f compose.prod.yml exec backup restore.sh --latest --yes` (setelah menghentikan app/queue/scheduler/reverb). Uji bulanan: `restore.sh --latest --target ruangkerja_restore_test --create --compare ruangkerja --drop-after` (README §Backup).
- **Reverb mati:** aplikasi tetap jalan (polling fallback 30 detik di board). Restart layanan `reverb`.
- **Google API error 403 rate limit:** job otomatis retry. Cek kuota di Cloud Console.

## 7. Keputusan arsitektur (ADR ringkas)

| # | Keputusan | Alasan | Alternatif ditolak |
|---|---|---|---|
| 1 | Laravel + Inertia React (monolit) | Tim kecil, satu repo, cepat dikembangkan | SPA + API terpisah (dua kali kerja), Next.js (Anda ingin Laravel) |
| 2 | PostgreSQL | `jsonb`, full-text search, `FILTER`, partial index | MySQL |
| 3 | ULID sebagai PK | Aman di URL, urut waktu, siap sinkron mobile offline | auto-increment |
| 4 | File di Google Shared Drive | Kuota 2 TB sudah ada, kepemilikan organisasi, kolaborasi Docs native | Simpan file sendiri |
| 5 | Selfie di object storage privat, bukan Drive | Data pribadi, perlu retensi & kontrol akses ketat | Drive |
| 6 | Dokumen formal = Google Docs. Catatan ringan = Tiptap/Yjs (F2) | Membangun editor setara Docs terlalu mahal | Editor sendiri penuh |
| 7 | Reverb untuk realtime | Bawaan Laravel, gratis, self-hosted | Pusher (berbayar), Socket.io terpisah |
| 8 | Metrik output tanpa skor gabungan | Mencegah manipulasi & konflik | "Skor produktivitas" |
| 9 | WhatsApp di balik antarmuka channel | Provider belum diputuskan | Mengunci ke satu provider |
| 10 | Rapat video = LiveKit sendiri + layar React di RuangKerja (`@livekit/components-react`, hook saja, gaya Arus) | Tanpa biaya per menit/kuota, terpadu dengan Rapat & Notulensi (kehadiran otomatis), media tidak lewat VPS aplikasi | La Suite Meet (aplikasi terpisah, perlu OIDC), Jitsi (rekaman berat), Google Meet (ditahan) |
