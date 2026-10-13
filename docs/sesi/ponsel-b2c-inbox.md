# Ponsel Bagian 2 · B2-C — Inbox, cari, pengaturan notifikasi, push (FCM)

> Kontrak API v1 untuk aplikasi Android (prefiks `/api/v1`, `auth:sanctum` + `throttle:api-v1`; semua kecuali yang disebut). Rute baru di `routes/api/auth/b2c-inbox.php`; `GET /inbox` dan `POST /inbox/{id}/baca` tetap di `routes/api.php` (perilakunya diperluas di `Api\Inbox\InboxController`). Pengendali tipis di atas Action/Policy/query yang sama dengan web (`InboxQuery`, `Mark*/Archive*/Unarchive*` Action, `RunSearch` providers, `UpdateNotificationSettings`/`UpdateNotificationPreference`). Pesan galat berbahasa Indonesia. Acuan layar: `docs/mockups/android/spec/10-inbox-notifikasi-cari.md`.

Galat umum: `401` tanpa token, `422 {message, errors{field:[…]}}` validasi, `404` untuk notifikasi milik orang lain / tidak ada (Super Admin pun tidak melihat Inbox orang lain), `429` melebihi batas.

## 1. Item Inbox (bentuk bersama)

Semua endpoint Inbox mengembalikan item berbentuk ini (field `InboxNotificationResource` web + `target` + `android_channel`):

```json
{
  "id": "uuid", "type": "task.assigned", "category": "task|request|attendance|system|info",
  "icon": "plus", "tone": "primary|info|success|warning|danger|neutral", "type_label": "Ditugaskan",
  "title": "…", "body": "…|null (teks penuh, tidak dipotong)", "url": "/w/TMS/tasks/7#komentar-01C|null (URL web, jangan di-parse)",
  "actor": {"id","name","avatar"}|null,
  "subject": {"type":"App\\Models\\Task","id","code","title"}|null,
  "meta": {"context","context_tone","open_label","quote","plan_url","plan_label", …}|{},
  "action_required": true, "read_at": "ISO|null", "archived_at": "ISO|null", "created_at": "ISO",
  "target": {"type":"tugas","id":"01TASK…","anchor":"komentar-01C|null","params":{}}|null,
  "android_channel": "rk_tugas"
}
```

### `target` — tujuan ketukan (aplikasi tidak perlu mem-parsing `url`)
`{type, id, anchor, params}`; `null` = tidak ada layar tujuan → tampilkan lembar detail (`GET /inbox/{id}`), mis. `system.test` dan pengumuman bebas.

| `type` | `id` | `anchor` / `params` | Dipakai oleh jenis |
|---|---|---|---|
| `tugas` | ULID tugas | `komentar-{id}` | task.assigned/commented/due_soon/overdue, automation.notify, mention (tugas) |
| `catatan` | ULID catatan | – | mention (catatan) |
| `obrolan` | ULID kanal | `pesan-{id}` | chat.message, mention (obrolan) |
| `rapat` | ULID rapat | `notulen` (notulen/tindak lanjut); params `{tanggal: "YYYY-MM-DD"}` untuk seri | meeting.invited/starting, minutes.finalized, action_item.due |
| `pengajuan` | ULID pengajuan | – | request.approved/rejected/revision_requested/voided (pemohon) |
| `persetujuan` | ULID pengajuan | – | request.submitted, request.canceled (penyetuju) |
| `pengumuman` | ULID pengumuman | – | system.announcement (dari Pengumuman) |
| `briefing` | ULID briefing | – | briefing.posted (teks lengkap di `body`) |
| `proyek` | **kunci workspace** (mis. `PLQ`, diterima rute workspace) | `arahan`, `keputusan` | project.* |
| `okr` | ULID objective atau `null` (daftar OKR) | – | okr.* |
| `hiring` | ULID kandidat | – | hiring.* |
| `karyawan` | ULID karyawan | `permintaan-reset` | account.password_reset_requested (HR) |
| `absensi` | `null` | `hari-ini` | attendance.check_in/out_reminder, attendance.consent_revoked |
| `laporan` | `null` | – | report.reminder |
| `keamanan` | `null` | – | account.password_set_by_hr |

