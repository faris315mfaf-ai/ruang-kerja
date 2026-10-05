# Sprint 7 (bagian A) — Lapisan domain Google · Ringkasan

Cabang `feat/sprint-7-google`, dibangun 5 Okt 2026 paralel dengan Sprint 5. Bagian A menyediakan seluruh lapisan domain Google (konfigurasi, klien, service, job, tabel, policy, OAuth Picker, komponen React, fake, test). Bagian B menyambungkannya ke UI workspace/tugas. Panduan pakai: [`GOOGLE-API.md`](GOOGLE-API.md).

## Acceptance criteria (PROMPTS.md Sprint 7)

| # | Kriteria | Status |
|---|---|---|
| 1 | GoogleClientFactory: service account + DWD, impersonasi; klien per user dari google_accounts (token terenkripsi, refresh otomatis); scope drive.file | ✓ `serviceAccount()` / `forUser()`; refresh di `GoogleUserTokens` (`invalid_grant` → hubungkan ulang); `/google/connect` memakai `include_granted_scopes`. Action `StoreGoogleAccount` siap dipakai login. |
| 2 | `ruangkerja:google-check` | ✓ konfigurasi → kunci SA → token impersonasi → Shared Drive → (`--write`) izin tulis → OAuth/Picker, petunjuk Indonesia, tanpa mencetak rahasia |
| 3 | CreateDriveFolder → folder "<Nama> [KEY]" → drive_folder_id | ✓ job + `DriveFolderService::ensure()` (idempoten, pulihkan folder yatim, buat ulang bila 404, ganti nama). ✗ pemicu `WorkspaceCreated` → bagian B |
| 4 | SyncDrivePermissions (writer/reader, cabut, idempoten, backoff) | ✓ diff izin langsung; 429/403 rate-limit/5xx → backoff (≥ Retry-After); 404 folder → dibuat ulang. ✗ pemicu `WorkspaceMembersChanged` → bagian B |
| 5 | Tab File (cache 5 menit, unggah resumable ≤ 100 MB, pratinjau iframe) | ◐ domain siap (`DriveFolderContentsSync`, `SyncDriveFolderContents`, `QueueDriveUpload` + `UploadToDrive`, `DriveFilePreview`); ✗ halaman tab → bagian B |
| 6 | Tab Dokumen + "Dokumen baru" | ◐ `CreateGoogleDoc`/`DocCreator` (sinkron 10 dtk); ✗ UI → bagian B |
| 7 | Lampiran task & komentar | ◐ tabel `attachments`, `AttachDriveFile`, `RemoveAttachment`, `AttachmentPolicy`, `DrivePicker`, `DriveFileCard`; ✗ tombol di TaskDetail → bagian B |
| 8 | Galat ramah | ✓ `GoogleException` + pesan Indonesia, status `reconnect_required`, halaman Pengaturan › Akun Google |
| AC | Semua test memakai fake Google client | ✓ `GOOGLE_FAKE=true` di phpunit.xml + `Http::preventStrayRequests()` |
| AC | Anggota baru dapat izin; yang keluar kehilangan izin; job aman diulang | ✓ `GoogleJobsTest`, `DrivePermissionSyncTest` |
| AC | User tanpa akses workspace tidak bisa melihat metadata file | ✓ `GooglePoliciesTest` (bawaan menolak semua sampai Workspace mengikat `WorkspaceDriveAccess`) |

## Hasil uji & kualitas
- Pest 435 test hijau (218 di `tests/Feature/Google`); Pint + Larastan level 8 bersih.
- Vitest 60 hijau (22 di `features/drive`); typecheck & `vp check` bersih.
- Migrasi diuji rollback → migrate. Pengaturan › Akun Google dicek di 1440 terang & 375 gelap.

## Cara mencoba manual
1. `php artisan migrate`, `composer run dev`.
2. Masuk **Admin Sistem** → Pengaturan › **Akun Google**: "Integrasi Google Drive belum aktif" + daftar kunci env yang kurang (hanya Super Admin).
3. `php artisan ruangkerja:google-check` → status per langkah; setelah kredensial diisi: `--write`.
4. Tanpa Google: `GOOGLE_FAKE=true` → Drive palsu untuk mencoba service lewat tinker.

## Keputusan
1. Klien Drive v3 tipis berbasis `Http` (bukan google/apiclient), JWT RS256 lewat `openssl_sign`.
2. Kontrak `HasDriveFolder` dan `WorkspaceDriveAccess` (bawaan menolak semua).
3. Skema (DATABASE.md §5): `drive_files.workspace_id` belum ber-FK; tambahan `parent_google_id`; `owner_email`/`added_by` nullable; soft delete `drive_files` & `attachments`; `scopes` text[].
4. Panggilan sinkron (10 dtk) hanya untuk buat dokumen, metadata Picker, refresh token Picker.
5. OAuth Drive terpisah dari login (driver `google-drive`, redirect `/google/connect/callback`).
6. Mode palsu tidak pernah aktif di produksi.

## Paket baru
Tidak ada.

## Sisa pekerjaan — bagian B
1. `Workspace implements HasDriveFolder` + ikat `WorkspaceDriveAccess` berbasis `WorkspacePolicy`.
2. Listener `WorkspaceCreated` → `CreateDriveFolder`; `WorkspaceMembersChanged` → `SyncDrivePermissions`.
3. Migrasi FK `drive_files.workspace_id` → `workspaces`.
4. Tab File, tab Dokumen, lampiran di TaskDetail & komentar.
5. CSP produksi: izinkan apis.google.com, docs.google.com, drive.google.com.

## Risiko
- Belum diuji ke Google sungguhan (tanpa kredensial).
- Picker sungguhan belum diuji (dimock).
- `google_file_id` unik global → file yang sama di dua workspace memakai satu baris cache.
