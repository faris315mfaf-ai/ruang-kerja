# API v1 — Bagian 3, paket B3-A1 "Tugas"

Dikerjakan 13 Okt 2026 (Claude Code) di branch `claude/android-bagian-3`. Acuan layar: `docs/mockups/android/spec/05-tugas-workspace.md` §1 A–C (Tugas saya, detail tugas, buat/ubah). Semua endpoint adalah presenter tipis di atas **Action, Policy, dan query web yang sama** (tanpa logika ganda); pesan Indonesia; dikonfirmasi oleh `tests/Feature/Api/Task{List,Detail,CommentRich}ApiTest.php` (47 tes) di samping `TaskApiTest`/`TaskWriteApiTest` yang tetap hijau.

Dasar: `https://<host>/api/v1`, header `Authorization: Bearer <token Sanctum>` + `Accept: application/json`. Semua rute di bawah memakai grup `auth:sanctum` + `throttle:api-v1` (+ limiter tambahan bila disebut). Rute baru ada di `routes/api/auth/b3a1-tugas.php`; rute lama tidak berubah (`routes/api.php` tidak disentuh).

Galat umum (JSON): `401` tanpa token · `404` tugas/komentar/workspace tak terlihat (tidak pernah membocorkan keberadaan) · `403 {message}` terlihat tetapi tak boleh (pesan dari Policy, mis. "Mode lihat saja: Anda bukan anggota workspace ini.") · `422 {message, errors:{field:[…]}}` validasi (Indonesia) · `429` limiter. ULID boleh huruf besar atau kecil di jalur; id di badan dinormalisasi ke huruf kecil.

Aturan akses yang dipakai (sama dengan web, `docs/DATABASE.md` §4): lihat `TaskPolicy` — `edit` (`update`), `work` (checklist/lampiran/sub-tugas: penerima titipan boleh), `move`, `plan` (hanya tugas yang ditugaskan kepada saya atau di workspace pribadi saya), `comment`, `watch`, `trackReads`. Tugas titipan (ditugaskan orang lain) hanya bisa diubah/dihapus pembuat atau atasan (aturan 9 Okt 2026). Direksi/HR/Super Admin yang bukan anggota = mode lihat saja (tak bisa komentar, reaksi, amati, checklist, lampiran; bacaan tidak dicatat).

---

## 1. Daftar "Tugas saya" — `GET /tugas`

Auth: token. Policy: `viewAny` + semua baris lewat `Task::visibleTo` / `MyTasks` (workspace tak terlihat dan workspace pribadi orang lain tidak pernah muncul, juga lewat filter `workspace`). Kompatibel mundur: tanpa parameter = semua tugas terlihat; `saya=1` = `scope=ditugaskan`.

Query (semua opsional; daftar boleh `x[]=a&x[]=b` atau `x=a,b`):

| Param | Nilai | Arti |
|---|---|---|
| `scope` | `ditugaskan` · `saya-amati` · `saya-buat` | tab MyTasks (assigned · watching · created). Pembuat tugas otomatis mengamatinya, jadi tugas buatan sendiri juga muncul di `saya-amati` |
| `workspace` | key (`TMS`) atau id | hanya workspace terlihat |
| `prioritas` | `0..4` | 0 tanpa · 1 urgent · 2 tinggi · 3 sedang · 4 rendah |
| `status` | `backlog todo in_progress review done canceled` | kategori status |
| `label` | id label | |
| `penanggung` | id user, atau `saya` | |
| `tenggat` | `overdue` · `today` · `week` · `none` | sama dengan `filters.due` tampilan tersimpan; `week` = hari ini s.d. Minggu ISO |
| `tenggat_dari`, `tenggat_sampai` | `YYYY-MM-DD` | rentang tenggat (inklusif) |
| `q` | teks | judul (ilike) atau rujukan `KEY-n` |
| `selesai` | `minggu-ini` (bawaan) · `tidak` | bawaan = tugas terbuka + selesai sejak Senin; `tidak` = hanya terbuka |
| `urut` | `tenggat` (bawaan) · `prioritas` · `dibuat` · `diperbarui` · `judul` · `workspace` | `prioritas`: urgent dulu, "tanpa" terakhir |
| `arah` | `asc` (bawaan) · `desc` | |
| `per_page` | `1..50` (20) · `page` | halaman bergeser stabil: urutan selalu diakhiri `tasks.id` (tanpa duplikat/lompatan walau tenggat kembar) |

Respons 200:

