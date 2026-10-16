# Aplikasi Android — Bagian 3, paket B3-B: Catatan & notulensi (kontrak API)

> Dibuat 13 Okt 2026 (Claude Code, branch `claude/android-bagian-3`). Melengkapi kontrak catatan Tahap 2 di `docs/sesi/ponsel.md` (daftar per workspace, detail, simpan `PATCH`). Acuan layar: `docs/mockups/android/spec/07-catatan-notulensi.md`. Semua rute: `routes/api/auth/b3b-catatan.php` (grup `/api/v1` + `auth:sanctum` + `throttle:api-v1`), controller tipis di `app/Http/Controllers/Api/Notes/*` di atas Action/Policy web yang sama.

## Aturan umum

- **Auth:** `Authorization: Bearer <token>` (Sanctum). Tanpa token → 401.
- **Flag fitur:** semua endpoint di balik `features.notes` — mati → **404** (sama dengan web).
- **Galat JSON:** 401 tanpa token · 403 `{message}` (terlihat tetapi tidak berhak; pesan Indonesia dari Policy) · 404 (catatan tidak terlihat/tidak ada — tidak membocorkan keberadaan) · 422 `{message, errors:{field:[pesan]}}` (Bahasa Indonesia) · 409 konflik simpan (lihat bawah) · 429 throttle.
- **ID** = ULID. Waktu = ISO-8601 (`updated_at` dari server dipakai sebagai dasar simpan).
- **`note` (objek detail)** — bentuk yang sama dengan `GET /catatan/{id}` (Tahap 2) di semua respons `{note}` di bawah:

```json
{
  "id": "01J…", "workspace_id": "01J…", "parent_id": "01J…|null",
  "kind": "note|folder", "preset": "minutes|null",
  "title": "…", "access": "workspace|restricted",
  "created_by": "01J…|null", "updated_by": "01J…|null", "position": "a0",
  "created_at": "ISO", "updated_at": "ISO",
  "workspace_key": "OPS", "workspace_type": "personal|team|division|project",
  "can_edit": true, "can_share": true, "can_delete": true,
  "body_html": "<p>…</p>|null(folder)", "body_text": "…|null(folder)",
  "mobile_editable": true
}
```

- **Setiap perubahan (judul, pindah, pulihkan, simpan isi) memajukan `updated_at`.** Aplikasi wajib memakai `updated_at` terbaru dari respons sebagai dasar `PATCH {body_html, updated_at}` berikutnya (konflik 409, lihat bawah).
- **Kolaborasi realtime (Yjs) hanya di web.** API ponsel = autosave REST + 409 saat konflik + polling bila perlu. Tidak ada presence (lihat "Tidak dibangun").

### Konflik simpan (tidak berubah, ditegaskan)

`PATCH /catatan/{id}` `{body_html, updated_at}` dengan `updated_at` usang → **409** `{message:"Catatan ini baru saja diubah orang lain. Muat ulang untuk melihat versi terbaru sebelum menyimpan.", updated_at:"<ISO terbaru>"}`. Aplikasi memuat ulang (`GET /catatan/{id}`) lalu menyimpan lagi.

`409 {code:"rich_note", message:"Catatan ini berformat lengkap. Sunting di web."}` = catatan berformat dan editor **teks polos** mengirim `body_html`. **Baru (B3-B):** editor kaya mengirim `"rich": true` pada `PATCH {body_html, updated_at, rich:true}` → guard `rich_note` dilewati dan HTML berformat lengkap disimpan (whitelist `RichText`: heading, daftar, checklist, kutipan, kode, tebal/miring/tautan, `data-color`, `data-highlight`, mention, `#KEY-n`). Tanpa `rich` perilaku lama tidak berubah.

---

## 1. Pohon catatan

### `GET /workspace/{workspace}/catatan` (diperluas, kompatibel mundur)

Auth: Bearer. `{workspace}` = key atau ULID (tidak terlihat → 404).

