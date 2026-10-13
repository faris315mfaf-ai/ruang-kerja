# Kontrak API v1 — B3-C Obrolan (Bagian 3, aplikasi Android)

> Paket kerja B3-C · 13 Okt 2026 · branch `claude/android-bagian-3`. Acuan layar: `docs/mockups/android/spec/09-obrolan.md`. Rute: `routes/api/auth/b3c-obrolan.php` (dimuat di grup `/api/v1` dengan `auth:sanctum` + `throttle:api-v1`; nama `api.v1.chat.*`). Controller: `app/Http/Controllers/Api/Chat/*` (tipis, Action/Policy yang sama dengan web), presenter `app/Http/Resources/Chat/ApiChatPresenter.php`, test `tests/Feature/Api/ChatB3cApiTest.php` (20 test) + `ChatApiTest.php` lama (tetap hijau).

## Aturan umum

- Semua rute di balik **`features.chat`** (`FEATURE_CHAT`): flag mati = `404` di setiap endpoint di bawah (juga rute lama `obrolan/kanal*`). Tanpa token = `401`.
- Header: `Authorization: Bearer <token>`, `Accept: application/json`. ID selalu ULID (huruf kecil), waktu ISO 8601 (UTC offset `+00:00`).
- **Visibilitas = `ChannelPolicy`/`MessagePolicy` web**: kanal privat/DM/grup yang bukan milik pengguna, atau pesan yang dihapus untuk sunting/reaksi, = `404` sebelum validasi (galat tidak membocorkan keberadaan). Workspace channel mengikuti `WorkspacePolicy::canView`; Direksi/HR/Super Admin yang bukan anggota workspace = **baca saja** (`can_post=false`, kirim = `403` "Hanya anggota workspace yang dapat mengirim pesan di sini."). Kanal diarsipkan = baca saja (`403` "Obrolan ini sudah diarsipkan dan hanya bisa dibaca.").
- Galat: `401 {message}` · `403 {message}` (teks Indonesia dari Policy) · `404 {message}` · `422 {message, errors:{field:[teks Indonesia]}}` · `429 {message}` (limiter `messages` 60/menit per pengguna untuk kirim/sunting/reaksi/buat/gabung/bisu, `search` 120/menit untuk cari/rujukan; JSON, pesan bawaan Laravel — klien menerjemahkan ke "Terlalu banyak pesan terkirim", hitung mundur dari header `Retry-After`).
- Jalur lama **tidak berubah** dan tetap bekerja: `GET /obrolan/kanal`, `GET|POST /obrolan/kanal/{channel}/pesan`, `POST /obrolan/kanal/{channel}/dibaca`. Jalur baru `/obrolan/{channel}/…` adalah alias yang sama untuk daftar (`GET /obrolan`), linimasa, kirim, dibaca. Respons lama hanya **bertambah kolom**.
- `{channel}` / `{message}` harus ULID; `{message}` harus milik `{channel}` (selain itu `404`).

## Bentuk bersama

**Baris pesan** (di `messages`, `message`, `root`, `replies`):

```jsonc
{
  "id": "01k…", "channel_id": "01k…", "user_id": "01k…", "parent_id": null,   // parent_id terisi = balasan thread
  "body": { "type": "doc", "content": [ … ] },        // Tiptap tersanitasi (node mention/taskReference); null bila dihapus
  "body_text": "Halo @Sari Wulandari",               // teks polos (pratinjau); "" bila dihapus
  "created_at": "…", "edited_at": null, "deleted_at": null,
  "reactions": [{ "emoji": "👍", "user_ids": ["…"] }],          // bentuk lama (tetap)
  "attachments": [{ "id": "<drive_file_id>", "name": "Anggaran.xlsx", "kind": "sheet", "web_view_link": "https://…", "size_bytes": 1234, "owner_email": null }],
  // ---- tambahan B3-C ----
  "penulis": { "id": "…", "nama": "Dimas Pratama", "initials": "DP" },   // bentuk lama + initials
  "author":  { "id": "…", "name": "Dimas Pratama", "initials": "DP" },
  "deleted": false, "deleted_label": null,            // dihapus: true + "Pesan ini dihapus"
  "reaction_summary": [{ "emoji": "👍", "count": 2, "mine": true }],     // urut sesuai 8 emoji tetap
  "mentions": [{ "user_id": "…", "name": "Sari Wulandari" }],
  "reply_count": 3, "last_reply_at": "…", "participants": [{ "id": "…", "name": "…", "initials": "SW" }],  // HANYA pesan akar (parent_id null); balasan yang dihapus tidak dihitung; participants maks. 3 (urut balasan pertama)
  "can": { "edit": true, "delete": true, "react": true, "reply": true }   // sudah memperhitungkan arsip, baca-saja, hapus; reply=false untuk balasan thread
}
```