```json
{
  "tasks": [{
    "id": "…", "key": "TMS-1", "number": 1, "title": "Deploy rilis",
    "workspace": {"id": "…", "key": "TMS", "name": "Tim …", "type": "team"},
    "status": {"id": "…", "name": "Todo", "category": "todo", "is_done": false},
    "priority": {"value": 2, "label": "Tinggi"},
    "due_date": "2026-10-14", "start_date": null, "completed_at": null,
    "assignees": ["Sari"],
    "assignee_people": [{"id": "…", "name": "Sari", "avatar": null}],
    "labels": [{"id": "…", "name": "Bug", "color": "red"}],
    "checklist": {"done": 0, "total": 1},
    "days_late": 0,
    "group": "minggu-ini",
    "plan": {"bucket": null, "lane": "week"},
    "source": "manual"
  }],
  "meta": {
    "current_page": 1, "from": 1, "last_page": 1, "per_page": 20, "to": 1, "total": 1,
    "scope": "ditugaskan", "today": "2026-10-13",
    "counts": {"ditugaskan": 5, "saya-amati": 2, "saya-buat": 1},
    "summary": {"aktif": 5, "terlambat": 1, "hari_ini": 1}
  }
}
```

- `group` (petunjuk pengelompokan "Tenggat"): `terlambat` · `hari-ini` · `minggu-ini` · `nanti` · `tanpa-tenggat` · `selesai` (tanggal kantor Asia/Jakarta).
- `plan.bucket` = pilihan saya di `task_plans` (`today|week|later|null`); `plan.lane` = lajur efektif di "Rencana saya" (otomatis menurut tenggat bila `bucket` null).
- `meta.counts` = tugas **terbuka** per tab; `meta.summary` = angka header tab terpilih ("9 aktif · 1 terlambat · 2 hari ini") dan **tidak** ikut filter chip.
- 422: `scope`, `prioritas.*`, `status.*`, `tenggat`, `tenggat_dari/sampai`, `selesai`, `urut`, `arah`, `per_page` (mis. `per_page harus antara 1 dan 50.`).

---

## 2. Rencana pribadi (`task_plans`)

Privat per pengguna (`TaskPlanPolicy`: Direksi/HR/Super Admin pun tak bisa membaca).

### `GET /tugas/rencana`
Gate `viewDashboard(Personal)`. Respons 200 = `PersonalPlanner` web apa adanya + `lane_labels`:

```json
{
  "today": "2026-10-13",
  "incoming": [{"id": "…", "key": "TMS-1", "number": 1, "title": "Deploy rilis", "url": "/w/TMS/tasks/1",
                "workspace": {"name": "…", "key": "TMS", "type": "team"}, "due_date": "2026-10-14",
                "days_late": 0, "priority": 2, "assigned_by": "Dimas", "assigned_at": "2026-10-13T02:00:00+00:00"}],
  "lanes": {"today": [Item], "week": [Item], "later": [Item]},
  "counts": {"incoming": 1, "today": 0, "week": 0, "later": 0},
  "progress": {"done": 0, "total": 0},
  "lane_labels": {"today": "Hari ini", "week": "Minggu ini", "later": "Nanti"}
}
```
`Item` = `{id, key, number, title, url, workspace{name,key,type}, due_date, days_late, priority, status{id,name,category}, is_personal, checklist, lane, auto, carried, done, completed_at, can_complete, completes_to, complete_hint}`. `incoming` = "tugas baru" (ditugaskan orang lain ≤14 hari, belum diterima); `carried:true` = "terbawa dari kemarin"; `auto:true` = ditempatkan otomatis menurut tenggat.

### `PUT /tugas/{task}/rencana`
Body: `{"bucket": "today"|"week"|"later"|null, "position"?: int, "after_id"?: id, "before_id"?: id}` — kunci `bucket` wajib (null = kembalikan ke otomatis, `UnplanTask`). `position` = urutan 0-berbasis di antara tugas terencana di lajur itu; `after_id`/`before_id` (id tugas tetangga) mengalahkan `position`; tanpa keduanya = ujung bagian terencana. Policy `plan`: hanya tugas yang ditugaskan kepada saya atau di workspace pribadi saya (403 lainnya, pesan "Hanya tugas yang ditugaskan kepada Anda atau catatan pribadi Anda yang bisa direncanakan."; 404 tak terlihat). Menerima/merencanakan juga menandai tugas sebagai sudah diterima (hilang dari `incoming`).