```json
{
  "workspace": {"id":"01J…","key":"OPS","name":"Operasional","archived":false},
  "can_create": true,
  "notes": [ {"id","workspace_id","parent_id","kind","preset","title","access","created_by","updated_by","position","created_at","updated_at","penulis":"Nama|null","penyunting":"Nama|null"} ],
  "tree": [
    {
      "id":"01J…", "parent_id":null, "kind":"folder|note", "preset":"minutes|null",
      "title":"…", "access":"workspace|restricted", "invited_only":false,
      "position":"a0", "penulis":"…|null", "penyunting":"…|null", "updated_at":"ISO",
      "my_role":"author|edit|view", "can_edit":true,
      "children":[ { …node sama… } ]
    }
  ]
}
```

- `notes` = bentuk lama datar (tidak berubah; `workspace.archived` adalah satu-satunya tambahan di `workspace`). **Tidak ada kunci `data`** — bentuk lama memang memakai `notes`.
- `tree` = baris yang sama bersarang (folder di atas catatan, urutan manual `position`; `children` = isi folder dan sub-halaman).
- `invited_only` = `access == restricted` (lencana "Hanya diundang"). `my_role`: `author` (penulis dan boleh menyunting), `edit`, `view` (baca-saja: peran viewer, workspace diarsipkan, undangan baca). `can_edit = my_role != view`. Dihitung dengan jumlah query tetap (`NoteViewerRights`; diuji sama dengan `NotePolicy::canEdit`).
- Baris yang induknya tidak terlihat (mis. anak dari catatan `restricted` orang lain) dinaikkan ke akar `tree` (`parent_id` tetap nilai tersimpan).
- Hanya catatan yang lolos `Note::visibleTo` (aturan web) yang muncul.

### `POST /catatan` — buat catatan / folder / tab / sub-halaman

Request (JSON):

| Field | Aturan |
|---|---|
| `title` | wajib, string ≤ 200 ("Judul wajib diisi.") |
| `workspace_id` | ULID; wajib bila `parent_id` kosong. Bila hanya `parent_id` dikirim, workspace = milik induk |
| `parent_id` | ULID induk (folder atau catatan) di workspace yang sama; null = akar |
| `kind` | `note` (default) atau `folder` |

Respons **201** `{ "note": { …detail… } }`. Aturan `CreateNote`: folder hanya di akar atau di dalam folder (422 `errors.parent_id`: "Folder hanya bisa berada di akar atau di dalam folder lain."); induk tidak ditemukan/tidak terlihat → 422 `errors.parent_id`: "Folder atau catatan induk tidak ditemukan." (atau "…di workspace ini."). Workspace tidak terlihat → 404; viewer → 403 "Anda tidak dapat membuat catatan di workspace ini."; throttle 60/menit.

**Tab dokumen baru** = `POST /catatan {parent_id: <dokumen atau tab>, title: "Tab 3"}` (judul bawaan disarankan dari `GET /catatan/{id}/tab` → `next_tab_title` / `next_subtab_title`).

### `PATCH /catatan/{id}/pindah` — pindahkan / urutkan ulang

Request: `{ "parent_id": "01J…|null" (wajib hadir; null = akar), "position": 0 (opsional, indeks 0-basis) }`.

- Tanpa `position`: diletakkan di akhir saudara baru (perilaku `MoveNote` web).
- Dengan `position`: indeks di antara saudara **yang terlihat oleh pemanggil, sekelompok** (folder dengan folder, catatan dengan catatan); melebihi jumlah = di akhir. Dipakai juga untuk menyusun ulang di induk yang sama.
- Respons 200 `{ "note": { …detail, dengan updated_at/position baru… } }`.
- Galat: 422 `errors.parent_id` bila induk tidak ada / siklus ("Catatan tidak bisa dipindahkan ke dalam dirinya sendiri atau sub-catatannya.") / folder di bawah catatan; 422 bila `parent_id` tidak dikirim ("Kirim parent_id (null untuk memindahkan ke tingkat atas)."); 403 "Anda hanya dapat membaca catatan ini."; 404 tak terlihat. Throttle 120/menit.