Layar yang belum ada di aplikasi (mis. proyek, hiring) → banner "Tersedia di desktop". Kode: `App\Domain\Notifications\Services\NotificationTarget` (diuji per jenis di `tests/Unit/Notifications/NotificationTargetTest.php`).

### `android_channel` — satu sumber kebenaran: enum `App\Domain\Notifications\Enums\AndroidChannel`
| Channel | Nama | Importance | Layar kunci | Jenis (`type`) |
|---|---|---|---|---|
| `rk_mendesak` | Perlu tindakan | high | private | request.submitted, request.revision_requested, task.overdue, project.update_requested, project.decision_needed, action_item.due, hiring.decision_needed |
| `rk_tugas` | Tugas & sebutan | high | public | task.assigned, mention, task.commented, task.due_soon, automation.notify |
| `rk_obrolan` | Obrolan | high | private | chat.message |
| `rk_rapat` | Rapat | high | public | meeting.invited, meeting.starting, minutes.finalized |
| `rk_pengajuan` | Pengajuan | default | private | request.approved, request.rejected, request.canceled, request.voided |
| `rk_pengingat` | Pengingat harian | default | public | attendance.check_in_reminder, attendance.check_out_reminder, report.reminder |
| `rk_proyek` | Proyek, OKR & hiring | default | private | project.update_reminder, project.direction, project.decision_resolved, okr.checkin_reminder, okr.objective_at_risk, hiring.candidate_received, hiring.candidate_decided |
| `rk_info` | Pengumuman & briefing | low | public | system.announcement, briefing.posted, system.test |
| `rk_keamanan` | Keamanan akun | high (tidak bisa dibisukan dari aplikasi) | private | account.password_reset_requested, account.password_set_by_hr, attendance.consent_revoked |
| `rk_sinkron` | Sinkron latar (teknis) | min | public | – (tidak ada jenis notifikasi) |

Tes memastikan **setiap** `NotificationType` terpetakan (`InboxB2cApiTest`). Katalog yang sama dikirim di `GET /pengaturan/notifikasi` → `push.android_channels` (`id, name, importance, lockscreen, mutable, types[]`) agar aplikasi membuat saluran dari server, bukan dari salinan.

## 2. Inbox

### `GET /inbox`
Query (semua opsional): `tab=semua|perlu-tindakan|diarsipkan` (bawaan `semua`), `belum-dibaca=1` (chip, bisa digabung tab apa pun), `jenis=mention|task|request|attendance|system|info` (chip jenis; `mention` = Disebut), `page` (≥1), `per_page` (1–50, bawaan 20). Urutan terbaru dulu. Paginasi **berhalaman** (bukan kursor); pakai `meta.current_page/last_page`.

200:
```json
{
  "items": [ <item> ],
  "unread": 2,
  "meta": {"current_page":1,"from":1,"last_page":1,"per_page":20,"to":3,"total":3,
           "counts": {"semua":3,"perlu_tindakan":1,"diarsipkan":1,"belum_dibaca":2}}
}
```
`counts` = badge tiap tab (global, tidak terpengaruh filter): `semua` = tidak diarsipkan, `perlu_tindakan` = `action_required` belum diselesaikan modul, `diarsipkan`, `belum_dibaca` (= `unread`, untuk lencana ikon aplikasi). 422: `tab`/`jenis`/`per_page`/`page` tidak valid.
Catatan perubahan: `meta` kini memuat `counts` dan item memuat `target`/`android_channel`; field lama tidak berubah.

### `GET /inbox/{id}`  (detail; `id` = UUID)
200 `{ "item": <item>, "unread": 2 }`. `body` selalu teks penuh (briefing "Informatif"). Tidak menandai dibaca (pakai `/baca`). 404 bila bukan milik pemanggil.