```json
{"plan": {"task_id": "…", "bucket": "today", "planned_for": "2026-10-13", "seen_at": "2026-10-13T02:00:00+00:00"},
 "planner": { …sama dengan GET /tugas/rencana… }}
```
422: `bucket` hilang/tak valid ("Pilih Hari ini, Minggu ini, atau Nanti.").

---

## 3. Tampilan tersimpan — `/tugas/tampilan`

`saved_views`. Tanpa `workspace_id` = tampilan **pribadi lintas workspace** untuk "Tugas saya" (`workspace_id` null; maks. 20 per pengguna; tak bisa dibagikan). Dengan `workspace_id` = tampilan workspace di bawah `SavedViewPolicy` web (pribadi untuk pemilik; yang `is_shared` terlihat semua yang bisa melihat workspace; membagikan butuh hak ubah tugas; hapus tampilan bersama juga oleh admin workspace).

Bentuk `filters` (dinormalisasi `SaveView::normalizeFilters`; kunci lintas-workspace hanya ada bila dikirim):
`{assignees[], priorities[0..4], labels[], due: overdue|today|week|none|null, q, workspaces[] , statuses[], due_from, due_to}` — memetakan 1:1 ke parameter `GET /tugas` (`penanggung`, `prioritas`, `label`, `tenggat`, `q`, `workspace`, `status`, `tenggat_dari`, `tenggat_sampai`).

| Metode & jalur | Keterangan |
|---|---|
| `GET /tugas/tampilan[?workspace_id=]` | `{views:[View]}`; tanpa parameter = tampilan pribadi lintas workspace saya. Dengan `workspace_id`: 404 bila workspace tak terlihat |
| `POST /tugas/tampilan` | `{name (≤60, wajib), layout? (board\|list\|calendar, bawaan list), filters?, workspace_id?, is_shared?}` → **201** `{view}`; 422 `is_shared`: "Tampilan lintas workspace hanya bisa pribadi."; 422 `name` bila sudah 20 |
| `PATCH /tugas/tampilan/{view}` | sebagian: `name`, `layout`, `filters`, `is_shared` → `{view}`; hanya pemilik (403 tampilan bersama orang lain; 404 tampilan pribadi orang lain) |
| `DELETE /tugas/tampilan/{view}` | **204** |

`View` = `{id, name, layout, filters, is_shared, mine, owner (nama pemilik bila bukan saya), workspace_id, sort}`.

---

## 4. Detail tugas — `GET /tugas/{task}`

Policy `view` (404 bila tak terlihat). **Jawaban yang sama** dipakai `POST /tugas` (201), `PATCH /tugas/{task}` (200) — jadi `can` selalu segar setelah menulis. Kompatibel mundur: semua kunci lama (`task.id`, `key`, `title`, `workspace.key/name`, `status`, `priority`, `due_date`, `assignees` [nama], `source`, `description_text`, `start_date`, `checklist{done,total}|null`, `url`, `created_at`, `completed_at`, `can.edit/work/delete/comment`) tetap ada.

```json
{"task": {
  "id": "…", "key": "TMS-1", "number": 1, "title": "Deploy rilis", "url": "/w/TMS/tasks/1",
  "workspace": {"id": "…", "key": "TMS", "name": "…", "type": "team", "archived": false},
  "status": {"id": "…", "name": "Todo", "category": "todo", "is_done": false}, "status_id": "…",
  "statuses": [{"id": "…", "name": "Backlog", "category": "backlog", "color": "gray", "position": "A"}, …],
  "priority": {"value": 2, "label": "Tinggi"},
  "due_date": "2026-10-14", "start_date": null, "estimate_hours": null,
  "created_at": "…", "started_at": null, "completed_at": null, "updated_at": "…", "source": "manual",
  "creator": {"id": "…", "name": "Dimas", "avatar": null},
  "parent": {"id": "…", "key": "TMS-1", "title": "…", "status_category": "todo"} ,
  "assignees": ["Sari"], "assignee_people": [{"id": "…", "name": "Sari", "avatar": null}],
  "labels": [{"id": "…", "name": "Bug", "color": "red"}],
  "workspace_labels": [{"id": "…", "name": "Bug", "color": "red"}],
  "description_text": "Siapkan rilis",
  "description_html": "<p>Siapkan rilis</p>",
  "description_plain": true,
  "checklist": {"done": 0, "total": 1},
  "checklist_items": [{"id": "…", "title": "Backup", "is_done": false, "position": "a", "done_by": null, "done_at": null}],
  "subtasks": [Baris-daftar],
  "attachments": [Lampiran], "attachments_can_edit": true,
  "drive": {"enabled": true, "fake": false, "picker_enabled": true, "max_upload_bytes": 104857600, "chunk_bytes": 1966080},
  "watchers": [{"id": "…", "name": "…", "avatar": null}], "am_watching": true,
  "activity_preview": [Aktivitas ×5 terbaru],
  "comments": {"count": 3, "unread": false},
  "plan": {"bucket": null, "planned_for": null},
  "view_only": false,
  "can": {"edit": false, "delete": false, "comment": true, "work": true, "plan": true, "move": true, "watch": true, "track_reads": true, "moderate": false},
  "locked_reason": {"edit": "Tugas yang ditugaskan orang lain hanya dapat diubah …", "delete": "…", "comment": null, "work": null, "plan": null, "move": null, "watch": null, "track_reads": null},
  "banner": {"kind": "titipan", "message": "Tugas ini ditugaskan oleh Dimas. Hanya Dimas atau atasan Anda …", "assigned_by": {"id": "…", "name": "Dimas", "avatar": null}}
}}
```

