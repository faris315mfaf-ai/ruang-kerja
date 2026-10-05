# Sprint 5 — Rencana: Workspace & board Kanban

Acuan: `docs/PROMPTS.md` blok Sprint 5, PRD M3/M4, DATABASE §4, ARCHITECTURE §3.5 & §4, DESIGN §2/§6/§9, PLATFORM, mockup `Kanban`, `MBoard`, `TugasSaya`, `MTugasSaya`, `KalenderTugas`, `MKalender`, `MTugasBaru`, `WorkspacePengaturan`, `Main`/`MMenu` (daftar workspace).

## Ketergantungan

Tabel organisasi (`companies`, `divisions`, `teams`, kolom organisasi `users`) dibangun Sprint 1 core di cabang `feat/sprint-1-core`. Urutan kerja:
1. Bagian yang tidak butuh core: enum, `Lexorank`, komponen UI (ikon status/prioritas, kartu, board, list, kalender, Tugas saya), palet warna label.
2. Setelah `docs/sprints/sprint-1/CORE.md` ada: merge core, migrasi + model + policy + action + controller + seeder + test.
3. Akhir: merge `main`.

## Skema (DATABASE §4)

Migrasi (timestamp setelah migrasi core `2026_10_05_0006xx`):
- `workspaces` (+ kolom proyek untuk Sprint 9, `task_sequence`, `archived_at`, soft delete). Tambahan: `previous_keys jsonb` (tautan key lama tetap diarahkan, sesuai teks mockup Pengaturan). Indeks unik `(company_id, key)`, unik parsial `owner_id WHERE type='personal'`, unik parsial `division_id WHERE type='division'`.
- `workspace_members` (PK `(workspace_id, user_id)`, `role`, `joined_at`, `is_synced`). Tambahan: `favorited_at` (urutan favorit di sidebar).
- `task_statuses`, `labels`, `tasks` (soft delete, `search_vector` tsvector GENERATED + GIN, kolom `position` ber-collation `"C"` agar urutan lexorank = urutan byte), `task_assignees`, `task_labels`, `task_watchers`, `checklist_items`, `activities`.
- `saved_views`, `comments`, `mentions`, `reactions` → Sprint 6 (di luar scope Sprint 5).

## Backend

- Model di `app/Models` (konvensi yang ada; Sprint 7 merujuk `App\Models\Workspace`): `Workspace`, `WorkspaceMember` (pivot), `TaskStatus`, `Label`, `Task`, `ChecklistItem`, `Activity`.
- Enum: `Workspaces\Enums\{WorkspaceType, WorkspaceVisibility, WorkspaceRole}`, `Tasks\Enums\{TaskStatusCategory, TaskPriority, ActivityEvent}` (label Indonesia).
- Service: `Tasks\Services\Lexorank` (fractional indexing base-62, rebalance bila kunci > 40 karakter), `Tasks\Services\TaskPositioner`, `Workspaces\Services\WorkspaceKeyGenerator`.
- Action (satu `handle()`): `CreateWorkspace`, `EnsurePersonalWorkspace`, `CreateDivisionWorkspace`, `SyncDivisionMembers`, `SyncTeamMembers`, `UpdateWorkspace`, `ArchiveWorkspace`, `ToggleWorkspaceFavorite`, `AddWorkspaceMember`, `UpdateWorkspaceMemberRole`, `RemoveWorkspaceMember`, `CreateTaskStatus`/`UpdateTaskStatus`/`DeleteTaskStatus`/`ReorderTaskStatuses`, `CreateLabel`/`UpdateLabel`/`DeleteLabel`, `CreateTask` (nomor via `UPDATE … SET task_sequence = task_sequence + 1 … RETURNING` dalam transaksi = row lock), `UpdateTask`, `MoveTask`, `DeleteTask`, `RecordActivity`.
- Penomoran: `UPDATE workspaces SET task_sequence = task_sequence + 1 WHERE id = ? RETURNING task_sequence` di dalam `DB::transaction()` (ARCHITECTURE §3.5).
- Status: `status_category` disalin dari status; `started_at` diisi saat pertama kali masuk `in_progress`/`review`; `completed_at` diisi saat masuk `done`, dikosongkan saat keluar; `canceled_at` sama untuk `canceled`. Ubah kategori kolom di pengaturan → tugas di kolom itu ikut disinkronkan.
- Policy: `WorkspacePolicy`, `TaskPolicy`, `TaskStatusPolicy`/`LabelPolicy` (didelegasikan ke workspace). Aturan:
  - Pribadi: hanya pemilik (termasuk terhadap Super Admin & Direksi).
  - Non-pribadi: anggota sesuai peran (`owner` > `admin` > `member` > `viewer`); `internal` dapat dilihat semua karyawan; Direksi melihat semua; Super Admin = admin untuk pengaturan workspace non-pribadi; Kepala Divisi melihat proyek yang melibatkan divisinya (PRD M10).
  - Lihat ditolak → **404** (`denyAsNotFound`), bukan 403.
  - Viewer & non-anggota tidak bisa mengubah apa pun; workspace diarsipkan = baca-saja.