### Aksi satu notifikasi — `POST`, tanpa body
`/inbox/{id}/baca` (sudah ada) → `{ "unread": n }`.
`/inbox/{id}/belum-baca`, `/inbox/{id}/arsip`, `/inbox/{id}/batal-arsip` → 200
```json
{ "item": <item terbaru>, "unread": 2, "counts": {"semua":…,"perlu_tindakan":…,"diarsipkan":…,"belum_dibaca":…} }
```
Idempoten. Mengarsipkan juga menandai dibaca (Action web). 404 untuk notifikasi orang lain (tidak berubah).

### `POST /inbox/baca-semua`
Tanpa query = Action web (semua belum-dibaca yang tidak diarsipkan). Dengan `tab` dan/atau `jenis` (query atau body) hanya yang ditampilkan tab/chip itu. Tidak pernah menyelesaikan "Perlu tindakan". 200 `{ "marked": 3, "unread": 0, "counts": {…} }`.

### `POST /inbox/massal`
Body `{ "ids": ["uuid", …1–50, unik], "aksi": "baca|belum-baca|arsip" }`. Id milik orang lain/tidak ada **dilewati** (bukan galat), satu transaksi untuk sisanya. 200
```json
{ "affected": 2, "skipped": ["uuid-asing"], "unread": 0, "counts": {…} }
```
422: `ids` kosong/>50/bukan UUID/ganda, `aksi` tidak dikenal.

## 3. Cari global — `GET /cari` (throttle `search` 120/menit)
Query: `q` **wajib**, 2–100 huruf (setelah trim; 422 "Ketik minimal 2 huruf untuk mencari."), `tipe` opsional ∈ `tugas|orang|workspace|dokumen|catatan|pengajuan|rapat`.
Tanpa `tipe`: 5 hasil per grup (`search.limit`); dengan `tipe`: 20 (`search.group_limit`). Grup kosong tidak dikirim; urutan grup = urutan registry web (tugas, orang, workspace, dokumen, catatan, pengajuan, rapat). Grup "Aksi" web **tidak** disertakan. Penyaringan visibilitas ada di tiap provider (workspace pribadi, catatan terbatas, pengajuan orang lain, rapat yang tidak terlibat tidak pernah bocor). Catatan/rapat hanya muncul bila flag fiturnya aktif.

200:
```json
{
  "q": "peluncuran", "tipe": null, "terms": ["peluncuran"],
  "groups": [{
    "key": "rapat", "label": "Rapat", "has_more": false,
    "items": [{
      "id": "meeting:01…", "title": "Koordinasi peluncuran", "code": null,
      "subtitle": "Sel, 6 Okt 2026 · 10.00–11.00 WIB", "meta": "Google Meet",
      "snippet": null, "avatar": null, "icon": "calendar",
      "url": "/rapat/01…", "external": false,
      "target": {"type":"rapat","id":"01…","anchor":null,"params":{}}
    }]
  }]
}
```
`terms` = kata kueri (huruf kecil) untuk menyorot di judul/`snippet`; sorotan per-rentang tidak disediakan. `target.type` ∈ tugas, orang, workspace (id = ULID; `code` = kunci), dokumen (id = id berkas; buka `url` Google), catatan, pengajuan | persetujuan (penyetuju melihat `persetujuan`), rapat. `has_more` = ada hasil di luar halaman (ulangi dengan `tipe`).

### Provider Rapat baru (web + API)
`App\Domain\Search\Providers\MeetingSearchProvider` (key `meetings`, label "Rapat", min 2 huruf): `Meeting::visibleTo($viewer)` yang tidak dibatalkan, cocok pada judul, deskripsi, tempat, atau butir agenda; rapat berjalan/akan datang & seri aktif dulu. Terdaftar di `config/search.php` di balik `FEATURE_MEETINGS`; muncul otomatis di palet ⌘K (`/cari/hasil`, `group=meetings`). Tes: `tests/Feature/Search/MeetingSearchTest.php`.