- `description_html`: HTML aman dari dokumen Tiptap (mention/rujukan = `<span data-type="mention|taskReference" data-id="…">`), `null` bila tanpa deskripsi. `description_plain=false` berarti deskripsi punya tanda/daftar/mention yang akan ikut "diratakan" bila diedit sebagai teks polos (kirim PATCH `description` hanya bila memang diubah — teks yang sama persis tidak menimpa dokumen kaya).
- `can.*` = jawaban Policy (`edit`→`update`, `delete`, `comment`, `work`, `plan`, `move`, `watch`, `track_reads`→`trackCommentReads`); `moderate` = admin/pengelola workspace. `locked_reason.<ability>` = pesan Policy bila tertutup (null bila boleh). Jangan menebak izin di klien.
- `banner` (null bila tak ada): `kind` ∈ `arsip` (workspace diarsipkan) · `lihat_saja` (manajemen non-anggota) · `titipan` (ditugaskan orang lain; `can.edit=false`, `can.work=true`; menyertakan `assigned_by`).
- `Lampiran` = `{id, name, kind (doc|sheet|slide|pdf|image|folder|other), mime_type, size_bytes, source (drive|storage), link, preview_url, created_at, uploaded_by{id,name}|null, can_remove}`.
- `Aktivitas` lihat §7. `Baris-daftar` = baris `GET /tugas` (§1).

### Tulis (sudah ada, diperluas) — jawaban = detail di atas
- `POST /tugas` (201) — tambahan opsional: `status_id` (kolom), `label_ids[]`, `start_date`, `estimate_hours`, `parent_id`. Gate `editTasks` workspace (404 tak terlihat, 403 hanya-lihat/arsip).
- `PATCH /tugas/{task}` (200) — tambahan opsional: `start_date`, `estimate_hours` (0–9999, jam), `label_ids[]`. `due_date` tidak boleh sebelum `start_date` bila keduanya dikirim. Gate `update` (tugas titipan: 403 untuk penerima). Pindah status tetap `PATCH /tugas/{task}/status`.
- `DELETE /tugas/{task}` (204) — tidak berubah.

---

## 5. Checklist, sub-tugas, pengamat, lampiran

### Checklist — gate `work` (penerima titipan boleh)
- `POST /tugas/{task}/checklist` `{title}` → **201** `{items:[Butir], checklist:{done,total}|null, item:Butir}`; 422 "Isi checklist wajib diisi."
- `PATCH /tugas/{task}/checklist/{item}` `{title?, is_done?, after_id?, before_id?}` → `{items, checklist, item}`. Centang mencatat `done_by/done_at` + aktivitas; `after_id`/`before_id` (id butir tetangga) mengurutkan ulang (lexorank, dikunci baris tugas).
- `DELETE /tugas/{task}/checklist/{item}` → 200 `{items, checklist, removed:true}`.
- Butir = `{id, title, is_done, position, done_by, done_at}`; butir tugas lain di jalur ini = 404. Mode lihat saja = 403.

### Sub-tugas
- `GET /tugas/{task}/subtugas` → `{parent:{id,key,title}, subtasks:[Baris-daftar]}` (policy `view`).
- `POST /tugas/{task}/subtugas` `{title, description?, assignee_ids?, due_date?, priority?, status_id?, label_ids?, start_date?, estimate_hours?}` → **201** `{subtask: Baris-daftar}` lewat `CreateTask` dengan `parent_id` = tugas di jalur (penomoran, kolom, aktivitas `task.subtask_added` pada induk, notifikasi = web). Gate `work` pada induk.