### `DELETE /catatan/{id}` — hapus (soft delete)

Hak: penulis atau admin workspace (`NotePolicy::delete`; catatan di workspace pribadi: pemilik). Sub-catatan **naik satu tingkat** ke induk catatan yang dihapus (`DeleteNote`), tidak ikut terhapus.

Respons 200: `{ "deleted": true, "id": "01J…", "kind": "note|folder", "workspace_id": "01J…", "parent_id": "01J…|null" }` — `parent_id` = ke mana anak-anaknya pindah; tab yang dihapus mengembalikan aplikasi ke induk ini. 403 "Hanya penulis catatan atau admin workspace yang dapat menghapus catatan." · 404 tak terlihat / sudah terhapus. Rename tetap `PATCH /catatan/{id} {title}` (Tahap 2).

---

## 2. Tab dokumen

### `GET /catatan/{id}/tab`

Tab dan sub-tab dari dokumen yang memuat catatan ini (setara `documentRoot`/`documentTabs` web): dokumen = catatan teratas di atas `{id}` yang terlihat (folder menghentikan pendakian); tab = anak langsung berjenis catatan; sub-tab = anak tab. Folder dan halaman lebih dalam bukan tab. `{id}` folder → 404.

```json
{
  "root_id": "01J…", "active_id": "01J…",
  "can_create": true,
  "next_tab_title": "Tab 4",
  "tabs": [
    {"id":"01J…","parent_id":null,"title":"…","preset":"minutes|null","level":0,"tab_id":"01J…(dirinya)",
     "position":"a0","active":false,"my_role":"author|edit|view","can_edit":true,"updated_at":"ISO",
     "next_subtab_title":"Sub-tab 2"},
    {"id":"01J…","parent_id":"01J…","title":"…","level":1,"tab_id":"01J…(tab induknya)", "…":"…"}
  ]
}
```

Urutan: dokumen, lalu tiap tab diikuti sub-tabnya. `next_subtab_title` hanya pada `level` 0. `can_create` = boleh menulis catatan di workspace itu (tombol "Tab baru"). Membuat tab: `POST /catatan` dengan `parent_id`. Mengganti nama: `PATCH /catatan/{id} {title}`. Hapus tab: `DELETE /catatan/{id}` (pakai `parent_id` respons untuk kembali).

---

## 3. Notulensi cepat

### `POST /catatan/notulensi`

Tanpa body. `StartQuickMinutes`: catatan di workspace **Pribadi** milik pemanggil (dibuat bila belum ada), judul `Notulensi · <Hari>, dd/mm/yyyy HH.mm` (zona kantor), templat Peserta/Agenda/Pembahasan/Keputusan/Tindak lanjut, `preset: "minutes"`.

Respons **201** `{ "note": { …detail… }, "mode": "catat" }` — `mode:"catat"` = buka dalam mode catat (setara `?mode=catat` web). Catatan berformat → `mobile_editable:false`; editor harus kaya (`rich:true` saat simpan). Throttle 20/menit. 403 bila pengguna tidak aktif.

### `GET /catatan/notulensi/terakhir?limit=3` (juga `GET /catatan/notulensi`)

Untuk sheet "Notulensi terakhir". `limit` 1–10, bawaan 3. Hanya notulensi cepat yang bisa dibuka pemanggil, edit terbaru dulu (tab anak tidak dihitung).

```json
{ "minutes": [ {"id":"01J…","title":"Notulensi · Selasa, 13/10/2026 09.00","workspace_name":"Pribadi|Nama workspace|null","updated_at":"ISO"} ] }
```

---

## 4. Berbagi & akses

Hak: `NotePolicy::share` — penulis atau admin workspace; workspace pribadi tidak bisa dibagikan. Selain itu 403 "Hanya penulis catatan atau admin workspace yang dapat mengatur akses."; catatan tak terlihat 404.

### `GET /catatan/{id}/akses`