Emoji reaksi tetap (8): `👍 🎉 ❤️ 😄 👀 🙏 ✅ 🚀`. Pesan terhapus: `body=null`, `body_text=""`, tanpa reaksi/lampiran/mention, `can` semua `false`; balasannya tetap ada.

**Referensi tugas** (`tasks`): `[{id, key:"PLQ-18", title, status_category, url}]` — hanya tugas yang terlihat penonton.

**Ringkasan kanal** (di daftar): bentuk `ChatInbox` web (`id, workspace_id, workspace{key,name,color}|null, type, name, topic, created_by, created_at, archived_at, members[{user_id,last_read_message_id,muted,role}], unread_count, last_message, can_post, can_manage`) + tambahan `title` ("#umum", nama lawan bicara untuk DM, "Maya, Sari +1" untuk grup), `is_member`, `members_count`, dan untuk **DM/grup saja** `members[].name` + `members[].initials` (kanal publik dengan anggota seluruh perusahaan sengaja tanpa nama).

**Detail kanal** (`channel`): 
```jsonc
{ "id", "type": "workspace|public|private|dm|group", "name", "topic", "title",
  "workspace": { "id","key","name","color","url":"/w/PLQ" } | null,
  "archived": false, "archived_at": null, "created_at",
  "is_member": true, "my_role": "owner|admin|member|null", "muted": false,
  "can_post": true, "can_manage": false,
  "members_count": 2, "members_has_more": false,
  "members": [ { "user_id","name","initials","avatar","title":"<jabatan>","role":"owner","role_label":"Pemilik","joined_at" } ] }   // maks. 50 pertama: pemilik, admin, lalu nama; tanpa status online (presence Reverb belum dipakai app)
```

## Endpoint

### 1. Daftar — `GET /api/v1/obrolan` (alias `GET /api/v1/obrolan/kanal`)
`200 { "channels": [<Ringkasan kanal>], "unread_total": 3, "unread_channels": 2 }`. `unread_total` = jumlah pesan akar belum dibaca dari orang lain di kanal tempat pengguna menjadi anggota; `unread_channels` = jumlah kanal berbadge (nilai `chatUnread` web; untuk badge tab). Kanal publik yang belum diikuti ikut terdaftar dengan `is_member:false` (pembeda "Belum bergabung").

### 2. Linimasa — `GET /api/v1/obrolan/{channel}/pesan?sebelum={id}` (alias `…/obrolan/kanal/{channel}/pesan`)
`200 { "messages": [<Baris pesan>], "tasks": [...], "has_more": bool }` — 30 akar per halaman (tua→baru di dalam halaman) + semua balasan thread akar tersebut. `sebelum` = id akar tertua yang sudah dimuat. Kanal tak boleh dibaca → `404`.

### 3. Kirim — `POST /api/v1/obrolan/{channel}/pesan` (alias `…/obrolan/kanal/{channel}/pesan`) · throttle `messages`
Body JSON:

