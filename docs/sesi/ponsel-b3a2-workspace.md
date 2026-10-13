# Bagian 3 · B3-A2 — Workspace & otomasi (API v1)

> Dibangun 13 Okt 2026 (Claude Code) untuk aplikasi Android. Branch `claude/android-bagian-3`. Acuan layar: `docs/mockups/android/spec/05-tugas-workspace.md` (D. Workspace, E. Otomasi). Controller tipis di atas Action/Policy/Query web yang sama; teks galat Bahasa Indonesia; tes `tests/Feature/Api/WorkspaceB3a2ApiTest.php` (28 tes).

Semua rute di bawah awalan `/api/v1`, wajib `Authorization: Bearer <token>` (Sanctum, `throttle:api-v1`). `{workspace}` = ULID **atau key** (mis. `TMS`, huruf kecil pun diterima); workspace yang tidak terlihat penelepon → **404** (keberadaan tidak diungkap), terlihat tetapi tidak boleh diubah → **403** `{message}`, validasi → **422** `{message, errors:{field:[…]}}`, tanpa token → 401. Rute baru ada di `routes/api/auth/b3a2-workspace.php`; rute lama (`GET /workspace`, `/papan`, `/anggota`, `/catatan`) tetap di `routes/api.php` (tidak ada baris rute lama yang diubah; hanya isi controllernya diperluas, semua tambahan bersifat aditif).

Penanda baca-saja yang dipakai banyak respons:

```json
"read_only": { "read_only": true, "code": "arsip|lihat_saja|peran_viewer", "reason": "Workspace diarsipkan · hanya baca." }
```
`reason` per kode: `arsip` = "Workspace diarsipkan · hanya baca." · `lihat_saja` = "Mode lihat saja: Anda bukan anggota workspace ini." (Direksi/HR/Super Admin non-anggota) · `peran_viewer` = "Peran Anda di workspace ini hanya bisa melihat." Bila tidak baca-saja: `{read_only:false, code:null, reason:null}`.

## 1. Daftar, buat, favorit

### GET `/workspace` (diperluas)
Respons:
```json
{
  "groups": [
    { "jenis": "pribadi|divisi|proyek|lainnya", "label": "Pribadi", "items": [ WorkspaceItem ] }
  ],
  "can_create": { "team": true, "project": true },
  "teams": [ { "id": "…", "name": "Tim Gudang" } ]
}
```
Empat kelompok selalu ada, urutan tetap: `pribadi` · `divisi` (Divisi & tim) · `proyek` (Proyek yang diikuti) · `lainnya` (Lainnya (lihat saja): terlihat tanpa menjadi anggota). Di dalam kelompok: favorit dulu (yang dibintangi lebih awal lebih dulu), lalu jenis → nama. Staf hanya mendapat `lainnya` untuk workspace `internal`; Direksi/HR/Super Admin untuk semua workspace non-pribadi yang bukan keanggotaannya.

`WorkspaceItem` (kunci lama `id,key,name,arsip` tidak berubah):
```json
{ "id":"…","key":"TMS","name":"Tim Operasional","arsip":false,
  "type":"personal|team|division|project","type_label":"Tim","group":"divisi","color":"blue",
  "visibility":"private|internal","is_member":true,"my_role":"owner|admin|member|viewer|null",
  "favorit":false,"view_only":false,
  "members_count":4,"open_tasks_count":2,"overdue_tasks_count":1 }
```
`teams` = tim yang boleh ditautkan ke workspace tim baru (`LinkableTeams`, sama dengan web).

### POST `/workspace` — "Workspace baru" (throttle 30/menit)
Body: `{type:"team|project", name, key?, description?, visibility?:"private|internal" (default private), team_id?}` **atau** `{template_id, name, key?, description?, visibility?}` (jenis ikut template; butuh `features.automation`, kalau mati → 404). `key` huruf kecil dinormalkan; kosong → dibuat otomatis. Aksi: `CreateWorkspace` / `CreateWorkspaceFromTemplate`.
- 201: `{ "workspace": WorkspaceItem, "message": "Workspace X dibuat." }`
- 403 bila `WorkspacePolicy::create` menolak (Kepala Divisi, Ketua Tim, Super Admin untuk tim; plus Direksi untuk proyek; staf tidak).
- 422: `key` format `^[A-Z][A-Z0-9]{1,9}$` ("Key 2–10 huruf kapital/angka dan diawali huruf, mis. PLQ."), "Key X sudah dipakai workspace lain.", `type` wajib bila tanpa `template_id`, `name` wajib/maks 120. 404 untuk template yang tidak ada/lintas perusahaan.