```json
{
  "share": {
    "note_id": "01J…",
    "access": "workspace|restricted",
    "access_label": "Workspace|Hanya diundang",
    "author": {"id":"01J…","name":"…","avatar":"url|null"} ,
    "people": [ {"user_id":"01J…","name":"…","avatar":null,"title":"jabatan","role":"edit|view","role_label":"Menyunting|Membaca"} ]
  }
}
```

### `PUT /catatan/{id}/akses` — ganti akses umum + daftar orang

Request: `{ "access": "workspace|restricted", "people": [ {"user_id":"01J…","role":"edit|view"} ] }` — `people` wajib hadir (boleh `[]`), maks 100, `user_id` unik. **Daftar mengganti yang tersimpan** (yang tidak disebut dicabut). Orang harus karyawan aktif perusahaan yang sama; selain itu 422 `errors.people`: "Ada orang yang tidak dapat diundang ke catatan ini." (Pilih orang lewat pencarian orang B2-B `GET /orang?q=` — endpoint ini hanya menerima id.)

Respons 200 `{ "share": { …sama dengan GET… } }`. Audit `note.share_updated` (sama web); sesi kolaborasi web yang terbuka disambung ulang. Throttle 30/menit. Tidak ada notifikasi undangan (web juga tidak mengirim).

### `DELETE /catatan/{id}/akses/{person}`

Mencabut satu undangan (`{person}` = ULID pengguna; `UpdateNoteShare` dengan sisa daftar, audit sama). Respons 200 `{ "share": {…} }`; orang itu tidak diundang → 404 "Orang ini tidak diundang ke catatan.".

---

## 5. Riwayat versi

Hak: siapa pun yang bisa membuka catatan membaca riwayat; memulihkan butuh hak menyunting (`NoteVersionPolicy`).

### `GET /catatan/{id}/versi`

```json
{
  "versions": [ {"id":"01J…","note_id":"01J…","title":"Judul saat itu","label":"Dipulihkan dari versi 1 Okt 2026 10.12|null","created_at":"ISO","author":{"id":"01J…","name":"…","avatar":null}|null} ],
  "can_restore": true
}
```

Terbaru dulu, maks 50, tanpa isi dokumen. `label` terisi untuk versi hasil pemulihan.

### `GET /catatan/{id}/versi/{version}` — pratinjau

`{ "version": { …baris di atas…, "body_html": "<p>…</p>", "body_text": "…" } }`. `body_html` dibuat `NoteHtml` (semua teks di-escape, hanya node whitelist) — aman dirender di WebView. Versi catatan lain → 404.

### `POST /catatan/{id}/versi/{version}/pulihkan`

`RestoreNoteVersion`: keadaan sekarang disimpan sebagai versi, lalu judul dan isi versi terpilih dipakai dan satu versi berlabel "Dipulihkan dari versi …" dibuat. Respons 200 `{ "note": {…detail…}, "versions": [ …daftar terbaru… ] }`. Pembaca → 403 "Anda hanya dapat membaca catatan ini.". Throttle 30/menit.

---

## 6. Pencarian & mention

### `GET /catatan/cari?q=&workspace_id=&limit=`

`q` wajib 2–100 karakter ("Kata kunci pencarian wajib diisi." / "Kata kunci minimal 2 karakter."); `workspace_id` opsional (ULID; hanya memfilter `results`); `limit` 1–50 (bawaan 30). Full-text `simple` (awalan pada kata terakhir) atau judul mengandung kata kunci, hanya catatan yang `visibleTo` pemanggil, edit terbaru dulu. Throttle 60/menit.

```json
{
  "query": "pengiriman",
  "total": 3,
  "workspaces": [ {"id":"01J…","key":"PRIBADI","name":"Pribadi|Nama","count":1} ],
  "results": [
    {"id","workspace_id","workspace_name","parent_id","kind","preset","title","access","invited_only":false,
     "snippet":"…cuplikan teks polos ±160 karakter di sekitar kata cocok…|null","penulis":"…|null","updated_at":"ISO"}
  ]
}
```

