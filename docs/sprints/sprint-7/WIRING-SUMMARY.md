# Sprint 7 (bagian B) — Penyambungan Google Drive ke workspace · Ringkasan

Cabang `feat/sprint-7-drive-wiring` (di atas `main`: Sprint 0, 1, 2, 4, 5, 7A, 8, 10A). Rencana: [`WIRING-PLAN.md`](WIRING-PLAN.md). API bagian A: [`GOOGLE-API.md`](GOOGLE-API.md).

## Acceptance criteria

| # | Kriteria (brief bagian B / PROMPTS.md Sprint 7) | Status |
|---|---|---|
| 1 | `Workspace implements HasDriveFolder`; `WorkspaceDriveAccess` berbasis `WorkspacePolicy`; FK `drive_files.workspace_id → workspaces` (nullable, null on delete) + DATABASE.md | ✓ kunci `workspaces:<id>`, nama `"<Nama> [KEY]"` (pribadi: `"Pribadi · <Nama pemilik> [KEY]"`), anggota aktif → writer/reader. `WorkspacePolicyDriveAccess`: view = `canView`, contribute = `canEditTasks` (member+, tidak diarsipkan), manage = `canManage` & tidak diarsipkan; `constrainVisible` = `Workspace::visibleTo()`. Migrasi `2026_10_06_100000_link_drive_files_to_workspaces` (bisa rollback) |
| 2 | Listener `WorkspaceCreated` → `CreateDriveFolder` (pribadi saat pertama dipakai), `WorkspaceMembersChanged` → `SyncDrivePermissions`, ganti nama/key → ganti nama folder; no-op bila Google belum dikonfigurasi | ✓ `app/Listeners/Workspaces/*` (auto-discovery) + hook `Workspace::updated` di `WorkspaceServiceProvider`. Bila Drive nonaktif tidak ada job yang diantrekan; UI menampilkan "Integrasi Google Drive belum aktif" |
| 3 | Tab **File**: daftar dari cache (sinkron antrean bila > 5 menit), breadcrumb sub-folder, unggah resumable ≤ 100 MB dengan progres, "Buka di Drive", pratinjau iframe, Picker, keadaan kosong/belum dikonfigurasi/hubungkan ulang, unggah dari kamera/galeri di mobile | ✓ desktop (tabel, urutkan, cari, seret-lepas, panel pratinjau, "Dipakai di tugas") & mobile (kartu folder, chip jenis, sheet "Tambah ke KEY": Docs/Sheets/Slides, Unggah dari ponsel, Ambil foto dokumen, Pilih dari Drive, Folder baru). Hubungkan ulang ditangani `DrivePicker`/`useDrivePicker` (dialog/sheet "Hubungkan akun Google") |
| 4 | Tab **Dokumen**: daftar Docs/Sheets/Slides + "Dokumen baru" (sinkron, 10 dtk) dibuka di Google | ✓ tab baru dibuka saat klik lalu diarahkan ke dokumen (lolos pemblokir popup) |
| 5 | Pengaturan › Anggota: status "Akses Drive" per anggota (tersinkron/menunggu/gagal), info sumber tetap ada | ✓ kolom "Akses Drive" menggantikan "Sumber"; sumber ("Sinkron divisi/tim" / "Diundang") pindah ke baris kedua nama. Bagian baru **Integrasi Drive** (folder, ringkasan akses, "Buka di Drive", "Sinkronkan ulang" untuk admin). Mobile: status di bawah peran |
| 6 | Provider pencarian "Dokumen" di `config/search.php`, lewat `WorkspaceDriveAccess` | ✓ `DocumentSearchProvider` (`documents`), Docs/Sheets/Slides didahulukan, folder tidak ditampilkan, membuka Google di tab baru |
| 7 | `features/drive/attachments-panel.tsx` + endpoint generik untuk lampiran (task/komentar) | ✓ lihat §Lampiran. Belum dipasang di TaskSheet (Sprint 6 paralel) |
| T | Test dengan FakeDriveClient | ✓ lihat §Test |
| UI | Desktop + mobile, terang & gelap | ✓ dicek di 1440 (gelap & terang) dan 375 (gelap) dengan `GOOGLE_FAKE=true` |

## Desain teknis

### Status "Akses Drive" per anggota
- Kolom baru `workspace_members.drive_access` (peran Drive yang terakhir **dikonfirmasi** sinkron: `writer`/`reader`), `drive_error`, `drive_synced_at` (migrasi `2026_10_06_100100_…`, DATABASE.md §4).
- Job bagian A kini mengirim event `DrivePermissionsSynced` (+ anggota yang diinginkan & `PermissionSyncResult`) dan `DrivePermissionsSyncFailed` (gagal permanen). Listener Workspaces menulis kolom lewat query builder (`updated_at` tidak berubah).
- Status dihitung (`DriveAccessStatus::resolve`): **Drive belum aktif** → **Akun nonaktif** → **Gagal sinkron** (`drive_error`) → **Tersinkron** (bila `drive_access` = peran saat ini: owner/admin/member → writer, viewer → reader) → selain itu **Menunggu sinkron**. Tidak bergantung waktu, jadi favorit/kolom lain tidak memengaruhi status. Alasan `elevated_role` (izin organizer dari admin Drive) dianggap tersinkron.
- Ringkasan folder (`WorkspaceDriveStatus::summary`): `disabled | preparing | unused (pribadi) | error | pending | synced` → lencana "Akses tersinkron · 9 anggota".

