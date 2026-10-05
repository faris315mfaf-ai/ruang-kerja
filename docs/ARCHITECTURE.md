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

### 3.3 Tutup hari (scheduler, 00:30 waktu kantor)
`CloseDay` untuk tanggal kemarin: setiap karyawan aktif yang terjadwal → bila tidak ada log dan tidak ada pengajuan disetujui → `absent`. Check-in tanpa check-out → `needs_correction` + notifikasi. Idempoten (aman dijalankan ulang).

### 3.4 Approval
`SubmitRequest` → `ApprovalFlowResolver` membuat baris `request_approvals` untuk langkah yang kondisinya terpenuhi, meresolusi penyetuju (atasan langsung, kepala divisi, peran, user, dengan delegasi) → langkah pertama `waiting`. `ApproveStep` memajukan langkah. Langkah terakhir disetujui → status `approved` → efek samping: kurangi saldo cuti, tulis `attendance_days` status cuti/izin/sakit/dinas, tambah `overtime_minutes`, atau terapkan koreksi. Semua dalam transaksi + audit log.

Aturan: pemohon tidak bisa menyetujui pengajuannya sendiri. Jika penyetuju = pemohon (mis. Kadiv tanpa atasan), langkah otomatis naik ke peran berikutnya.

### 3.5 Task realtime
- Pindah kartu: optimistic update di klien → `PATCH /tasks/{id}/move` (status_id, position lexorank di antara dua kartu) → event `TaskMoved` broadcast di private channel `workspace.{id}` → klien lain memperbarui board.
- Penomoran task: `UPDATE workspaces SET task_sequence = task_sequence + 1 … RETURNING` di dalam transaksi.
- Komentar: simpan JSON Tiptap → `MentionParser` mengambil node mention → `mentions` + notifikasi.

### 3.6 Google Drive
- **Folder workspace:** saat workspace dibuat, job `CreateDriveFolder` (service account, impersonasi admin) membuat folder di Shared Drive, simpan `drive_folder_id`.
- **Sinkron izin:** anggota ditambah/dihapus → job `SyncDrivePermissions` menambah/mencabut izin `writer`/`reader` per email di folder tersebut. Idempoten, retry eksponensial, catat error di log.
- **Dokumen baru:** `DocCreator` membuat file Docs/Sheets/Slides di folder workspace → simpan `drive_files` → kembalikan `webViewLink`.
- **Lampirkan dari Drive:** Google Picker di klien memakai token OAuth pengguna (scope `drive.file`) → kirim `fileId` ke server → server mengambil metadata → `drive_files` + `attachments`.
- **Unggah:** unggah resumable langsung dari server ke folder workspace (batas 100 MB per file di Fase 1).
- Pratinjau di aplikasi memakai URL `…/preview` dalam iframe untuk file Google.

## 4. Otorisasi

| Lapisan | Mekanisme |
|---|---|
| Peran global | `spatie/laravel-permission` (`super_admin`, `direksi`, `hr`, `kepala_divisi`, `anggota`) |
| Cakupan data | Policy + query scope: `Attendance::visibleTo($user)` → diri sendiri; bawahan langsung; divisi bila Kadiv; semua bila HR/Direksi/Super Admin |
| Workspace | `WorkspacePolicy` membaca `workspace_members.role` + aturan visibilitas. Direksi: lihat semua non-pribadi. Workspace pribadi hanya pemilik (bahkan Super Admin tidak bisa membaca isi) |
| Data sensitif | Melihat selfie membutuhkan izin `attendance.view_selfie` (HR & atasan langsung) dan **selalu** dicatat `audit_logs` |
| Broadcast | `routes/channels.php` memakai Policy yang sama |

Uji wajib: setiap Policy punya test matriks peran × aksi.

## 5. Keamanan & privasi

- Sesi cookie `HttpOnly`, `Secure`, `SameSite=Lax`. CSRF untuk semua POST.
- Rate limit: login kata sandi 10/menit/IP (+5/menit per email+IP); callback login Google 60/menit/IP + 10/menit per sesi (puluhan karyawan berbagi NAT kantor); check-in 6/menit/user, API umum 120/menit. IP klien dibaca di belakang proxy tepercaya (`TRUSTED_PROXIES`, default rentang privat).
- Sesi: cookie `SESSION_SECURE_COOKIE=true` (wajib di produksi, HTTPS). Middleware `AuthenticateSession` aktif; mengganti kata sandi (Super Admin) memanggil `logoutOtherDevices` sehingga perangkat lain keluar pada request berikutnya.
- Header keamanan dipasang **aplikasi** (`SecurityHeaders`, `config/security.php`) agar berlaku di balik proxy apa pun: HSTS (produksi), CSP ketat dengan nonce (izinkan domain Google untuk Picker, OAuth, pratinjau Drive, avatar), `Permissions-Policy` hanya `geolocation=(self), camera=(self)`. Caddy menambah header dasar hanya bila belum ada. Checklist: `docs/security/ASVS-L1.md`.
- Selfie: disk privat, URL bertanda tangan 5 menit, job bulanan menghapus selfie lebih lama dari retensi.
- Token Google: cast `encrypted`. `APP_KEY` dirotasi dengan `APP_PREVIOUS_KEYS`.
- Persetujuan (UU PDP): layar persetujuan saat pertama kali check-in, versi kebijakan tercatat, karyawan dapat melihat data absensinya sendiri dan meminta ekspor.

## 6. Deploy

### compose.prod.yml (layanan)
| Layanan | Image | Catatan |
|---|---|---|
| `caddy` | caddy:2 | TLS otomatis, reverse proxy ke `app:8000` & `reverb:8080` (`/app`, `/apps`) |
| `app` | image aplikasi (`Dockerfile`, FrankenPHP mode klasik, Debian) | `php artisan optimize` saat start (entrypoint), user non-root |
| `queue` | image aplikasi | `php artisan horizon` |
| `scheduler` | image aplikasi | `php artisan schedule:work` |
| `reverb` | image aplikasi | `php artisan reverb:start --host=0.0.0.0 --port=8080` |
| `postgres` | postgres:17 | volume persisten, tidak diekspos ke publik |
| `redis` | redis:7 | `appendonly yes` |
| `backup` | `docker/backup/Dockerfile` (postgres:17-alpine + rclone + supercronic) | 02:00 WIB, unggah ke object storage, retensi 30 hari (`scripts/backup.sh`, `scripts/restore.sh`) |

### Ukuran VPS
Puluhan pengguna: **4 vCPU / 8 GB RAM / 80–100 GB SSD** sudah lega. Pantau dengan Laravel Pulse. Skala vertikal bila CPU rata-rata > 60%.

### CI/CD (GitHub Actions)
1. `lint` → Pint, Larastan, ESLint, `tsc --noEmit`
2. `test` → Pest dengan service Postgres & Redis
3. `build` → image Docker (multi-stage, aset Vite di-build), push ke GHCR
4. `deploy` (`.github/workflows/deploy.yml`, setelah CI hijau di `main`, approval environment `production`) → SSH ke VPS → `scripts/deploy-remote.sh`: `docker compose pull && up -d --wait` → `php artisan migrate --force` → `db:seed` (peran) → `php artisan horizon:terminate` → cek `/health`

### Runbook singkat
- **Pulihkan DB:** `docker compose -f compose.prod.yml exec backup restore.sh --latest --yes` (setelah menghentikan app/queue/scheduler/reverb). Uji bulanan: `restore.sh --latest --target ruangkerja_restore_test --create --compare ruangkerja --drop-after` (README §Backup).
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