### Pengamat — gate `watch`
- `POST /tugas/{task}/amati` / `DELETE /tugas/{task}/amati` → `{watching: bool, watchers:[{id,name,avatar}]}` (idempoten). 403 untuk manajemen mode lihat saja.

### Lampiran
- `GET /tugas/{task}/lampiran` → `{attachments:[Lampiran], attachments_can_edit, drive:{…}}` (policy `view`).
- `DELETE /tugas/{task}/lampiran/{attachment}` → 200 `{removed:true, message, attachments, attachments_can_edit, drive}`; lampiran tugas lain = 404; tanpa hak `work` = 403 "Anda tidak punya akses untuk mengubah lampiran di sini." File Drive tidak ikut terhapus.
- `POST /tugas/{task}/lampiran` (multipart `file`, maks. 100 MB; 30/menit). **Ditolak 503 `{"code":"drive_belum_siap","message":"Integrasi Google Drive belum diaktifkan. Hubungi admin RuangKerja."}`** selama Drive belum dikonfigurasi, karena berkas hanya bisa disimpan ke folder Drive workspace (Action web `QueueDriveUpload` + job `UploadToDrive` memerlukan akun layanan; tidak ada penyimpanan privat alternatif). Bila Drive aktif (atau mode fake lokal): **202** `{"upload_id":"…","status":"diproses","message":"…"}` — berkas diunggah via antrean; ulangi `GET …/lampiran` sampai muncul. 422 `file` ("Pilih berkas yang akan dilampirkan." / terlalu besar); 403 tanpa hak `work`. "Pilih dari Drive" dan dokumen baru (Docs/Sheets/Slides) tetap web karena butuh Google Picker + token OAuth pengguna.

---

## 6. Komentar kaya

Dokumen komentar dibangun **di server** dari teks + id pilihan pemilih (`CommentDocument`): `@Nama` → node `mention`, `#KEY-n` → node `taskReference`; orang/tugas yang dipilih tetapi tokennya hilang dari teks ditambahkan di akhir. Lalu `PostComment`/`UpdateComment` web menyaring: mention hanya untuk orang yang bisa melihat workspace, rujukan hanya tugas yang bisa dilihat penulis; selain itu menjadi teks biasa. `body_text` tetap teks polos (cadangan).

Bentuk `Komentar` = `CommentResource` web (`kind,id,task_id,author{id,name,avatar},body (Tiptap),body_text,created_at,edited_at,deleted,reactions[{emoji,count,user_ids,names}],attachments[Lampiran]`) +
`body_html` (null bila dihapus), `mine`, `my_reactions[]` (emoji saya), `can:{edit,delete,react}`. Komentar dihapus tetap ada sebagai batu nisan (`deleted:true`, `body/body_html:null`, `can` semua false).

- `GET /tugas/{task}/komentar?page=` → `{comments:[Komentar], can:{comment,moderate}, meta:{current_page,from,last_page,per_page,to,total}}`; 30/halaman, terbaru dulu.
- `POST /tugas/{task}/komentar` `{body (teks, wajib, ≤20.000), mentions?: [user_id ≤20], task_refs?: [task_id ≤20]}` → **201** `{comment: Komentar}`. Gate `comment` (403 arsip/lihat saja). Limiter `comments`. Notifikasi mention & pengamat berjalan seperti web.
- `PATCH /komentar/{comment}` (isi sama dengan POST) → `{comment}`; hanya penulis (403 lainnya; 404 bila tugas tak terlihat atau komentar sudah dihapus); `edited_at` terisi bila isi berubah; mention dibangun ulang, hanya yang baru dinotifikasi.
- `DELETE /komentar/{comment}` → 200 `{comment: batu nisan}`; penulis atau admin/pengelola workspace; mention, reaksi, dan notifikasi Inbox yang mengutipnya ikut hilang.
- `POST /komentar/{comment}/reaksi` `{emoji}` → set (idempoten) ; `DELETE /komentar/{comment}/reaksi` `{emoji}` (badan JSON atau `?emoji=`) → hapus (idempoten). Jawaban: `{active: bool, comment: Komentar}`. `emoji` ∈ `👍 🎉 ❤️ 😄 👀 🙏 ✅ 🚀` (422 "Reaksi tidak tersedia."). Gate `react` (= bisa berkomentar).
- `POST /tugas/{task}/komentar/dibaca` `{comment_id?}` (default komentar terbaru; 120/menit) → `{read: {user, last_read_comment_id, last_read_at, read_at}|null}` — penunjuk hanya maju, notifikasi Inbox komentar/mention tugas itu ikut ditandai dibaca. Gate `trackCommentReads` (403 manajemen lihat saja, pesan "Mode lihat saja: …"). 422 bila `comment_id` bukan komentar tugas ini.
- `GET /tugas/{task}/dibaca-oleh` → `{tracking: bool, readers:[{user{id,name,avatar}, last_read_comment_id, last_read_at, read_at}]}` — hanya karyawan aktif yang masih ikut di tugas itu (anggota, atau yang boleh melihat workspace); manajemen mode lihat saja tidak pernah ditampilkan. `tracking=false` bila bacaan **saya** tidak dicatat (mode lihat saja). Klien menyembunyikan penulis/diri sendiri.
- Pemilih `@`: `GET /tugas/{task}/mention?q=&limit=` (1–20, bawaan 8) → `{people:[{id,name,avatar}]}` — anggota workspace (semua karyawan bila workspace `internal`); pemeriksaan akhir tetap per orang saat komentar disimpan.
- Pemilih `#`: `GET /tugas/rujukan?q=&workspace=&limit=` → `{tasks:[{id,key,title,status_category,workspace{key,name}}]}` — hanya tugas yang terlihat; cocok judul atau `KEY-n` (angka saja diselesaikan di workspace `workspace`); workspace itu diurutkan lebih dulu, lalu terbaru diperbarui. Workspace tak terlihat/tak dikenal diabaikan.