### Unggah bertahap browser → server (resumable)
- Herd macOS memakai `upload_max_filesize=post_max_size=2M`, jadi file ≤ 100 MB dikirim per potongan. `DriveUploadSessions::chunkBytes()` = min(batas PHP) − 128 KiB, antara 256 KiB dan `google.upload.chunk_bytes` (8 MiB).
- `POST /w/{KEY}/file/unggah` atau `POST /lampiran/{type}/{id}/unggah` → sesi (`StartDriveUpload`, cache 24 jam, file sementara privat di disk `local`); `POST /unggah/{id}` (offset + chunk, `AppendDriveUploadChunk`) → 409 + `received` bila offset tidak cocok (klien melanjutkan dari situ; galat jaringan dicoba ulang 3×); potongan terakhir mengantrekan `UploadToDrive` (kini menerima `folderId` sub-folder); `GET /unggah/{id}` dipoll sampai `done/failed`; `DELETE /unggah/{id}` membatalkan. Sesi hanya untuk pengunggahnya (lainnya 404).
- Progres per file (persen, "2,1 dari 3,3 MB · sekitar 6 detik lagi", "Menyimpan ke Google Drive…") di panel mengambang (`UploadProgressList`).
- `ruangkerja:drive-uploads:prune` (jadwal 03.10) menghapus file sementara yang ditinggalkan > 24 jam.

### Tab File/Dokumen
- Hanya membaca `drive_files` lewat `DriveFile::visibleTo()`; Google tidak pernah dipanggil di request GET. `RefreshWorkspaceDrive` mengantrekan `SyncDriveFolderContents` bila tingkat folder > 5 menit ("Muat ulang" memaksa) dan `CreateDriveFolder` bila workspace bersama belum punya folder (dibuat sebelum Drive dikonfigurasi). Halaman mem-poll (2,5 dtk, maks. 10×) selama `drive.syncing`.
- Sub-folder: `?folder=<google id>` hanya diterima bila folder tercatat milik workspace (selain itu 404). Breadcrumb dari rantai `parent_google_id`.
- File hasil Picker ("Pilih dari Drive") dicatat ke workspace dan tampil di akar dengan label **Ditautkan**; file tetap di tempatnya di Drive (akses mengikuti berbagi Drive pemiliknya).
- "Folder baru" (`CreateDriveSubfolder`) sinkron 10 dtk seperti "Dokumen baru" karena pengguna langsung membuka folder itu — keputusan yang memperluas pengecualian AGENTS.md.
- Lencana tab "Dokumen 6 · File 24" (`drive_counts` di `WorkspacePage`).

### Lampiran (untuk TaskSheet Sprint 6)
Komponen siap pakai, mandiri (memuat datanya sendiri lewat JSON):

```tsx
import { AttachmentsPanel } from '@/features/drive/attachments-panel';

<AttachmentsPanel attachableType="task" attachableId={task.id} />
// opsional: canEdit={false} (paksa baca-saja), title="Lampiran", onChange={(count) => …}
```

Endpoint (`routes/drive.php`, `AttachmentController`, semua JSON):

| Metode & path | Aksi | Otorisasi |
|---|---|---|
| `GET /lampiran/{type}/{id}` | daftar `attachments` (+ `can_remove`), `can_edit`, info `drive` | `view` induk (404) |
| `POST /lampiran/{type}/{id}/drive` `{file_ids[]}` | `AttachDriveFile` (Picker) | `AttachmentPolicy::create` (= `update` induk, 403) |
| `POST /lampiran/{type}/{id}/dokumen` `{type, name}` | `CreateGoogleDoc` + lampirkan, balikan `web_view_link` | idem |
| `POST /lampiran/{type}/{id}/unggah` `{name, size, mime_type}` | sesi unggah bertahap → `UploadToDrive` melampirkan | idem |
| `DELETE /lampiran/{attachment}` | `RemoveAttachment` (soft delete, file Drive tetap) | `view` lampiran (404), `delete` (403) |

Untuk **komentar** (Sprint 6): (1) `Comment implements App\Domain\Workspaces\Contracts\HasWorkspaceAttachments` dengan `attachmentWorkspace()` = workspace tugas induknya, plus relasi `attachments()` (`morphMany(Attachment::class, 'attachable')`) seperti di `Task`; (2) pastikan `CommentPolicy` punya `view` dan `update`; (3) tambahkan `'comment' => Comment::class` di `App\Domain\Workspaces\Support\AttachableTypes::MAP`; (4) pasang `<AttachmentsPanel attachableType="comment" attachableId={comment.id} />`. File masuk ke akar folder workspace.