### GET `/workspace/templat` (butuh `features.automation`)
```json
{ "templat": [ { "id","name","description","type":"team|project","type_label","statuses":[{"name","category","color"}],
                 "labels":[{"id":"nama:bug","name","color"}],"used_count":0,"can_use":true } ] }
```
`can_use` = boleh membuat workspace jenis itu. Pakai lewat `POST /workspace` + `template_id`.

### POST / DELETE `/workspace/{workspace}/favorit`
`{ "favorit": true|false }`. Hanya anggota (`WorkspacePolicy::favorite`); non-anggota yang melihat → 403, tak terlihat → 404. Idempoten.

## 2. Detail & tab

### GET `/workspace/{workspace}`
```json
{
  "workspace": { "id","key","name","type","type_label","color","description","visibility","owner_id","arsip":false,"archived_at":null,"drive_folder_url":null },
  "my_role": "admin|null", "favorit": false,
  "read_only": { … },
  "can": { "edit_tasks","manage","manage_members","archive","favorite","view_only","contribute_drive" },
  "counts": { "members","open_tasks","overdue_tasks","columns","documents","files" },
  "drive": { "enabled": false, "access": { "state":"disabled|preparing|unused|error|pending|synced","synced","pending","errors","total" } },
  "project": null | { "status","status_label","health","health_label","start_date","target_date","lead_user_id","last_update_at" },
  "tabs": ["tugas","dokumen","file","aktivitas","anggota","catatan"?,"ringkasan"?,"pengaturan"]
}
```
`can.*` = `WorkspacePage::abilities` (kebijakan web). `contribute_drive` hanya true bila Drive aktif **dan** boleh menambah. `catatan` ada bila `features.notes`; `ringkasan` hanya proyek (isi: modul 06). Workspace pribadi orang lain → 404.

### GET `/workspace/{workspace}/papan` (diperluas)
Bentuk lama dipertahankan (`workspace`, `columns[].{id,name,kategori,color,posisi,tasks[]}`, `hidden_closed_count`); tambahan:
- `workspace` kini `{id,key,name,type,color,arsip}`; `labels:[{id,name,color}]`, `members_count`.
- `can: {edit_tasks, move, view_only}`, `read_only: {…}`.
- tiap kartu: bentuk `TaskResource` web (`id,key,title,status_id,status_category,priority,due_date,start_date,assignee_ids,label_ids,checklist,comments{count,unread},…`) + `assignees:[{id,nama}]` + `can:{move}`. `can.edit` per kartu **tidak** dikirim (bergantung siapa penugas; ambil dari `GET /tugas/{id}`).

### GET `/workspace/{workspace}/tugas` — tampilan List
Query: `status` (id kolom) · `kategori` (backlog|todo|in_progress|review|done|canceled) · `assignee` (`me`|`none`|id user) · `prioritas` (csv 0–4) · `label` (csv id) · `tenggat` (overdue|today|week|none) · `q` (judul/deskripsi/`TMS-12`) · `urut` (tenggat|prioritas|terbaru|nomor; default tenggat, tenggat kosong terakhir) · `selesai` (bool: sertakan semua tugas tertutup) · `page` · `per_page` (default 40, maks 100).
Tanpa `selesai`/`kategori`/`status`, cakupan = papan (terbuka + tertutup ≤ 30 hari).
```json
{ "workspace":{"id","key","name"}, "tasks":[ Kartu + "status":{"id","name","kategori","color"} ],
  "statuses":[{"id","name","kategori","color","posisi"}], "labels":[{"id","name","color"}],
  "meta":{"current_page","last_page","per_page","total","has_more"}, "can":{"move":true}, "read_only":{…} }
```
422 untuk filter tak valid ("Filter tenggat tidak valid.", "Prioritas tidak valid.", …). Pengelompokan per status/prioritas dilakukan di klien dari `statuses`.