---

## 7. Aktivitas — `GET /tugas/{task}/aktivitas`

Policy `view`. Umpan `activities` tugas itu, terbaru dulu, 30/halaman (`per_page` 1–50, `page`). Filter `jenis`: `status` (dibuat, pindah kolom) · `penugasan` · `tenggat` (tenggat, mulai, estimasi) · `prioritas` · `isi` (judul, deskripsi) · `checklist` (checklist, sub-tugas) · `lampiran`.

```json
{"activities": [{
   "id": "…", "event": "task.status_changed",
   "text": "memindahkan TMS-1 dari Todo ke Sedang dikerjakan",
   "properties": {"key": "TMS-1", "from": {…}, "to": {…}},
   "causer": {"id": "…", "name": "Dimas", "avatar": null},
   "created_at": "2026-10-13T02:00:00+00:00"}],
 "meta": {"current_page": 1, "from": 1, "last_page": 1, "per_page": 30, "to": 3, "total": 3}}
```
`text` = kalimat tanpa pelaku (ekuivalen `describeActivity()` web: "mengubah tenggat TMS-1 menjadi 17 Okt", "menugaskan TMS-1 ke Maya Rekan", "menyelesaikan “Backup” di TMS-1", …). 422 `jenis` tak dikenal.

---

## 8. Catatan implementasi

- File baru: `app/Domain/Tasks/{Queries/MyTaskList,Queries/TaskApiDetail,Actions/MoveChecklistItem,Services/CommentDocument,Services/ActivityText}.php`; `app/Http/Controllers/Api/Task/{TaskPlan,TaskView,TaskChecklist,TaskSubtask,TaskWatch,TaskAttachment,TaskActivity,TaskCommentReaction,TaskCommentRead,TaskPicker}Controller.php`; `app/Http/Requests/Api/{TaskIndex,TaskPlan,TaskView,TaskChecklist,SubtaskStore}Request.php` + trait `Concerns/TaskExtraFields`; `app/Http/Resources/Api/{TaskListRow,TaskCommentPresenter}.php`; rute `routes/api/auth/b3a1-tugas.php`.
- Diubah: `TaskController` (index/show/store/update memakai presenter baru), `TaskCommentController` + `TaskCommentRequest` (mentions, sunting, hapus), `TaskStoreRequest`/`TaskUpdateRequest` (field tambahan), `SaveView` (workspace boleh null + kunci filter lintas workspace; tampilan workspace web tidak berubah bentuk). `TaskWriteApiTest`: dua asersi `task.can` persis diganti asersi per kunci karena `can` bertambah.
- Tanpa migrasi, tanpa paket baru. Tidak ada WebSocket: aplikasi polling (30 dtk) detail/komentar; "sedang melihat" (presence) belum ada di API.
- Tidak termasuk paket ini: duplikat tugas, template tugas, unggah chunked > 1 permintaan, Drive Picker/dokumen baru (web), otomasi/berulang, daftar/papan workspace (B3-A2).