## Cara mencoba manual
1. Di worktree: `GOOGLE_FAKE=true` di `.env`, `php artisan migrate`, jalankan worker antrean (`composer run dev` atau `php artisan queue:work`).
2. Masuk **Dimas Pratama (kadiv@demo.test)** → Proyek Peluncuran Q4 › **File**: folder dibuat otomatis (Drive palsu) → "Dokumen baru" › Folder/Docs, **Unggah** file > 2 MB (progres per potongan), klik nama file → panel pratinjau, "Muat ulang".
3. Tab **Dokumen**: "Dokumen baru" › Google Sheets → toast (mode palsu tidak membuka tab).
4. **Pengaturan**: kolom "Akses Drive" + bagian "Integrasi Drive" › "Sinkronkan ulang". Undang anggota → "Menunggu sinkron" sampai worker jalan → "Tersinkron".
5. Mobile 375 px: tab File → tombol + → sheet "Tambah ke PLQ" (Ambil foto dokumen membuka kamera di ponsel).
6. ⌘K: ketik nama dokumen → grup **Dokumen**.
7. Tanpa `GOOGLE_FAKE` dan tanpa kredensial: tab File/Dokumen menampilkan "Integrasi Google Drive belum aktif" (Admin Sistem juga melihat nama env yang kurang).

## Test
- Pest: **1355 hijau** (`pest --parallel --processes=2`; dengan 4 proses sebagian test gagal acak karena Postgres bersama "out of shared memory / max_locks_per_transaction" saat `migrate:fresh` — lingkungan, bukan kode). Baru: `tests/Feature/Workspaces/WorkspaceDriveWiringTest.php` (11), `WorkspaceDriveEndpointsTest.php` (23), `tests/Feature/Search/DocumentSearchTest.php` (1): folder dibuat saat workspace dibuat & tidak untuk pribadi sampai dipakai, izin saat tambah/keluar/ubah peran, idempoten (sinkron kedua tanpa tulis), status menunggu/gagal/tersinkron, ganti nama folder, mode tidak dikonfigurasi (tanpa job, 503 ramah), matriks akses (viewer/member/owner/Direksi/Super Admin/pribadi/diarsipkan), non-anggota 404 untuk daftar/pratinjau/semua endpoint, viewer 403 untuk menambah, folder asing 404, unggah bertahap ke sub-folder + isi byte identik, batas 100 MB, 409 resume, sesi privat & batal, prune, dokumen baru, folder baru, tautkan Picker, lampiran (dokumen/unggah/Picker/lepas/otorisasi), pencarian Dokumen sesuai akses, regresi cache Redis.
- Test bagian A disesuaikan dengan FK baru (factory/fixture memakai workspace nyata; test fail-closed mengikat `DenyWorkspaceDriveAccess` secara eksplisit).
- Vitest: **212 hijau** (baru: `chunked-upload.test.ts` 7, `file-list.test.ts` 3, `attachments-panel.test.tsx` 4).
- `composer lint` (Pint + Larastan 8), `npm run typecheck`, `npm run lint` bersih. Migrasi diuji rollback → migrate.

## Keputusan
1. Status akses per anggota disimpan di `workspace_members` (3 kolom) dan dibandingkan dengan peran saat ini, bukan stempel waktu.
2. Unggahan browser dipotong sesuai batas PHP agar 100 MB jalan tanpa mengubah php.ini/nginx; potongan dikirim ke server kita (bukan langsung ke Google) supaya token service account tidak pernah ke browser.
3. "Folder baru" sinkron (10 dtk) seperti "Dokumen baru".
4. File Picker di tab File = "Ditautkan" (dicatat, tidak dipindah/dibagikan).
5. Workspace bersama tanpa folder dipulihkan otomatis saat tab File/Dokumen dibuka.
6. Endpoint lampiran generik dengan alias tipe (`AttachableTypes`) agar Sprint 6 cukup menambah satu baris.
7. Bug bagian A diperbaiki: `DriveFolderContentsSync::isStale()` selalu "basi" di Redis (angka dikembalikan sebagai string); kunci cache sesi unggah dibedakan dari kunci sesi resumable `ResumableUploader`.

## Paket baru
Tidak ada.

## Sisa pekerjaan / risiko
- `AttachmentsPanel` belum dipasang di TaskSheet & komentar (menunggu Sprint 6; langkah di §Lampiran).
- Belum diuji dengan Google sungguhan (tanpa kredensial); Picker sungguhan belum dicoba.
- Arsip workspace belum memindahkan folder ke arsip Drive (teks mockup Zona bahaya) — di luar brief.
- Direksi/semua karyawan (workspace internal) bisa melihat metadata file, tetapi membuka file di Google butuh izin Drive (hanya anggota yang disinkronkan).
- `drive_files.google_file_id` unik global (bagian A): file yang sama ditautkan di workspace lain tetap milik workspace pertama (toast memberi tahu).
- Penunjuk "Dipakai di tugas" menaut ke `/w/KEY?q=KEY-n` (pencarian board) sampai TaskSheet punya URL sendiri.