| Field | Aturan |
|---|---|
| `body` | string ≤ 20.000; **wajib** kecuali ada `attachments`. Teks polos; `@Nama Lengkap` dan `#PLQ-18` yang diketik + id di bawah diubah server menjadi node mention / rujukan tugas |
| `parent_id` | ULID akar thread di kanal yang sama (opsional). Balasan harus ke **akar**, bukan ke balasan |
| `mentions` | `[user_id]` maks. 20. Hanya karyawan aktif yang bisa membaca kanal yang jadi mention + dinotifikasi (`ChatMentionNotification`, juga di kanal dibisukan); selain itu tetap teks biasa. Id yang namanya tidak diketik ditambahkan di akhir pesan |
| `task_refs` | `[task_id]` maks. 20. Hanya tugas yang terlihat penulis jadi node `taskReference`; selebihnya teks |
| `attachments` | `[drive_file_id]` maks. 10, file dari `GET …/file-drive` (cache `drive_files`, **tanpa panggilan Google**; hanya file yang bisa dibuka semua pembaca kanal) |

`201 { "message": <Baris pesan>, "tasks": [...] }`. Galat: `422` `errors.body` "Pesan tidak boleh kosong." / "Pesan maksimal 20.000 karakter.", `errors.parent_id` "Pesan utama tidak ditemukan." / "Balasan harus untuk pesan utama di obrolan ini.", `errors.attachments` (terlalu banyak / "Ada file yang tidak bisa dibuka semua anggota obrolan ini…"); `403` bukan anggota workspace / arsip; `404` kanal tak terlihat. Mengirim di kanal publik menggabungkan pengirim (perilaku web). Broadcast Reverb + notifikasi DM/grup tetap berjalan.

### 4. Thread — `GET /api/v1/obrolan/{channel}/pesan/{message}/balasan?setelah={reply_id}&per_page=30`
`{message}` = akar (boleh yang sudah dihapus); `per_page` 1–50. `200 { "root": <Baris pesan>, "replies": [<Baris pesan>] /* tua→baru */, "tasks": [...], "has_more": bool, "next_cursor": "<id balasan terakhir>"|null }`; halaman berikutnya = `setelah=next_cursor`. `404` bila `{message}` bukan akar di kanal itu.

### 5. Sunting — `PATCH /api/v1/obrolan/{channel}/pesan/{message}` · throttle `messages`
Body `{ body (wajib, ≤ 20.000), mentions?, task_refs? }` (aturan sama dengan kirim). Hanya pengirim (`MessagePolicy::update`) dan kanal masih boleh ditulis. `200 { "message": <Baris pesan> /* edited_at terisi */, "tasks": [...] }`. `403` bukan pengirim ("Hanya pengirim yang dapat mengubah pesan ini."), `404` pesan sudah dihapus / bukan di kanal ini, `422` `errors.body` ("Pesan tidak boleh kosong. Hapus pesan bila tidak diperlukan lagi.").

### 6. Hapus — `DELETE /api/v1/obrolan/{channel}/pesan/{message}`
Pengirim, atau admin/pemilik kanal (juga admin workspace untuk workspace channel) — penghapusan moderator masuk `audit_logs` (`message.deleted`). `200 { "message": <Baris pesan> /* deleted:true, deleted_label:"Pesan ini dihapus" */, "tasks": [] }`. `403` "Hanya pengirim atau admin obrolan yang dapat menghapus pesan ini.".

### 7. Reaksi — `POST|DELETE /api/v1/obrolan/{channel}/pesan/{message}/reaksi` · throttle `messages`
Body `{ "emoji": "👍" }` (salah satu dari 8; selain itu `422`). **Idempoten** (API menyaring toggle web): POST memastikan reaksi ada, DELETE memastikan hilang; ulangan tidak membalik. `200 { "reacted": true|false, "message": <Baris pesan>, "tasks": [...] }`. Syarat `MessagePolicy::react` (bisa menulis di kanal, pesan belum dihapus).

