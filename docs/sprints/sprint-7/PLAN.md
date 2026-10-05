# Sprint 7 (bagian A) — Lapisan domain Google · Rencana

Cabang `feat/sprint-7-google`. Dibangun paralel dengan Sprint 5 (workspace & task), jadi bagian A **tidak** memakai model `Workspace`/`Task`. Semua titik sambung lewat kontrak; bagian B nanti menyambungkan ke UI workspace/task.

## Keputusan utama

| # | Keputusan | Alasan |
|---|---|---|
| 1 | **Klien Drive v3 tipis berbasis `Http` Laravel** (bukan `google/apiclient`) | Hanya ±12 endpoint yang dipakai. `Http::fake()` bekerja langsung (apiclient memakai Guzzle sendiri sehingga butuh MockHandler). Tidak ada paket baru: JWT service account ditandatangani `openssl_sign` (RS256), OAuth pengguna memakai Socialite yang sudah terpasang. apiclient + google/auth + phpseclib menambah beberapa MB walau `apiclient-services` dipangkas. |
| 2 | Kontrak `DriveClient` + `HttpDriveClient` (nyata) + `FakeDriveClient` (uji & mode lokal `GOOGLE_FAKE=true`) | Modul lain cukup memanggil service/job; test mereka bisa menegaskan folder/izin/dokumen di fake. |
| 3 | Kontrak `HasDriveFolder` (+ trait `InteractsWithDriveFolder`) | `Workspace` tinggal mengimplementasikannya di bagian B; job `CreateDriveFolder`/`SyncDrivePermissions`/`UploadToDrive` menerima `Model&HasDriveFolder`. |
| 4 | Kontrak `WorkspaceDriveAccess` untuk policy & `visibleTo` `drive_files` | Model `Workspace` belum ada. Bawaan `DenyWorkspaceDriveAccess` = tolak semua (fail-closed). Bagian B mengikat implementasi berbasis `WorkspacePolicy`. |
| 5 | `drive_files.workspace_id` berupa kolom ULID **tanpa FK** dulu | Tabel `workspaces` belum ada di cabang ini. Bagian B menambah migrasi FK setelah merge Sprint 5. |
| 6 | Kolom tambahan `drive_files.parent_google_id`, `deleted_at` (+ `attachments.deleted_at`); `added_by`, `owner_email` nullable | Sinkron isi folder per tingkat & tidak menghapus file hasil Picker; file di Shared Drive tidak punya pemilik; file yang ditemukan lewat sinkron tidak punya `added_by`. Didokumentasikan di DATABASE.md. |
| 7 | Sinkron izin = **diff keadaan diinginkan vs izin langsung** (tipe `user`) | Tambah yang kurang, ubah peran yang beda, cabut yang bukan anggota. Izin warisan Shared Drive, akun impersonasi, dan `protected_emails` tidak pernah dicabut. |
| 8 | Folder idempoten: id tersimpan → verifikasi; hilang → cari folder yatim lewat `appProperties.rk_owner` → baru buat | Aman diulang walau job mati setelah membuat folder sebelum menyimpan id. Kunci cache mencegah dua job paralel membuat dua folder. |
| 9 | Retry di level job: 429/403 rate-limit/5xx/koneksi → `release()` dengan backoff eksponensial (+ `Retry-After`, jitter, batas); 4xx lain → gagal permanen; Google nonaktif → job selesai tanpa aksi | Sesuai ARCHITECTURE §3.6 & runbook. Log tanpa token. |
| 10 | Panggilan sinkron (timeout 10 dtk) hanya untuk aksi yang ditunggu pengguna: buat dokumen, ambil metadata file Picker, refresh token OAuth untuk Picker | Pengecualian AGENTS.md ("membuat dokumen baru boleh sinkron") diperluas ke dua aksi yang sifatnya sama. Didokumentasikan. |
| 11 | OAuth per pengguna lewat rute terpisah `/google/connect` → callback `/google/connect/callback` (driver Socialite `google-drive`) | Tidak bentrok dengan login Google Sprint 1 (`/auth/google/callback`). Pemilik mendaftarkan dua redirect URI. |
| 12 | Job & service Google di `app/Domain/Google/{Services,Jobs,Actions,...}`; model Eloquent di `app/Models` | Konvensi Sprint 0. |