## 4. Pengaturan notifikasi

### `GET /pengaturan/notifikasi`
200:
```json
{
  "matrix": [{"event":"task.assigned","label":"Ditugaskan ke saya","category":"task",
              "channels":{"in_app":{"enabled":true,"configurable":true,"supported":true},
                          "email":{…},"whatsapp":{"enabled":false,"configurable":false,"supported":true}}}],
  "categories": [{"value":"task","label":"Tugas"}, …],
  "channels": [{"value":"in_app","label":"In-app","available":true},{"value":"email",…},{"value":"whatsapp","label":"WhatsApp","available":false}],
  "settings": {"digest_enabled":true,"digest_time":"07:30","quiet_hours":true,"pause_while_on_leave":false},
  "quiet_window": {"start":"17:30","end":"07:00"},
  "email": "user@kantor.test",
  "push": {"follows":"in_app","server_ready":false,"android_channels":[ {id,name,importance,lockscreen,mutable,types[]} ]}
}
```
Baris terkunci (`configurable:false`, `enabled:true`): `request.pending` In-app; `system` In-app; `account.security` In-app + Email. WhatsApp = "Segera hadir" (`available:false`). Bawaan dari `config/notifications.php`. Jam tenang: jendela 17.30–07.00 + akhir pekan/libur diatur server; `quiet_hours` hanya menyalakan/mematikan penahanan email dan push. `push.server_ready=false` bila FCM belum dikonfigurasi di server.

### `PUT /pengaturan/notifikasi`  (atomik, semua kunci opsional)
```json
{ "digest_time": "08:15", "digest_enabled": false, "quiet_hours": false, "pause_while_on_leave": true,
  "preferences": [ {"event":"task.assigned","channel":"email","enabled":false} ] }
```
`digest_time` kelipatan 5 menit `JJ:MM`. `preferences` maks. 60 sel. Sel terkunci/tak didukung/tak tersedia (mis. WhatsApp) → **422** `errors.channel` dan seluruh panggilan di-rollback. 200 = bentuk yang sama dengan `GET` (layar terbaru). 422 pesan: "Jam kirim harus berformat JJ:MM dengan kelipatan 5 menit, mis. 07:30.", "Kejadian tidak dikenal." dst. Tidak ada kolom "Ponsel (push)": push mengikuti kolom **In-app** tiap baris (keputusan spec 10 §10 butir 6).

### `GET /pengaturan/notifikasi/ringkasan`
Pratinjau ringkasan harian hari ini (`DigestBuilder` web): `{ "digest": {"date":"2026-10-13","sections":[{key,title,tile_label,count,items[…],tone,note,more}]}, "empty": false, "digest_time": "07:30" }`. `empty=true` & `sections=[]` → tidak dikirim bila kosong.

### `POST /pengaturan/notifikasi/uji`  (throttle `notification-test` 5/menit)
Mengirim notifikasi `system.test` lewat kanal milik pengguna sendiri → 200 `{ "message": "Notifikasi uji dikirim. Periksa Inbox dan bilah notifikasi ponsel." }`.

## 5. Push (FCM HTTP v1)

**Konfigurasi** (`config/services.php` → `fcm`, `.env.example`): `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_JSON` (path absolut berkas JSON service account, di luar git). Token OAuth (scope `firebase.messaging`) dibuat dari JWT RS256 dan di-cache sampai 5 menit sebelum kedaluwarsa; 401 dari FCM → token diperbarui sekali lalu dicoba lagi. **Belum dikonfigurasi (kondisi saat ini: Firebase belum diberikan pemilik) = no-op + satu baris log `info` "FCM belum dikonfigurasi; push dilewati."; notifikasi tetap masuk Inbox/email. Push tidak pernah menggagalkan atau mengulang notifikasi** (semua galat jaringan/FCM hanya dicatat `warning`).