`workspaces[].count` dan `total` = semua catatan cocok yang terlihat **tanpa** filter `workspace_id`, untuk chip filter; `results` mengikuti filter dan `limit`. Pribadi didahulukan.

### `GET /catatan/{id}/mention?q=&limit=`

Picker "@" editor: karyawan aktif perusahaan (kecuali pemanggil) yang namanya cocok dan **bisa membuka catatan ini** (`NoteAudience` → `NotePolicy::canView`; anggota workspace/diundang/penulis diperiksa lebih dulu). `q` opsional ≤ 100, `limit` 1–20 (bawaan 8). Hak: harus bisa menyunting (viewer → 403). Throttle 120/menit.

```json
{ "people": [ {"id":"01J…","name":"…","avatar":"url|null","title":"jabatan"} ] }
```

### Mention dari `body_html`

Editor menyisipkan `<span data-mention="<user_id>">@Nama</span>` di `body_html` (atau bentuk render `data-type="mention" data-id="<user_id>"` — keduanya dibaca). Server (`NoteHtml` → `NoteContent::prepare` → `SyncNoteMentions`, sama persis web) menyimpan simpul mention dengan **nama asli**, hanya untuk orang yang bisa membuka catatan (selain itu jadi teks biasa), dan mengirim notifikasi `NoteMentionNotification` sekali per catatan per orang (tidak ke diri sendiri). `GET` mengembalikan mention sebagai `<span data-type="mention" data-id="…">@Nama</span>`. Catatan yang memuat mention berstatus `mobile_editable:false` → simpan lewat `PATCH` dengan `rich:true`.

---

## Perubahan pada rute/kode yang sudah ada

- `GET /workspace/{workspace}/catatan`: tambah `workspace.archived` dan `tree` (kunci lama utuh).
- `PATCH /catatan/{id}`: parameter opsional baru `rich` (boolean). `NoteUpdateRequest` + `Api\Notes\NoteController` (satu cabang). Tanpa `rich` tidak ada perubahan perilaku.
- `NoteHtml`: parser menerima `data-mention`. `MoveNote::handle` mendapat parameter opsional `?int $index` (web tidak mengirimnya → perilaku sama).
- `routes/api.php` **tidak diubah**.

## Tidak dibangun / catatan

- **`GET /catatan/{id}/pengguna-aktif` (presence): dilewati.** Web memakai awareness Yjs di server kolaborasi; tidak ada sumber presence di luar Yjs yang bisa dibaca REST. Aplikasi memakai 409 + polling `GET /catatan/{id}` (bandingkan `updated_at`).
- **Dikte (STT): tidak dibangun** (keputusan privasi pemilik tertunda, `docs/fitur/catatan-stt.md` §2).
- Pencarian orang untuk dialog Bagikan = B2-B `GET /orang?q=` (worktree lain); endpoint ini hanya menerima `user_id`.
- Notifikasi undangan akses tidak ada (web juga tidak mengirim); bila diminta, tambahkan di `UpdateNoteShare` agar web ikut.
- Mode catat / pil "belum tersimpan" / ukuran huruf = state lokal aplikasi (tanpa endpoint).

## Uji

`tests/Feature/Api/NoteB3bApiTest.php` (13 test: pohon + paritas hak dengan `NotePolicy`, buat/folder/tab, pindah/urut/siklus, hapus, tab dokumen, notulensi cepat, berbagi + audit, versi (pratinjau ter-escape, pulihkan), pencarian, picker mention, mention dari `body_html` + `rich`, flag mati 404 + 401) dan `tests/Unit/Notes/NoteHtmlTest.php` (2 test baru `data-mention`). Catatan harness: `withToken()` menempel pada test case, jadi test yang berganti pengguna wajib mengambil `$api` lagi; helper `pakaiB3b()` menjalankan satu panggilan `auth/saya` setelah ganti token (state aplikasi test dipakai bersama antarpermintaan; produksi tidak terpengaruh).