### 8. Buat obrolan — `POST /api/v1/obrolan` · throttle `messages`
- DM/grup: `{ "jenis": "langsung", "user_ids": ["…"] }` — 1 orang = DM, 2–8 orang = grup (maks. 9 anggota termasuk pembuat; pembuat otomatis anggota; `user_ids` berisi diri sendiri/orang di luar perusahaan/nonaktif diabaikan, kosong → `422` "Pilih minimal satu orang."). Himpunan orang yang sama selalu memakai percakapan lama (`direct_key`). Nama grup otomatis dari nama anggota (`title`), `name` selalu `null` (skema).
- Kanal: `{ "jenis": "kanal", "name": "Tim Konten Q4", "topic": "…"?, "private": false?, "member_ids": ["…"]? }` — nama dinormalisasi jadi slug (`tim-konten-q4`, 2–40 karakter setelahnya), publik kecuali `private:true`; pembuat = `owner`. Siapa pun karyawan aktif boleh (ChannelPolicy::create).

`201` (baru) atau `200` (DM/grup sudah ada) `{ "id": "…", "created": bool, "channel": <Detail kanal> }`. `422` bila `jenis` salah, `name` kosong ("Nama channel wajib diisi.") atau terlalu banyak orang ("Grup maksimal 9 orang. Buat channel untuk tim yang lebih besar."). Pemilih orang: `GET /orang?q=` (B2-B, worktree lain) — API ini hanya menerima id.

### 9. Jelajah & gabung kanal publik
- `GET /api/v1/obrolan/kanal-publik?q=&page=1&per_page=30` → `200 { "channels": [{ id, name, title:"#umum", topic, members_count, is_member, last_message_at|null }], "meta": { page, per_page, total, has_more } }`. Kanal publik aktif satu perusahaan (arsip tidak ikut), urut nama; `q` mencari nama/topik.
- `POST /api/v1/obrolan/{channel}/gabung` · throttle `messages` → `201 { "joined": true, "channel": <Detail> }` (baru bergabung) atau `200 { "joined": false, … }` (sudah anggota; idempoten). `422` `errors.channel` "Hanya channel publik yang bisa digabung." (privat/DM/grup/workspace) atau kanal diarsipkan. Mengirim pesan di kanal publik tetap menggabungkan secara implisit.
- **Keluar kanal (`DELETE …/keluar`) tidak dibangun**: web tidak punya aksi keluar/arsip/ubah nama/tambah anggota (backlog web).

### 10. Detail & anggota
- `GET /api/v1/obrolan/{channel}` → `200 { "channel": <Detail kanal> }`.
- `GET /api/v1/obrolan/{channel}/anggota?page=1&per_page=50` (≤ 100) → `200 { "members": [{ user_id, name, initials, avatar, title, role, role_label, joined_at }], "meta": { page, per_page, total, has_more } }`.

### 11. Bisukan — `PATCH /api/v1/obrolan/{channel}/bisu` · throttle `messages`
Body `{ "muted": true|false }` → `200 { "muted": bool }`. Bisu = tanpa notifikasi "Pesan baru" DM/grup; **mention tetap menotifikasi**. Bisukan kanal publik menggabungkan (perilaku web). `422` untuk `muted` hilang atau bukan anggota.

### 12. Status baca
- `POST /api/v1/obrolan/{channel}/dibaca` (alias lama `…/obrolan/kanal/{channel}/dibaca`, tak berubah): `200 { "dibaca": true }` — memajukan penunjuk (tidak pernah mundur) dan menandai notifikasi obrolan terkait dibaca.
- `GET /api/v1/obrolan/{channel}/dibaca-oleh/{message}` → `200 { "message_id", "recipients_count": 2, "read_count": 1, "readers": [{ id, name, initials }] }` — anggota (selain pengirim) yang penunjuk bacanya ≥ pesan itu; **hanya nama**, tanpa waktu baca (skema hanya menyimpan penunjuk). Maks. 100 pembaca. `403` "Hanya anggota obrolan yang dapat melihat siapa yang sudah membaca." bagi non-anggota (mis. pembaca baca-saja di kanal publik/workspace), `404` bila kanal tak terlihat. Label "Dibaca Maya, Rizky +1" dirakit klien dari daftar ini.

