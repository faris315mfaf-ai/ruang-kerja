# Sprint 6 — Rencana: Detail tugas, komentar, mention, realtime

Acuan: `docs/PROMPTS.md` blok Sprint 6, PRD M4, ARCHITECTURE §3.5 & §4, DATABASE §4 (`comments`, `mentions`, `reactions`, `saved_views`), mockup `TaskDetail`, `MTaskDetail`, `Kanban` ("tersinkron langsung"), `Inbox` (pratinjau tugas), `docs/sprints/sprint-5/SUMMARY.md`, `docs/sprints/sprint-8/HOW-TO-NOTIFY.md`.

## Skema (migrasi `2026_10_06_0601xx`)

- `comments` — `id`, `commentable_type/id` (ULID morph), `user_id`, `body` jsonb, `body_text`, `edited_at`, timestamps, soft delete. Indeks `(commentable_type, commentable_id, created_at)`.
- `mentions` — `id`, `mentionable_type/id`, `mentioned_user_id`, `created_by`, `created_at`. Unik `(mentionable, mentioned_user_id)`. Hanya berisi user yang **punya akses** ke workspace (diisi ulang tiap simpan).
- `reactions` — `id`, `reactable_type/id`, `user_id`, `emoji` varchar(16), `created_at`. Unik `(reactable, user_id, emoji)`.
- `saved_views` — `id`, `user_id`, `workspace_id` null, `name`, `layout`, `filters` jsonb, `sort` jsonb null, `is_shared`, timestamps.

## Backend