### GET `/workspace/{workspace}/kalender?bulan=YYYY-MM`
Default bulan = bulan ini (zona kantor). Grid mulai Senin (hari awal/akhir bulan tetangga ikut terisi).
```json
{ "workspace":{…}, "bulan":"2026-10", "today":"2026-10-14", "range":{"from":"2026-09-28","to":"2026-11-01"},
  "tasks":[ Kartu + {"status":{…},"overdue":false} ],        // due_date di dalam range, urut tenggat, termasuk yang sudah selesai
  "tanpa_tenggat":[ Kartu ],                                // terbuka tanpa tenggat, terbaru dulu, maks 100
  "terlambat": 1,                                           // jumlah tugas terbuka lewat tenggat (semua bulan)
  "can":{"move":true}, "read_only":{…} }
```
422 `bulan` ("Bulan harus berformat YYYY-MM, mis. 2026-10."). Strip minggu cukup memfilter `tasks` di klien.

### PATCH `/workspace/{workspace}/papan/kartu/{task}` — "Pindahkan"
Body `{status_id, after_id?, before_id?}` (kartu persis di atas/bawah posisi baru; tanpa keduanya = puncak kolom). Aksi `MoveTask` di belakang `TaskPolicy::move` (workspace diarsipkan/viewer/mode lihat saja → 403; tugas milik workspace lain → 404; kolom workspace lain → 422 "Kolom tujuan tidak ada di workspace ini.").
```json
{ "task": Kartu, "column": { "id","name","kategori","color","posisi","tasks":[ Kartu urut baru ] }, "message": "TMS-3 dipindah ke Sedang dikerjakan." }
```
`column.tasks` = urutan segar kolom tujuan (kolom tertutup hanya yang ditutup ≤ 30 hari, seperti papan). Pindah status tanpa urutan tetap bisa lewat `PATCH /tugas/{id}/status`.

### GET `/workspace/{workspace}/dokumen`
```json
{ "drive": { "enabled","fake","picker_enabled","missing_settings":[],"folder_url","folder_name","shared_drive_name","access":{…},"can_contribute","max_upload_bytes","chunk_bytes","syncing" },
  "counts": {"documents":1,"files":2},
  "documents": [ DriveFileRow ],        // Docs/Sheets/Slides, terbaru dulu
  "notes": [ {"id","title","kind":"note|folder","parent_id","updated_at"} ] }   // [] bila features.notes mati
```
`DriveFileRow` = `DriveFileResource` web (`id,google_file_id,name,mime_type,kind,kind_label,web_view_link,preview_url,icon_link,size_bytes,owner_email,modified_at,added_by,deleted`) + `parent_id, linked, children_count, owner_name, used_in:[{key,title,url}]`. Dibaca dari cache `drive_files` (Google tidak dipanggil dalam request; penyegaran dijadwalkan lewat job seperti web).

### GET `/workspace/{workspace}/file?folder=<google_file_id>`
`{ drive, counts, folder: null|{id,name,url}, breadcrumbs:[{id|null,name}], files:[DriveFileRow] }` — folder dulu lalu nama. `folder` bukan milik workspace → 404.

### POST `/workspace/{workspace}/dokumen` (throttle 20/menit) · POST `/workspace/{workspace}/file/folder`
`{type:"document|spreadsheet|presentation", name?, folder?}` → 201 `{file: DriveFileResource, message:"Dokumen X dibuat."}`; `{name, parent?}` → 201 `{file: <folder>, message:"Folder X dibuat."}`. **Selama Google belum dikonfigurasi: 503 `{"code":"drive_belum_siap","message":"Integrasi Google Drive belum diaktifkan. Hubungi admin RuangKerja."}`** (urutan: 404 workspace tak terlihat → 403 tak boleh menambah file → 503). Kegagalan Google lain memakai `GoogleException` web (`{code,message}`, 409/503). **Unggah file (sesi chunk) dan "Tautkan dari Drive" tidak diekspos** — menunggu kredensial Google dari pemilik.

### GET `/workspace/{workspace}/aktivitas?page=`
30 per halaman, terbaru dulu.
```json
{ "aktivitas":[ {"id","event":"task.status_changed","text":"memindahkan TMS-3 dari Todo ke Review",
                 "subject_type":"task|workspace","subject_id","task_key":"TMS-3"|null,"created_at":"ISO",
                 "actor":{"id","name","avatar"}|null} ],
  "meta":{"current_page","last_page","per_page","total","has_more"} }
```
`text` = kalimat Indonesia tanpa pelaku (port `activity-text.ts`).