### 13. Cari di percakapan — `GET /api/v1/obrolan/{channel}/cari?q=rapat%20ang&sebelum={id}` · throttle `search`
`q` 2–100 karakter; tiap kata dicocokkan sebagai **awalan** pada `messages.search_vector` (config `simple`, tanpa stemmer); pesan terhapus tak muncul; terbaru dulu, 20 per halaman. `200 { "query", "messages": [<Baris pesan>], "has_more", "next_cursor": "<id terakhir>"|null }` (halaman berikutnya `sebelum=next_cursor`; balasan thread ikut dicari — `parent_id` terisi). Hak = membaca kanal (sama dengan linimasa; bukan-anggota kanal publik/workspace boleh, kanal tertutup `404`). **Pencarian lintas kanal tidak dibangun** (web belum punya).

### 14. Pembantu komposer
- `GET /api/v1/obrolan/rujukan/tugas?q=PLQ-18|judul` → `200 { "tasks": [{ id, key, title, status_category, url }] }` (maks. 8, tugas yang terlihat; throttle `search`).
- `GET /api/v1/obrolan/{channel}/file-drive?q=` → `200 { "files": [{ id, name, kind, web_view_link, size_bytes, owner_email }] }` (maks. 30; butuh hak kirim `ChannelPolicy::post`). Isi dari cache `drive_files`: **tidak ada kode 503 `drive_belum_siap`** karena Action web tidak memanggil Google; bila cache kosong daftar kosong. Unggah file dari kamera/galeri **belum ada** (web pun belum).

## Realtime (dokumentasi saja, tanpa kode baru)

Server Reverb mengirim event tipis (hanya id, tanpa isi — klien harus memuat ulang lewat endpoint terotorisasi di atas). Aplikasi v1 tetap polling; bila nanti berlangganan, otorisasi lewat `POST /broadcasting/auth` (belum dibuka untuk token Bearer — perlu paket tersendiri):

| Kanal | Event (`broadcastAs`) | Payload |
|---|---|---|
| `private-chat.{channel_id}` (otorisasi = `ChannelPolicy::view`) | `message.posted` | `{channel_id, message_id, parent_id}` |
| | `message.updated` (sunting & reaksi) | `{channel_id, message_id, parent_id}` |
| | `message.deleted` | `{channel_id, message_id, parent_id}` |
| | `read.updated` | `{channel_id, user_id, last_read_message_id}` |
| `private-App.Models.User.{user_id}` | `chat.activity` | `{channel_id}` — ada pesan baru di kanalmu (badge daftar/tab) |
| `presence-chat-online.{company_id}` | (presence) | siapa online; "sedang mengetik" = whisper di kanal `chat.{id}`, sama dengan web |

Event dikirim di antrean `realtime` setelah commit. Jaringan terputus: polling `GET /obrolan` (daftar+badge) dan linimasa tiap 15 dtk saat fokus.

## Yang sengaja tidak dibangun / catatan untuk integrator

- `DELETE /obrolan/{channel}/keluar`, arsip kanal, ubah nama/tambah anggota: tidak ada Action web.
- Pencarian pesan lintas kanal: web belum punya.
- Daftar orang (`GET /orang?q=`): B2-B, worktree lain; kontrak ini hanya menerima `user_ids` / `member_ids` / `mentions` berupa ULID.
- Waktu baca per orang ("Dibaca pukul 08.01"): tidak ada di data (hanya penunjuk).
- Isi grup tidak bisa diberi nama (skema `name` NULL untuk DM/grup, CHECK).
- `GET /obrolan/rujukan/tugas` web kini memakai kelas bersama `App\Domain\Chat\Queries\TaskReferenceSuggestions` (perilaku identik).