## Berkas

- `config/google.php`, `.env.example` (`GOOGLE_FAKE`, `GOOGLE_DRIVE_REDIRECT_URI`, `GOOGLE_PICKER_APP_ID` opsional), `phpunit.xml` (`GOOGLE_FAKE=true`).
- `app/Domain/Google/`: `GoogleFeatures`, `Contracts/` (DriveClient, HasDriveFolder, WorkspaceDriveAccess, AccessTokenProvider), `Concerns/` (InteractsWithDriveFolder, HasAttachments), `Data/` (DriveItem, DrivePermission, DriveMember, SharedDrive, UploadProgress, FolderResult, PermissionSyncResult), `Enums/` (DriveRole, DriveFileKind, GoogleDocType, AttachmentSource), `Exceptions/`, `Auth/` (ServiceAccountCredentials, ServiceAccountTokenProvider, UserAccessTokenProvider), `Http/HttpDriveClient`, `Services/` (GoogleClientFactory, GoogleUserTokens, DriveFolderService, DrivePermissionSync, DocCreator, ResumableUploader, DriveFileRecorder, DriveFileImporter, DriveFolderContentsSync, GoogleBackoff), `Jobs/` (CreateDriveFolder, SyncDrivePermissions, UploadToDrive, SyncDriveFolderContents, RevokeGoogleToken, Concerns/HandlesGoogleFailures), `Actions/` (StoreGoogleAccount, DisconnectGoogleAccount, CreateGoogleDoc, QueueDriveUpload, AttachDriveFile, RemoveAttachment), `Events/` (DriveFileUploaded, DriveUploadFailed), `Testing/FakeDriveClient`, `Access/DenyWorkspaceDriveAccess`.
- `app/Casts/PostgresTextArray.php`, `app/Providers/GoogleServiceProvider.php`, `app/Console/Commands/GoogleCheck.php` (`ruangkerja:google-check`).
- Model + factory + policy: `GoogleAccount`, `DriveFile`, `Attachment`.
- HTTP: `routes/google.php`, `Http/Controllers/Google/{GoogleConnectionController, PickerTokenController, GoogleSettingsController}`, `Http/Resources/{DriveFileResource, AttachmentResource}`.
- Frontend `resources/js/features/drive/`: `types.ts`, `drive-files.ts` (+test), `load-google-picker.ts` (+test), `use-drive-picker.ts`, `drive-picker.tsx`, `drive-file-icon.tsx`, `drive-file-card.tsx`, `drive-file-preview.tsx`, `google-connection-card.tsx`; halaman `pages/settings/google.tsx` + entri nav pengaturan "Akun Google".
- Dokumen: `docs/sprints/sprint-7/GOOGLE-API.md`, `SUMMARY.md`, `docs/DATABASE.md` §5.

## Migrasi

`google_accounts` (`scopes text[]`, token `encrypted`), `drive_files`, `attachments` (morph ULID `attachable`). Semua bisa di-rollback.

## Uji (Pest, `tests/Feature/Google`)

Fitur nonaktif · token service account (JWT, impersonasi, cache, galat tanpa token) · HttpDriveClient (bentuk request & pemetaan galat) · fake · DriveFolderService (idempoten, yatim, 404, rename) · DrivePermissionSync (diff, warisan, protected, idempoten, 404) · DocCreator (3 jenis, timeout 10 dtk) · ResumableUploader (chunk, lanjut setelah gagal, >100 MB) · job (backoff 429/403/5xx, gagal permanen 404, no-op nonaktif, log tanpa token, berkas sementara dibersihkan) · OAuth connect/disconnect/picker-token · importer Picker · policy matriks peran × aksi · cast `text[]` & `encrypted` · command google-check. Vitest untuk helper URL/ukuran & pemuat skrip Picker.

## Risiko

- Sprint 1 bisa ikut membuat `google_accounts` → desain tabel dibagikan di GOOGLE-API.md; saat merge pakai satu migrasi saja.
- Belum pernah diuji ke Google sungguhan (tidak ada kredensial). `ruangkerja:google-check` disiapkan untuk pemilik.