### GET `/workspace/{workspace}/anggota` (diperluas)
```json
{ "anggota":[ { "id","name","avatar","role":"owner|admin|member|viewer","role_label","is_synced","division","position","joined_at",
                "drive_access": { "status":"tersinkron|menunggu|gagal|akun_nonaktif|drive_belum_aktif","label":"Tersinkron","error":null|"invalidSharingRequest","synced_at":null|"ISO" },
                "can_change_role":true,"can_remove":true } ],
  "can":{"manage_members":true}, "role_options":[{"value":"admin","label":"Admin"},…], "drive":{state,synced,pending,errors,total} }
```
Urutan: peran (owner dulu) lalu nama. Kunci lama (`id,name,avatar,role`) tetap. `can_change_role`: pengelola & bukan owner. `can_remove`: pengelola, bukan owner, bukan anggota tersinkron-organisasi.

### GET `/workspace/{workspace}/anggota/kandidat?q=`
Karyawan aktif belum anggota (maks 30, cari nama/email). Hanya pengelola (403 untuk lainnya). `{kandidat:[{id,name,email,avatar,division}]}`.

### POST `/workspace/{workspace}/anggota` · PATCH/DELETE `/workspace/{workspace}/anggota/{userId}`
`manageMembers` (owner/admin, bukan workspace pribadi/arsip) → selain itu 403; 404 bila workspace tak terlihat.
- POST `{user_id, role:"admin|member|viewer"}` → 201 `{anggota: row, message:"Orang Luar ditambahkan sebagai Member."}`; 422 "… sudah menjadi anggota." / "Karyawan tidak ditemukan atau tidak aktif." / `role` `owner` ditolak.
- PATCH `{role}` → `{anggota: row, message:"Peran X diubah menjadi Viewer."}`; 422 "Peran owner tidak dapat diubah di sini."
- DELETE → `{message:"X dikeluarkan dari workspace."}`; 422 "Owner tidak dapat dikeluarkan." / "X tersinkron dari struktur organisasi. Ubah divisi/timnya di data karyawan."
Aksi web `AddWorkspaceMember` / `UpdateWorkspaceMemberRole` / `RemoveWorkspaceMember` (aktivitas, audit, sinkron izin Drive lewat event).

### GET `/workspace/{workspace}/pengaturan` — baca saja
```json
{ "workspace":{"id","key","name","type","type_label","color","description","visibility","owner_id","arsip","previous_keys":[]},
  "can":{…}, "edit_on_desktop": true,
  "statuses":[{"id","name","kategori","kategori_label","color","posisi","tasks_count"}],
  "labels":[{"id","name","color","tasks_count"}],
  "drive":{"enabled","folder_url","folder_name","access":{…}} }
```
`edit_on_desktop` = pengguna boleh mengelola (tampilkan banner "Ubah di desktop"). Ubah kolom/label/key/visibilitas/arsip tetap desktop-only (PLATFORM §3) dan tidak punya endpoint di sini.

## 3. Otomasi (semua di balik `features.automation`, 404 saat mati)

Aturan terlihat hanya oleh anggota workspace-nya (tanpa peran global) — `AutomationRule::visibleTo` / `AutomationRulePolicy`. Membuat/mengubah/menduplikasi/menghapus aturan, tugas berulang, dan template tetap **desktop** (`create_on_desktop:true`).

### GET `/otomasi/aturan?workspace={id|key}`
```json
{ "aturan":[ RuleRow + {"runs_7d":2,"failed_7d":1} ],
  "stats":{"rules","active","runs_7d","success_7d","failed_7d"}, "create_on_desktop": true }
```
`RuleRow`:
```json
{ "id","name","workspace":{"id","key","name"},"is_active":true,"paused":false,
  "trigger_type":"task_moved|task_overdue|task_created_with_label","trigger_label":"Tugas pindah kolom",
  "trigger":{…},"condition":{…}|null,"actions":[{…}],
  "jika":"pindah ke kolom Selesai dan prioritasnya Urgent","maka":["beri tahu Dimas Pratama","tambah label \"Ditinjau\""],
  "sentence":"Jika tugas di Operasional pindah ke kolom Selesai dan prioritasnya Urgent, maka beri tahu Dimas Pratama dan tambah label \"Ditinjau\".",
  "run_count","last_run_at","created_by","can_manage":false }
```
Filter `workspace` tak dikenal/tak terlihat → `aturan: []`.