- Model `app/Models/{Comment,Mention,Reaction,SavedView}` + Policy + factory.
- `Domain/Tasks/Services/RichText` — sanitasi dokumen Tiptap (whitelist node/mark/atribut, tautan hanya http/https/mailto, batas ukuran & kedalaman), teks polos, label mention diganti nama asli.
- `Domain/Tasks/Services/MentionParser` — ambil id dari node `mention` (dan `taskReference` untuk #KEY-n).
- `Domain/Tasks/Services/TaskAudience` — siapa yang boleh dirujuk (@) di workspace: anggota; + semua karyawan aktif untuk workspace `internal`. Validasi akhir per user lewat `WorkspacePolicy::canView`.
- Action: `PostComment`, `UpdateComment`, `DeleteComment` (soft), `ToggleReaction`, `SyncMentions` (mentions + notifikasi hanya untuk yang berakses, tanpa diri sendiri), `UpdateTaskDescription` (lewat `UpdateTask` → `description` JSON), `AddChecklistItem`/`UpdateChecklistItem`/`DeleteChecklistItem`, `ToggleTaskWatch`, `SaveView`/`DeleteSavedView`, `SendDeadlineNotifications`.
- Notifikasi (`BaseNotification`): `MentionNotification` (`mention`), `TaskCommentedNotification` (pengamat), `TaskAssignedNotification` (lewat event domain `TaskAssigneesAdded` + listener; seeder mem-fake event ini), `TaskDueSoonNotification` (H-1), `TaskOverdueNotification` (perlu tindakan; di-resolve saat selesai/dibatalkan/tenggat dipindah).
- Command `tasks:notify-deadlines` (07.00 WIB, idempoten lewat `NotificationHistory`).
- Seksi ringkasan harian: `TasksDueTodaySection`, `TasksOverdueSection` (danger) di `config/notifications.php`.
- Broadcast: `CommentPosted` (`comment.posted`), `CommentUpdated` (`comment.updated`: edit, hapus, reaksi) di `private-workspace.{id}`; perubahan checklist/deskripsi → `TaskUpdated`. Presence `presence-task.{id}` (otorisasi `TaskPolicy::view`, data `{id,name,avatar}`).
- Pencarian: `TaskSearchProvider` → `/w/KEY/tasks/N`.

### Aturan akses (keputusan)

| Aksi | Siapa |
|---|---|
| Lihat detail/komentar | `TaskPolicy::view` (= lihat workspace) |
| Komentar & reaksi | bisa lihat workspace dan workspace tidak diarsipkan (Direksi boleh memberi arahan) |
| Edit komentar | hanya penulis |
| Hapus komentar | penulis, atau admin/owner workspace (Super Admin pengelola workspace bersama juga) |
| Mention | penerima harus bisa melihat workspace; selain itu mention dibuang (tidak ada baris & notifikasi) |
| Saved view pribadi | pemilik; dibagikan → semua yang bisa melihat workspace; membagikan butuh hak ubah tugas; ubah/hapus hanya pemilik (view dibagikan juga boleh dihapus admin workspace) |

## Rute

| Metode | URI | Nama |
|---|---|---|
| GET | `/w/{key}/tasks/{number}` | `tasks.page` (layar penuh, Inertia `tasks/show`) |
| GET | `/tugas/{task}` | `tasks.show` (JSON detail untuk TaskSheet & Inbox) |
| POST/DELETE | `/tugas/{task}/pantau` | `tasks.watch` / `tasks.unwatch` |
| POST | `/tugas/{task}/checklist` · PATCH/DELETE `/checklist/{item}` | checklist |
| POST | `/tugas/{task}/komentar` · PATCH/DELETE `/komentar/{comment}` · POST `/komentar/{comment}/reaksi` | komentar |
| GET | `/w/{key}/rujukan?q=&type=people|tasks` | `workspaces.references` (saran @ dan #) |
| POST | `/w/{key}/tampilan` · PATCH/DELETE `/tampilan/{view}` | saved views |

## Frontend

- Paket: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` (v3: heading, list, code, blockquote, link, undo), `@tiptap/extension-list` (TaskList/TaskItem), `@tiptap/extension-mention` + `@tiptap/suggestion` (@orang, #KEY-n), `@tiptap/extensions` (Placeholder).
- `features/tasks/detail/*`: `task-sheet` (panel kanan 640 px, Esc, tombol layar penuh, salin tautan), `task-detail.desktop` (konten + kolom properti), `task-detail.mobile` (MTaskDetail, kotak komentar lengket), `properties`, `checklist`, `subtasks`, `timeline` (aktivitas + komentar, filter Semua/Komentar), `comment-item`, `comment-composer`, `reactions`, `presence`, `use-task-detail` (data + realtime + polling).
- `features/tasks/editor/*`: `rich-text-editor` (Tiptap), `suggestion-list`, `rich-text-view` (render JSON → React tanpa instance editor; aman, tanpa `dangerouslySetInnerHTML`).
- Realtime: `hooks/use-workspace-channel` (status koneksi + event), `features/tasks/connection-indicator` ("Tersinkron langsung" / "Sinkron tiap 30 dtk"), board/list/kalender menerapkan event tanpa reload; polling `router.reload({only:['tasks']})` tiap 30 dtk saat terputus.
- Pintasan Linear (`use-task-shortcuts` + dialog `?`): J/K, Enter, C, A, S, P, D, Shift+←/→.
- Saved views: menu "Tampilan" di toolbar.
- Inbox: `registerNotificationDetail('task.' | 'mention', TaskNotificationPreview)`.
- Mobile: kartu dibuka ke `/w/KEY/tasks/N` (layar penuh); desktop membuka TaskSheet.

## Test

Pest: RichText (sanitasi), MentionParser, mention → notifikasi hanya untuk yang berakses (workspace privat tidak bocor), komentar (buat/ubah/hapus, otorisasi hapus bukan penulis ditolak kecuali admin), reaksi (toggle, unik), watcher otomatis, otorisasi channel `workspace.{id}` & presence `task.{id}`, broadcast `CommentPosted`, saved view visibilitas, checklist, deadline job (H-1/terlambat, idempoten, resolve), seksi digest, pencarian deep link, halaman `/w/KEY/tasks/N`. Vitest: helper timeline, shortcut navigation, rich-text view, saved-view query.

## Risiko

- Uji dua browser butuh Reverb lokal: port 8091 khusus worktree ini; bila tidak bisa, dibuktikan dengan test broadcast.
- Tiptap menambah ukuran bundle → editor dimuat lazy (`React.lazy`) hanya saat detail dibuka.