- Scope `Workspace::visibleTo($user)` dan `Task::visibleTo($user)` untuk semua daftar.
- Event siap-broadcast (stub untuk Sprint 6): `TaskCreated`, `TaskUpdated`, `TaskMoved` di channel privat `workspace.{id}`; otorisasi channel memakai `WorkspacePolicy::view`.
- Hook sinkron: user dibuat → workspace pribadi; divisi dibuat → workspace divisi; user pindah divisi/status berubah → `SyncDivisionMembers` divisi lama & baru (didaftarkan di `WorkspaceServiceProvider`).

## Rute (`routes/workspaces.php`, placeholder `tugas` & `workspace` dihapus dari `$upcoming`)

| Metode | URI | Nama |
|---|---|---|
| GET | `/tugas` | `tasks.mine` (Tugas saya) |
| GET/POST | `/workspace` | `workspaces.index` / `workspaces.store` |
| GET | `/w/{key}` | `workspaces.show` (tab Tugas, `?view=board|list|calendar`) |
| GET | `/w/{key}/dokumen`, `/file`, `/aktivitas`, `/pengaturan` | tab lain |
| PATCH | `/w/{key}` | ubah umum; `POST/DELETE /w/{key}/arsip`, `/favorit` |
| POST/PATCH/DELETE | `/w/{key}/anggota[/{user}]`, `/status[/{status}]`, `PUT /status-urutan`, `/label[/{label}]` | pengaturan |
| POST | `/w/{key}/tugas` | `tasks.store` |
| PATCH/DELETE | `/tugas/{task}` | `tasks.update` / `tasks.destroy` |
| PATCH | `/tugas/{task}/move` | `tasks.move` — **API final**: `status_id`, `after_id?`, `before_id?` → JSON tugas |

## Frontend

- `features/tasks/`: `status-icon`, `priority-icon`, `task-card`, `board/*` (dnd-kit, optimistic + rollback, `Shift+←/→`, render bertahap + `content-visibility` untuk 500 tugas), `list-view` (TanStack Table v9, grup per status, sortir), `calendar/*` (grid bulan desktop, strip minggu + agenda mobile), `task-form` (dialog desktop / bottom sheet `MTugasBaru` mobile, pintasan `C`), `filters` (penanggung jawab, prioritas, label, tenggat, teks), `lib/*` (pengelompokan tenggat, filter, reorder — diuji Vitest).
- `features/workspaces/`: header + tab, sidebar workspace (dikelompokkan Pribadi/Divisi/Tim/Proyek, bisa diciutkan, favorit di atas), grid workspace MMenu, pengaturan (Umum, Anggota, Kolom status, Label, Zona bahaya), aktivitas.
- Halaman: `pages/tasks/mine.tsx`, `pages/workspaces/{index,tasks,activity,documents,files,settings}.tsx`.
- Mobile: board satu kolom per layar + tab kolom + tombol "Pindahkan" (tanpa drag), Tugas saya dengan swipe (Tunda/Selesai) + FAB, kalender agenda, pengaturan lanjutan → banner desktop (anggota tetap terlihat).
- Warna label/status/workspace disimpan sebagai **nama palet** (`teal`, `blue`, `violet`, …), dipetakan ke token CSS baru `--tag-*` di `resources/css/palette.css` (bukan hex di komponen).

## Test

Pest: penomoran unik di bawah konkurensi (proses paralel `pcntl_fork` + bukti row lock), Lexorank (unit), pindah kartu memperbarui `status_category`/`completed_at`/`started_at`, otorisasi pindah, viewer tidak bisa mengubah, non-anggota private 404, workspace pribadi tertutup bagi Super Admin, matriks peran × aksi `WorkspacePolicy`/`TaskPolicy`, sinkron anggota divisi, seeder idempoten, rute & props Inertia. Vitest: helper tenggat, filter, reorder board, grid kalender.

## Risiko & keputusan awal

- Core belum siap saat mulai → UI & service murni dibangun dulu.
- Tidak menambah paket (tanpa popover/virtual): pemilih memakai DropdownMenu, virtualisasi diganti render bertahap + `content-visibility`.
- Pencarian teks memakai konfigurasi `simple` Postgres (tanpa stemmer Indonesia).
- Provider pencarian (`App\Domain\Search\SearchProvider`) belum ada di cabang ini → dicatat di SUMMARY cara menambahkannya.
