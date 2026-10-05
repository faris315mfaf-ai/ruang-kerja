# Sprint 7 bagian B — Rencana penyambungan Google Drive ke workspace

Cabang `feat/sprint-7-drive-wiring`. Memakai API bagian A (`GOOGLE-API.md`).

## Backend
1. **Kontrak**: `Workspace implements HasDriveFolder` (kunci `workspaces:<id>`, nama `"<Nama> [KEY]"`, anggota aktif → writer/reader). `WorkspacePolicyDriveAccess` (scoped binding) di `WorkspaceServiceProvider` menggantikan `DenyWorkspaceDriveAccess`.
2. **Migrasi**
   - `drive_files.workspace_id` → nullable + FK `workspaces` `nullOnDelete`.
   - `workspace_members`: `drive_access` varchar(10) null (peran Drive yang terakhir dikonfirmasi sinkron: `writer`/`reader`), `drive_error` varchar(100) null, `drive_synced_at` timestamptz null → status "Akses Drive" per anggota (tersinkron / menunggu / galat / nonaktif) tanpa bergantung `updated_at`.
3. **Listener** (`App\Listeners\Workspaces\…` didaftarkan di `WorkspaceServiceProvider`):
   - `WorkspaceCreated` → `CreateDriveFolder` (bukan pribadi) bila Drive aktif.
   - `WorkspaceMembersChanged` → `SyncDrivePermissions` bila folder sudah ada.
   - `Workspace::updated` (nama/key berubah, folder ada) → `CreateDriveFolder` (ganti nama).
   - Event baru `DrivePermissionsSynced` (dikirim job bagian A setelah sinkron) → tulis status per anggota.
   - `DriveFileUploaded`/`DriveUploadFailed` → status sesi unggah.
4. **Unggah bertahap browser → server** (php.ini Herd membatasi 2 MB per request): sesi (`StartDriveUpload`) + potongan (`AppendDriveUploadChunk`, ukuran potongan dihitung dari `upload_max_filesize`/`post_max_size`), file sementara di disk `local`, setelah lengkap → `UploadToDrive` (ditambah parameter folder tujuan). Bisa dilanjutkan (offset dari server), batas 100 MB, status `receiving → processing → done/failed` dipoll klien.
5. **Tab File**: `GET /w/{KEY}/file?folder=` — daftar dari cache `drive_files` (folder dulu, lalu nama), breadcrumb dari rantai `parent_google_id`, sinkron di antrean bila > 5 menit (klien mem-poll selama sinkron), folder belum ada → `CreateDriveFolder` (bukan pribadi), "Dipakai di tugas" dari `attachments`. Aksi: folder baru (sinkron 10 dtk, seperti dokumen baru), unggah, lampirkan dari Drive (Picker → `drive_files` workspace, tampil sebagai "Ditautkan"), hapus catatan (bukan file Drive).
6. **Tab Dokumen**: Docs/Sheets/Slides workspace + `POST /w/{KEY}/dokumen` (sinkron, `CreateGoogleDoc`) → JSON `web_view_link` dibuka di tab baru.
7. **Pengaturan › Anggota**: kolom "Akses Drive" menggantikan "Sumber" (info sumber pindah ke baris nama: "Sinkron divisi"/"Diundang"); bagian "Integrasi Drive" (status folder, buka di Drive, sinkronkan ulang untuk admin).
8. **Pencarian**: `DocumentSearchProvider` (`documents`, "Dokumen") lewat `DriveFile::visibleTo()`.
9. **Lampiran generik** (`/lampiran/{type}/{id}`): daftar, Picker, dokumen baru, unggah (sesi yang sama), lepas. Peta tipe `AttachableTypes` (`task` sekarang; Sprint 6 menambah `comment`). Komponen `features/drive/attachments-panel.tsx`.

## Frontend
- `pages/workspaces/files.tsx` (desktop tabel + panel pratinjau; mobile daftar + chip jenis + bottom sheet "Tambah ke KEY" + kamera/galeri), `pages/workspaces/documents.tsx`.
- `features/drive/`: `use-chunked-upload.ts` (+ test), `upload-toast.tsx`, `new-document-menu.tsx`, `drive-status-badge.tsx`, `attachments-panel.tsx`.

## Test (Pest, FakeDriveClient)
Folder dibuat saat workspace dibuat (pribadi tidak sampai dipakai), sinkron izin saat tambah/keluar/ubah peran, idempotensi, status Akses Drive, ganti nama folder, akses ditolak (list/preview/endpoint), batas 100 MB & potongan, dokumen baru, mode tidak dikonfigurasi, pencarian Dokumen, lampiran generik.

## Risiko
- Sprint 6 (TaskSheet) paralel menyentuh `Task` → perubahan di `Task` minimal (interface + relasi `attachments`).
- Picker tidak bisa diuji di mode palsu (sesuai bagian A).