**Kapan dikirim** (`BaseNotification::via()`): hanya untuk pengguna yang punya ≥ 1 `devices.push_token`; mengikuti kolom **In-app** baris preferensinya (In-app mati → push mati); tidak dikirim saat notifikasi ditahan karena cuti (`pause_while_on_leave`); jam tenang (`quiet_hours` pengguna menyala, di luar 07.00–17.30 / akhir pekan / libur) menunda push seperti email (`withDelay`). Dikirim ke **setiap** perangkat yang punya token. Token mati: FCM `UNREGISTERED`/404 → `devices.push_token` dikosongkan; kegagalan lain (5xx, jaringan) tidak menyentuh token.

**Konten**: teks dari `externalPayload()` (judul netral untuk pengajuan sakit & pelamar hiring — sama seperti email), maks. judul 120 / isi 180 karakter. Tujuan dihitung dari `payload()` yang sama dengan item Inbox.

Pesan yang dikirim ke `POST https://fcm.googleapis.com/v1/projects/{FCM_PROJECT_ID}/messages:send` (satu per perangkat):
```json
{ "message": {
    "token": "<devices.push_token>",
    "notification": {"title": "Komentar baru di TMS-7", "body": "Sari: tolong cek angkanya"},
    "data": {
      "type": "task.commented",          // NotificationType
      "target": "tugas",                  // jenis target (tabel §1) atau "inbox" bila tanpa target
      "id": "01TASK…",                    // id target ("" bila tak ada); untuk target="inbox" = notification_id
      "anchor": "komentar-01CMT",         // "" bila tak ada
      "params": "{\"tanggal\":\"2026-10-06\"}", // JSON string ("{}" bila kosong)
      "android_channel": "rk_tugas",
      "notification_id": "uuid"           // id baris Inbox (POST /inbox/{id}/baca saat dibuka)
    },
    "android": {"priority": "HIGH|NORMAL", "notification": {"channel_id": "rk_tugas", "tag": "<notification_id>"}}
} }
```
Semua nilai `data` berupa string. `android.priority` HIGH untuk channel ber-importance high, selain itu NORMAL. Ketuk: aplikasi menandai dibaca (`POST /inbox/{notification_id}/baca`) lalu membuka `target` (`inbox` → `GET /inbox/{id}` lembar detail). Aplikasi membuat 9 saluran dari `push.android_channels` saat pertama dibuka dan mendaftarkan token lewat `PUT /perangkat/{device}/push-token` (sudah ada, Bagian 1).

## 6. Tes (semua hijau)
`tests/Feature/Api/InboxB2cApiTest.php` (11), `SearchApiTest.php` (8), `NotificationSettingsApiTest.php` (7), `tests/Feature/Search/MeetingSearchTest.php` (4), `tests/Feature/Notifications/FcmPushTest.php` (11, `Http::fake`), `tests/Unit/Notifications/NotificationTargetTest.php` (12). Tes lama yang disesuaikan karena perluasan: `Api/InboxApiTest` (meta kini ada `counts`), `Search/SearchTest` (grup Rapat di daftar grup layar cari).

## 7. Tidak dikerjakan / catatan
- Tidak ada `GET /inbox/feed` API (polling ringan): pakai `GET /inbox?belum-dibaca=1&per_page=1` → `unread` (rencana lama di spec §3); bisa ditambah bila perlu.
- Paginasi kursor tidak dibuat (halaman `page` dipertahankan agar kompatibel dengan klien Bagian 1).
- Sorotan per-rentang pada hasil cari tidak ada (`terms` disediakan). Pengaturan "Notifikasi di ponsel ini" (status saluran/izin) murni sisi klien.
- Pengiriman push sungguhan belum diuji ke Google (Firebase belum disediakan): diuji dengan `Http::fake` termasuk alur OAuth, 401, UNREGISTERED, dan galat transport.
