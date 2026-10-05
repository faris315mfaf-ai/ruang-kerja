# Sprint 5 — Ringkasan: Workspace & board Kanban

Cabang `feat/sprint-5-workspace` (digabung dengan `main`: core Sprint 1, Admin Karyawan, Notifikasi/Inbox/Cari, lapisan Google Drive).

## Acceptance criteria (docs/PROMPTS.md Sprint 5)

| # | Kriteria | Status |
|---|---|---|
| 1 | Migrasi + model `workspaces`, `workspace_members`, `task_statuses`, `labels`, `tasks`, `task_assignees`, `task_labels`, `task_watchers`, `checklist_items`, `activities` | ✓ 5 migrasi, bisa di-rollback |
| 2 | Workspace pribadi otomatis; workspace divisi otomatis + `SyncDivisionMembers`; tim & proyek manual | ✓ `WorkspaceServiceProvider` (event User/Division/Team). Tim bisa ditautkan ke `teams` (anggota tersinkron, Ketua Tim = admin) |
| 3 | `WorkspacePolicy` (pribadi hanya pemilik, termasuk Super Admin) + test matriks peran | ✓ matriks 9 aktor × 4 workspace × 6 ability + `TaskPolicy` |
| 4 | Sidebar: workspace dikelompokkan Pribadi/Divisi/Tim/Proyek, bisa diciutkan, favorit | ✓ prop bersama `workspaces`; bintang = favorit; grid workspace di tab Menu dari data nyata |
| 5 | Halaman workspace: tab Tugas, Dokumen, File, Aktivitas, Pengaturan | ✓ `/w/{KEY}` + sub-tab; Dokumen & File placeholder untuk Sprint 7 |
| 6a | Buat cepat (tombol + di kolom, pintasan `C`) dan form lengkap | ✓ dialog desktop / bottom sheet mobile. ◐ `start_date` & `estimate_hours` ada di API, belum ada kontrol di form |
| 6b | Nomor KEY-n dengan increment atomik | ✓ `UPDATE … RETURNING` dalam transaksi |
| 6c | Board (dnd-kit, lexorank, optimistic, rollback), List (TanStack), Kalender | ✓ |
| 6d | Filter penanggung jawab, prioritas, label, tenggat, teks | ✓ disimpan di query string |
| 6e | `status_category`, `started_at`, `completed_at` otomatis | ✓ `TaskLifecycle` |
| 7 | Tugas Saya lintas workspace (Terlambat, Hari ini, Minggu ini, Nanti, Tanpa tenggat) | ✓ tab Ditugaskan/Saya amati/Saya buat; mobile chip + geser + FAB |
| 8 | Ikon status/prioritas sesuai DESIGN | ✓ `components/status-icon.tsx`, `components/priority-icon.tsx`, `features/tasks/task-card.tsx` |
| 9 | Activities untuk create, status, assign, tenggat | ✓ + unassign, prioritas, judul, hapus, anggota & pengaturan |
| AC | Board 500 tugas lancar | ✓ 502 tugas → props 263 KB/71 ms, siap ±0,45 s |
| AC | Nomor unik di bawah konkurensi, pindah kartu memperbarui status, viewer tidak bisa mengubah, non-anggota private 404, sinkron divisi | ✓ |

Tambahan: `PATCH /tugas/{id}/move` final (JSON), event `TaskCreated/Updated/Moved/Deleted` + otorisasi channel `workspace.{id}`, `Shift+←/→` memindah kartu dengan "Urungkan", board mobile satu kolom + menu "Pindahkan", `WorkspaceSeeder`, provider pencarian Tugas & Workspace.

## Cara mencoba (`php artisan migrate:fresh --seed`)

1. Masuk sebagai **Dimas Pratama (kadiv@demo.test)**. Sidebar › Workspace: Pribadi, Divisi Operasional, Tim Gudang, Proyek Peluncuran Q4.
2. **Proyek Peluncuran Q4** (`/w/PLQ`): seret kartu; fokus kartu lalu `Shift+→`; `C` untuk tugas baru; coba Filter, List, Kalender.
3. `/tugas`: kelompok tenggat, `J`/`K` + `Enter`.
4. Pengaturan PLQ: ubah key → tautan lama dialihkan; undang anggota; urutan kolom; label; arsip.
5. Hak akses: Rizky (anggota@) member PLQ; Hendra (direksi@) melihat semua workspace non-pribadi, baca-saja; Admin tidak bisa membuka workspace pribadi orang lain (404).
6. Mobile 375 px: board (tab kolom, geser, "Pindahkan", FAB), `/tugas`, Kalender agenda, tab Menu.
7. ⌘K / `/cari`: "landing" atau "PLQ-21".

## Keputusan

- Model di `app/Models`; logika di `app/Domain/{Workspaces,Tasks}`.
- URL workspace memakai key (`/w/OPS`); key lama di `previous_keys` → redirect 301.
- Lexorank = fractional indexing base-62, kolom `position COLLATE "C"`; klien mengirim tetangga, server membaca ulang, mengunci kolom (`FOR UPDATE`) dan menyeimbangkan ulang bila perlu. Tugas baru masuk paling atas kolom.
- Akses: Direksi lihat semua non-pribadi (baca-saja); Super Admin kelola pengaturan workspace bersama; Kepala Divisi melihat proyek berisi anggota divisinya. Tidak terlihat → 404, terlihat tapi tak berhak → 403.
- Pemilik workspace pribadi juga punya baris `workspace_members`; user dihapus permanen → workspace pribadinya ikut dihapus.
- Sinkron anggota: baris `is_synced` mengikuti organisasi; anggota manual tidak disentuh. Perubahan memicu `WorkspaceMembersChanged`; workspace baru memicu `WorkspaceCreated` (untuk Sprint 7).
- Board memuat tugas terbuka + selesai/batal ≤ 30 hari.
- Warna label/kolom/workspace = nama palet (`resources/css/palette.css`, token `--tag-*`), bukan hex.
- Deskripsi disimpan juga sebagai dokumen ProseMirror minimal (siap Tiptap Sprint 6).
- `search_vector` tsvector GENERATED; pencarian ILIKE + rujukan `KEY-n`.

## Paket baru

Tidak ada.

## Test

- Pest 937 hijau (±90 baru): Lexorank (3.000 sisipan acak), penomoran konkuren (4 proses × 12 tugas), Create/Move/UpdateTask, matriks WorkspacePolicy, PersonalWorkspace, SyncDivisionMembers, WorkspaceSettings, WorkspacePages, WorkspaceSeeder, TaskWorkspaceSearch.
- Vitest 148 hijau. Lint, typecheck, build hijau.

## Sambungan untuk sprint berikut

- **Sprint 6**: dengarkan `.task.created|updated|moved|deleted` di `private-workspace.{id}`; ganti `openEdit` di `TaskComposerProvider` dengan TaskSheet. `saved_views`, komentar, mention belum dibuat.
- **Sprint 7**: `Workspace` belum `implements HasDriveFolder`; `drive_folder_id` sudah ada. Pakai `WorkspaceCreated` & `WorkspaceMembersChanged`; isi tab files/documents; tambah FK `drive_files.workspace_id`.
- **Sprint 9**: kolom proyek (`lead_user_id`, `sponsor_user_id`, `start_date`, `target_date`, `project_status`, `health`, `last_update_at`) sudah ada dan diisi seeder untuk PLQ.

## Sisa / risiko

- Form tugas belum punya tanggal mulai & estimasi; sub-tugas & checklist hanya tampil.
- Konfirmasi arsip memakai `window.confirm`.
- Tampilan tablet (rail) belum diverifikasi visual.