### GET `/otomasi/aturan/{ruleId}`
`{ "aturan": RuleRow, "runs":[{"id","task_id","task_key","task_title","result":"success|failed|skipped","result_label":"Berhasil","detail","ran_at"}] }` (30 terakhir). Bukan anggota workspace → 404.

### PATCH `/otomasi/aturan/{ruleId}/jeda`
Body `{paused: true|false}` → `{ "aturan": RuleRow, "message": "\"Nama\" dijeda." | "\"Nama\" aktif." }`. Hanya owner/admin workspace (403 untuk anggota biasa, 404 non-anggota); `SetAutomationRuleActive`. 422 bila `paused` kosong/bukan boolean.

### GET `/otomasi/berulang?workspace=`
```json
{ "berulang":[ { "id","title","workspace_id","assignee_id","priority","pattern","starts_on","ends_on","is_active","created_count","last_created_on","can_manage",
                 "workspace":{"id","key","name"}|null,"assignee_name","pattern_label":"Setiap Senin","next_dates":["2026-10-19","2026-10-26","2026-11-02"] } ],
  "today":"2026-10-14", "create_on_desktop": true }
```
`next_dates` kosong bila dijeda. Hanya baca di ponsel.

### GET `/otomasi/templat/tugas`
`{ "templat":[ {"id","name","description","title","priority","priority_label","estimate_hours","checklist":["…"],"labels":[{"id","name","color"}],"used_count","scope":"semua|workspace","workspace":{"id","key","name"}|null} ] }` — template seluruh perusahaan + milik workspace tempat penelepon menjadi anggota.

### POST `/workspace/{workspace}/tugas-dari-templat` — "Pakai template" (throttle 30/menit)
Body `{template_id, title, due_date?:"YYYY-MM-DD"}`. Aksi `ApplyTaskTemplate` di belakang `TaskTemplatePolicy::use` (viewer/arsip/template workspace lain → 403; template tak terlihat → 404; workspace tak terlihat → 404).
```json
201 { "task": {"id","key":"TMS-5","title","workspace":{"id","key","name"},"priority":{"value":3,"label":"Sedang"},"due_date":"2026-10-30"|null},
      "skipped_labels": ["Bug"], "message": "Tugas TMS-5 dibuat dari template \"Nama\". Label Bug tidak ada di workspace ini dan dilewati." }
```
Checklist dan estimasi template ikut dibuat; label yang belum ada dibuat bila penelepon pengelola workspace, selain itu dilewati dan dilaporkan.

## 4. Keputusan & batasan
- **Tidak ada** buat/ubah/hapus aturan otomasi, tugas berulang, template, kolom/label, arsip workspace, atau ubah key/visibilitas dari API (desktop; PLATFORM §3, pertanyaan pemilik #7/#8 di spec 05 dijawab konservatif: baca + jeda + pakai template + buat workspace + kelola anggota).
- **Drive**: baca (dokumen/file/cache) + buat dokumen/folder sinkron; semuanya 503 `drive_belum_siap` selama Google belum dikonfigurasi. Unggah chunk, tautkan Picker, dan sinkron manual tidak diekspos. Tes memakai `FakeDriveClient` dan `GoogleTesting::disable()`; Google asli tidak pernah dipanggil.
- Tampilan tersimpan (`/workspace/{id}/tampilan`) dikerjakan paket B3-A1 (tugas), bukan di sini.
- `PATCH /tugas/{id}/status` (paket tugas) tidak menerima `after_id/before_id`; urutan kartu lewat endpoint `papan/kartu/{task}` di atas.
- Pengelompokan `GET /workspace`: nilai `jenis` mengikuti enum web (`pribadi|divisi|proyek|lainnya`).
- Satu-satunya perubahan di luar rute baru: `Api\Workspaces\{WorkspaceController,WorkspaceBoardController,WorkspaceMemberController}` diperluas aditif; `Workspaces\WorkspaceController` (web) memakai `LinkableTeams` hasil ekstraksi tanpa perubahan perilaku; `WorkspaceApiTest` membandingkan subset kunci lama.
