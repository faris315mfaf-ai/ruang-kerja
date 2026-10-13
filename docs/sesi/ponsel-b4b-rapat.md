# Aplikasi Android — Bagian 4, paket B4-B: Rapat, kalender, notulen & video (kontrak API)

> Dibuat 13 Okt 2026 (Claude Code, branch `claude/android-bagian-4`). Melengkapi kontrak rapat Tahap 2 di `docs/sesi/ponsel.md` (agenda `GET /rapat`, detail `GET /rapat/{id}`, RSVP, notulen baca `GET /rapat/{id}/notulen`, kalender `GET /kalender` — **tidak berubah**). Acuan layar: `docs/mockups/android/spec/08-rapat-kalender-video.md`. Semua rute baru: `routes/api/auth/b4b-rapat.php` (grup `/api/v1` + `auth:sanctum` + `throttle:api-v1`), controller tipis di `app/Http/Controllers/Api/Meetings/{MeetingWrite,MinutesWrite,ActionItem,VideoRoom,AutoMinutes,ManagementSchedule}Controller.php` di atas Action, Policy dan FormRequest web yang sama (`SaveMeetingRequest`, `SaveMinutesRequest`, `ActionItemRequest`, … ; `MeetingPolicy`, `MeetingTranscriptPolicy`).

## Aturan umum

- **Auth:** `Authorization: Bearer <token>`. Tanpa token → 401.
- **Flag fitur:** semua endpoint di balik `features.meetings` — mati → **404** (sama dengan web).
- **Galat JSON:** 401 · 403 `{message}` (rapat terlihat tetapi tidak berhak; pesan Indonesia dari Policy) · **404** (rapat tidak terlihat/tidak ada, tindak lanjut bukan milik rapat itu — keberadaan tidak bocor) · 422 `{message, errors:{field:[pesan]}}` · 409 `{message}` (notulen otomatis: konflik) · 429 throttle · 502/503 video (lihat §4).
- **ID** = ULID. Waktu = ISO-8601 UTC (`…Z`); tanggal kantor `YYYY-MM-DD` (WIB). Aplikasi memformat WIB sendiri.
- **`?tanggal=YYYY-MM-DD`** memilih satu kemunculan seri (body boleh juga `tanggal`). Tanpa tanggal: notulen/tindak lanjut/transkrip memakai kemunculan terakhir yang sudah mulai (`resolveForMinutes`), video memakai kemunculan hari ini/berikutnya (`resolve`) — sama dengan web.
- **Objek bersama:**
  - `notulen` = `MeetingPresenter::minutes` web, sama persis dengan `notulen` pada `GET /rapat/{id}/notulen`:
    `{id|null, meeting_id, meeting_key, href, status: draft|final, saved_at, version_count, finalized_at, co_editor_id:null, attendance:[{user_id, present, reason}], sections:[{title, body}], decisions:[string], action_items:[item], source: continue|template|blank|null}`.
  - `item` (tindak lanjut) = `{id, text, assignee_id|null, due_date|null, task_key|null, task_url|null, done}`.
  - `person` = `{id, name, title, division, avatar_url}`.
- **Realtime:** web memakai kanal privat Reverb `meeting.{id}` (`minutes.updated`, `attendance.updated`, `speaking.updated`, `participant.called`, `participant.readmitted`, `minutes.editing`). Belum ada klien Echo di ponsel → **polling**: kehadiran & waktu bicara 15 detik di ruang, notulen 15–30 detik saat layar terbuka.

---

## 1. Jadwalkan, ubah, batalkan

### `GET /rapat/formulir[?rapat={id}]`
Data formulir Jadwalkan/Ubah. Tanpa `rapat` = formulir baru (semua karyawan aktif). Dengan `rapat`: tidak terlihat → 404; bukan penyelenggara / sudah dibatalkan → 403.
```json
{
  "viewer_id": "01J…",
  "people": [person],                       // semua karyawan aktif perusahaan, urut nama (= form web)
  "workspaces": [{"id","key","name"}],      // workspace tempat viewer bisa membuat tugas (target "Jadikan tugas")
  "can_lead": false,                         // boleh menandai Rapat pimpinan (dashboard.view_company)
  "durations": [15,30,45,60,90,120,180,240],
  "reminders": [5,10,15,30,60],
  "platforms": ["meet","zoom","room","client","video"],
  "recurrences": ["none","weekdays","weekly","mon_wed_fri"],
  "video_enabled": true,                     // LiveKit dikonfigurasi → tampilkan "Video RuangKerja"
  "auto_minutes_enabled": false,             // server transkripsi siap → tampilkan sakelar Notulen otomatis
  "auto_minutes_notice": "Notulen otomatis aktif — suara Anda ditranskrip setelah rapat. …",
  "auto_minutes_notice_points": ["Audio dihapus segera setelah transkripsi.", "…"],
  "meeting": null | {"id","title","description","date":"2026-10-06","start":"13:30","duration":60,
    "platform","join_url","location","participant_ids":[…],"guest_emails":[…],"agenda":[…],
    "recurrence","recurrence_until","reminders":[15,5],"minute_taker_id","workspace_id",
    "leadership":false,"auto_minutes":false}
}
```

### `GET /rapat/peserta?q=`
Pemilih peserta/notulis (himpunan sama dengan `people` formulir, cari nama/email, maks. 50). `GET /orang` **tidak** dipakai karena dibatasi `User::visibleTo` (staf hanya melihat dirinya), sedangkan form rapat web mengundang semua karyawan aktif. → `{"people":[person]}`. `q` > 100 karakter → 422.

### `GET /rapat/bentrok?peserta[]=…&tanggal=YYYY-MM-DD&mulai=HH:MM&durasi=60[&abaikan={id}]`
Cek bentrok = `FindConflicts` web (parameter web: tanggal + jam mulai + durasi menit 5–720, bukan `selesai`). `abaikan` = rapat yang sedang diubah.
```json
{"conflicts":[{"user_id","title","starts_at","ends_at"}], "suggestion":"15:30"|null}   // jam mulai bebas pertama (WIB, HH:MM) bila ada bentrok
```

### `POST /rapat` (throttle 30/menit)
Body = form web (`SaveMeetingRequest`):
```json
{
  "title":"Review vendor", "description":null,
  "date":"2026-10-06", "start":"13:30", "duration":60,
  "platform":"meet|zoom|room|client|video",
  "join_url":"https://…|null",      // wajib untuk zoom; https saja
  "location":"…|null",               // wajib untuk room/client
  "participant_ids":["01J…"],        // karyawan aktif (min. 1 selain diri sendiri atau 1 tamu)
  "guest_emails":["tamu@luar.com"],  // opsional, maks. 30 (tamu belum menerima apa pun)
  "agenda":["Butir 1","Butir 2"],    // min. 1 butir terisi, maks. 20
  "recurrence":"none|weekdays|weekly|mon_wed_fri", "recurrence_until":"2026-10-30|null",
  "reminders":[15,5],                // subset 5,10,15,30,60
  "minute_taker_id":"01J…|null", "workspace_id":"01J…|null",
  "leadership":false,                // diabaikan bila tanpa izin dashboard.view_company
  "auto_minutes":false               // hanya video & bila server transkripsi siap
}
```
→ **201** = isi `GET /rapat/{id}` (kemunculan pertama) + pesan:
```json
{"message":"Undangan rapat terkirim ke 2 peserta.", "invited":2,
 "meeting":{…detail…}, "can":{"rsvp","edit","join_video"}, "video":{…}|null,
 "auto_minutes_notice":"…"|null}      // teks persetujuan bila auto_minutes aktif
```
422 contoh (pesan web): `participant_ids` "Undang minimal satu peserta selain Anda.", `agenda` "Tambahkan minimal satu butir agenda.", `join_url` "Tempel tautan Zoom lengkap, misalnya https://zoom.us/j/81234567890.", `platform` "Video RuangKerja belum disiapkan di server ini. Pilih Google Meet atau Zoom.", `start` "Jam mulai sudah lewat. Pilih jam yang akan datang.", `auto_minutes` "Notulen otomatis hanya untuk rapat Video RuangKerja.". Undangan (`meeting.invited`) terkirim seperti web.

### `PATCH /rapat/{id}`
Body sama dengan `POST` (semua isian). **Semantik seri = web:** perubahan berlaku untuk seluruh seri (tidak ada ubah satu kemunculan); tanggal boleh lampau. Hanya penyelenggara (403 "Hanya penyelenggara yang dapat mengubah rapat ini."), rapat dibatalkan → 403. → 200 `{message:"Perubahan rapat disimpan.", meeting, can, video, auto_minutes_notice}`.

### `POST /rapat/{id}/batal` (juga `DELETE /rapat/{id}`)
`CancelMeeting` web: membatalkan rapat / **seluruh seri**, peserta diberi tahu. Hanya penyelenggara. → 200 `{message:"Rapat dibatalkan. Peserta sudah diberi tahu.", meeting:{…, canceled:true}, can, video}`. Batal lagi → 403 "Rapat ini sudah dibatalkan.". **Tidak ada "buka kembali rapat"** dan tidak ada pembatalan satu kemunculan — web juga belum punya.

---

## 2. Notulen (tulis)

Penulis = notulis atau penyelenggara (`editMinutes`); notulen final → 403 "Notulen sudah final. Buka kembali draf untuk mengubahnya.". Mode ponsel = **autosave REST** (last write wins, seperti web tanpa server kolaborasi). Kolaborasi Yjs tetap web.

### `PUT /rapat/{id}/notulen?tanggal=`
```json
{"attendance":[{"user_id":"01J…","present":true,"reason":null}],
 "sections":[{"title":"Status pengiriman","body":"teks polos"}],
 "decisions":["Kampanye mulai 20 Oktober"],
 "attendance_only":false}
```
`attendance_only:true` → hanya kehadiran yang disimpan (bagian & keputusan dipertahankan; `sections/decisions` boleh dikosongkan). Batas: kehadiran 200, bagian 40 (body 20.000), keputusan 50 × 500. **Versi:** `SaveMinutes` web — simpanan yang mengubah isi menambah versi, kecuali versi terakhir milik penulis yang sama dan < 5 menit (versi itu diperbarui); finalisasi selalu menambah versi. → `{notulen}`.

### `POST /rapat/{id}/notulen/final?tanggal=`
→ 200 `{message:"Notulen final dan dibagikan ke peserta.", notulen}` (notifikasi `minutes.finalized` ke peserta). Belum lengkap → **422** daftar masalah:
```json
{"message":"…","errors":{"minutes":["Tandai minimal satu peserta yang hadir.","Tindak lanjut 1 belum punya penanggung jawab.","Tindak lanjut 1 belum punya tenggat."]}}
```

### `POST /rapat/{id}/notulen/buka?tanggal=`
Penyelenggara saja (403 "Hanya penyelenggara yang dapat membuka kembali notulen."); notulen masih draf → 403 "Notulen masih berupa draf."; belum ada notulen → 404. → `{message:"Notulen dibuka kembali sebagai draf.", notulen}`.

### `GET /rapat/{id}/notulen/versi?tanggal=`
Riwayat (baca saja; semua yang boleh membaca notulen). **Pulihkan versi tidak ada** (web juga belum).
```json
{"minutes_id":"01J…|null","occurrence_date":"2026-10-05","status":"draft|final",
 "versions":[{"id","number":3,"created_by":{"id","name"}|null,"created_at","updated_at"}]}   // terbaru dulu
```

### `GET /rapat/{id}/notulen/versi/{version}?tanggal=`
→ `{version:{id, created_by, created_at, updated_at, attendance:[…], sections:[{title,body}], decisions:[…]}}`; versi bukan milik notulen kemunculan itu → 404.

### `POST /rapat/{id}/notulen/menyunting?tanggal=` `{active:true|false}`
Penanda "X sedang menyunting" (TTL pendek). TTL 30 detik — kirim `true` tiap ±20 detik selama menyunting, `false` saat keluar. → `{editing: {user_id, name, since, expires_at}|null}` = pemegang penanda sekarang: diri sendiri bila berhasil memegang, orang lain bila dia sedang menyunting (tampilkan "X sedang menyunting", hindari menimpa), null setelah melepas.

### `POST /rapat/{id}/sumber-notulen?tanggal=` `{source: continue|template|blank}`
Pra-gabung rapat **video** (`openVideo` + `editMinutes`): cara notulen kemunculan dimulai, dipilih **sekali** (pilihan berikutnya tidak mengubah apa pun, `applied:false`). Bukan rapat video → 404; peserta biasa → 403.
```json
{"applied":true,
 "notes_source":{"chosen":"template","chosen_by","chosen_at","can_choose":false,"suggested":"continue|template",
   "previous":{"occurrence_date","href","status","open_count"}|null,
   "open_follow_ups":[item + "overdue"],
   "template":{"key":"agenda","label","sections":[…],"blocks":["Keputusan","Tindak lanjut"]}},
 "notulen":{…}}
```

---

## 3. Tindak lanjut

`{item}` selalu bersarang di rapatnya (`/rapat/{id}/tindak-lanjut/{item}`); tindak lanjut rapat lain → 404.

| Metode & path | Hak | Body | Respons |
|---|---|---|---|
| `GET /rapat/{id}/tindak-lanjut?tanggal=` | yang melihat rapat | — | `{occurrence_date, minutes_status, items:[item], workspace:{id,key,name}|null, workspaces:[…] (pilihan target bila rapat tanpa workspace & viewer penulis), can:{edit, manage}}` |
| `POST /rapat/{id}/tindak-lanjut?tanggal=` | `editMinutes` | `{text?, assignee_id?, due_date?}` | **201** `{item}` |
| `PATCH /rapat/{id}/tindak-lanjut/{item}` | `{done}` saja: penanggung jawab/notulis/penyelenggara (juga setelah final); isian lain: `editMinutes` | `{text?, assignee_id?, due_date?, done?}` | `{item}` |
| `DELETE /rapat/{id}/tindak-lanjut/{item}` | `editMinutes` | — | `{deleted:true}` |
| `POST /rapat/{id}/tindak-lanjut/{item}/jadikan-tugas` | `manageActionItems` (notulis/penyelenggara, draf & final) + `editTasks` workspace | `{workspace_id?}` | `{created:0|1, item}` — **idempoten**: sudah punya tugas → `created:0`, item sama |
| `POST /rapat/{id}/tindak-lanjut/jadikan-semua?tanggal=` | sama | `{item_ids:[…] (wajib, maks. 50), workspace_id?}` | `{created:n, notulen}` |
| `POST /rapat/{id}/tindak-lanjut/ingatkan?tanggal=` | `manageActionItems` | — | `{reminded:[user_id], message}` |

- Workspace target = workspace rapat; rapat tanpa workspace → `workspace_id` wajib (422 `workspace_id` "Pilih workspace untuk tugas tindak lanjut."); tanpa hak ubah tugas di workspace → 403.
- **Ingatkan** = `RemindActionItemOwners` web: semua tindak lanjut terbuka berpenanggung jawab di kemunculan itu, **maks. sekali sehari per tindak lanjut** (de-dup `notification_dispatch_logs`). `message`: "Pengingat terkirim ke N penanggung jawab." / "Tidak ada penanggung jawab yang perlu diingatkan hari ini.". Ingatkan **per butir** tidak ada di web → tidak dibuat.

---

## 4. Video RuangKerja (LiveKit)

Hak: `openVideo` = penyelenggara/notulis/peserta internal rapat platform `video` (bukan video → **404**; pengamat rapat pimpinan yang tidak diundang → 403 "Anda tidak diundang ke rapat ini."). `joinVideo` = `openVideo` + jendela gabung **15 menit sebelum mulai s.d. 2 jam sesudah selesai** (`livekit.join_before_minutes` / `join_after_minutes`) (penyelenggara kapan saja) + tidak sedang dikeluarkan.

### `GET /rapat/{id}/video/ruang?tanggal=`
Data pra-gabung/ruang = prop `room` web (`RoomPresenter`) + ringkasan notulen otomatis:
`{room:{viewer, meeting{…}, people:[person], participants:[…], agenda, minutes:{mode:"collab|autosave", doc:notulen, can_edit, can_edit_attendance, can_finalize, editing, …}, notes_source, speaking, video:{configured, opens_at, closes_at, is_organizer, can_join, denied_reason, attendance, in_room, not_joined, removed, …}, features:{video_configured, realtime, subtitles, auto_minutes, collab_minutes}, can:{edit_minutes, choose_notes_source, moderate, call_participants, report_speaking}, channel:"meeting.{id}", links:{…path web…}}, notulen: summary|null}`. Path di `links` adalah rute web — aplikasi memakai endpoint API di dokumen ini.

### `POST /rapat/{id}/video/token?tanggal=` (throttle 30/menit)
```json
{"url":"wss://livekit.spkd.store", "token":"<JWT HS256>", "room":"rk-{meeting}-{yyyymmdd}",
 "identity":"<user ULID>", "name":"Rizky Aditya", "expires_at":"…Z",   // TTL config livekit.token_ttl (600 dtk)
 "occurrence_date":"2026-10-05",
 "role":"organizer|minute_taker|participant",
 "can":{"moderate":false,"call_participants":false,"edit_minutes":false},
 "people":[person]}                        // nama/avatar per identity — jangan percaya nama dari LiveKit
```
Galat:
- **503** `{code:"video_belum_siap", message:"Video RuangKerja belum disiapkan di server ini. Hubungi admin."}` (LiveKit tidak dikonfigurasi).
- **403** `{message, code, opens_at, closes_at}` dengan `code`: `ruang_belum_dibuka` ("Ruang rapat dibuka pukul 09.45."), `ruang_ditutup` ("Rapat sudah selesai. Ruang rapat sudah ditutup."), `dikeluarkan` ("Penyelenggara mengeluarkan Anda dari rapat ini."), `tidak_diizinkan` (lainnya).
- Token **tanpa** `roomAdmin` dan **tanpa** `canUpdateOwnMetadata`: boleh publish kamera/mikrofon/layar/data. Menyambung ulang = minta token baru.

### Moderasi (penyelenggara; LiveKit Room Service API di server)
| Path | Body | Respons |
|---|---|---|
| `POST /rapat/{id}/video/bisukan` | `{user_id, track_sid:"TR_…"}` (SID track mikrofon peserta dari LiveKit) | `{ok:true}` |
| `POST /rapat/{id}/video/keluarkan` | `{user_id}` | `{ok:true}` — dicatat `meeting_video_removals`, token baru ditolak `dikeluarkan` |
| `POST /rapat/{id}/video/izinkan-masuk` | `{user_id}` | `{readmitted:true|false}` |

Bukan penyelenggara → 403 "Hanya penyelenggara yang dapat mengatur peserta rapat."; diri sendiri → 422 "Pakai tombol di bilah kontrol untuk diri Anda sendiri."; `track_sid` kosong/salah → 422 "Mikrofon peserta tidak ditemukan."; LiveKit gagal → **502** `{code:"server_rapat_gagal", message:"Server rapat tidak menjawab. Coba lagi."}`; tanpa LiveKit → 503. Semua diaudit seperti web.

### Angkat tangan & atribut (server-side, `joinVideo`)
- `POST /rapat/{id}/video/tangan` `{raised:true|false}` (30/menit) → `{hand:"<epoch ms>"|""}`. Server menulis atribut LiveKit `hand` (jam server = urutan tangan). Peserta lain melihatnya lewat `participant.attributes.hand` (event `ParticipantAttributesChanged`); nilai > 0 = tangan terangkat.
- `POST /rapat/{id}/video/atribut` `{attributes:{hand?:"", rk_minutes_at?:"<bagian>"}}` (60/menit) → `{attributes}`. Hanya kunci whitelist (`hand` = angka 10–16 digit atau "", `rk_minutes_at` = `[A-Za-z0-9_.:-]{1,64}` = bagian notulen yang sedang dilihat). Kunci lain → 422.

### Waktu bicara
- `GET /rapat/{id}/video/waktu-bicara?tanggal=` (`openVideo`) → `{occurrence_date, total_ms, updated_at, people:[{user_id, ms, share}], silent:[user_id], mine_ms, interval_seconds:15}`.
- `POST /rapat/{id}/video/waktu-bicara` `{ms}` (`joinVideo`, 20/menit) — **total kumulatif milik sendiri** (bukan delta), tiap 15 detik dan saat keluar; mulai dari `mine_ms`. Server tidak pernah menurunkan nilai dan membatasinya dengan waktu sejak masuk ruang. → isi GET + `accepted_ms`. Label UI: "bukan penilaian kinerja".

### `GET /rapat/{id}/video/kehadiran?tanggal=` (`openVideo`)
```json
{"attendance":[{"user_id","joined_at","left_at"|null,"duration_seconds","in_room","sessions","late_minutes","late"}],
 "in_room":2,
 "not_joined":[{"user_id","rsvp","optional","called_at"|null}],
 "late_grace_minutes":2,
 "removed":[{"user_id","removed_by","removed_at"}]}
```
Diisi dari webhook LiveKit (`meeting_attendances`).

### `POST /rapat/{id}/video/panggil/{user}?tanggal=` (`callParticipant`: penyelenggara/notulis)
"Panggil" peserta undangan yang belum masuk (notifikasi `meeting.called`). → `{called:{user_id, called_at, called_by}}`; 1×/menit per orang → **429** `{message, retry_after}` + header `Retry-After`; tidak diundang/sudah di ruang/ruang tutup → 422 `errors.user`.

### Catatan sambungan LiveKit untuk aplikasi (`@livekit/react-native`)
- Sambung ke `url` dengan `token`; `identity` = ULID karyawan; worker notulen tersembunyi ber-identity `rk-notulen` (bukan orang — sembunyikan dari petak).
- **Obrolan** tidak lewat backend dan tidak disimpan: web memakai `useChat` `@livekit/components-react` (components-core 0.12): kirim teks lewat **text stream topik `lk.chat`** (`localParticipant.sendText`) dan juga data packet lama **topik `lk-chat-topic`** berisi JSON `{id, timestamp, message, ignoreLegacy?}` (`sendChatMessage`). Aplikasi native sebaiknya memakai hook chat yang sama dari `@livekit/components-react`/`components-core` agar kompatibel dua arah.
- **Penanda notulen disimpan**: data packet reliable **topik `rk.minutes`** berisi `{"date":"YYYY-MM-DD"}` = "notulen baru disimpan, muat ulang" (tanpa isi). Setelah `PUT …/notulen` kirim paket ini; saat menerimanya, panggil `GET /rapat/{id}/notulen?tanggal=`.
- **Subtitle**: text stream **topik `lk.transcription`**, hanya terima dari identity `rk-notulen`; atribut stream `lk.segment_id`, `lk.transcribed_track_id`, `lk.transcription_final` ("true"). Tampilkan bila `room.features.subtitles` atau ada stream masuk.
- **Angkat tangan**: atribut `hand` (lihat di atas) — jangan `setAttributes` dari klien (token tidak mengizinkan).
- **Kehadiran bagian notulen**: atribut `rk_minutes_at` lewat `POST …/video/atribut`.
- Panggilan/kehadiran/waktu bicara realtime di web lewat Reverb `meeting.{id}` — ponsel polling `kehadiran` dan `waktu-bicara` tiap 15 detik.

---

## 5. Notulen otomatis (transkrip + draf AI)

`notulen` (summary) = `NotulenSummary::summary` web: `{available, auto_minutes, can_configure, can_manage, can_view_transcript, notice, notice_points, consent:{opted_out, can_change}, optout_count, llm:{enabled, provider, outside_indonesia}, retention_days, links:{…path web…}, transcript:{id, status: recording|transcribing|summarizing|ready|failed, status_label, error, language, model, duration_seconds, segment_count, speakers:[{identity,user_id,name,seconds}], started_at, updated_at, purge_after}|null, draft:{status: pending|ready|failed|disabled|inserted|discarded, status_label, error, model, generated_at, inserted_at, discarded_at, ringkasan, agenda, keputusan, tindak_lanjut, perlu_dicek}|null}`. Pengamat rapat pimpinan yang tidak diundang hanya melihat status (tanpa pembicara/draf).

| Metode & path | Hak (`MeetingTranscriptPolicy`) | Body | Respons |
|---|---|---|---|
| `GET /rapat/{id}/notulen-otomatis?tanggal=` | siapa pun yang melihat rapat | — | `{notulen}` |
| `PATCH /rapat/{id}/notulen-otomatis` | penyelenggara, rapat video, belum dibatalkan (403 pesan web) | `{enabled:true|false}` | `{notulen}`; menyalakan tanpa server transkripsi → 422 `auto_minutes` |
| `PUT /rapat/{id}/transkrip/persetujuan` | peserta undangan, rapat belum dibatalkan | `{opted_out:true|false}` | `{opted_out}` — "Jangan transkrip suara saya" (seluruh seri) |
| `GET /rapat/{id}/transkrip?tanggal=` | lihat rapat; segmen hanya untuk peserta undangan | — | `{notulen, transkrip: {transcript_id, status, language, duration_seconds, speakers, segments:[{i, speaker_identity, user_id, speaker_name, start_ms, end_ms, text}]}|null}` — `transkrip` null bila belum ada transkrip atau viewer bukan peserta; setiap pembacaan diaudit `meeting.transcript_viewed` (maks. sekali/10 menit per orang) |
| `POST /rapat/{id}/transkrip/masukkan?tanggal=` | notulis/penyelenggara | — | `{message:"Draf dimasukkan ke notulen.", occurrence_date, inserted_at, action_item_ids:[…]}`; sekali saja (lagi → 409) |
| `POST /rapat/{id}/transkrip/buang?tanggal=` | notulis/penyelenggara | — | `{notulen}`; sudah dimasukkan / belum ada transkrip → 409 |
| `POST /rapat/{id}/transkrip/ringkas-ulang?tanggal=` | notulis/penyelenggara (10/menit) | — | `{notulen}` |
| `POST /rapat/{id}/transkrip/tindak-lanjut/{tl-n}/tugas?tanggal=` | notulis/penyelenggara | `{workspace_id?}` | `{suggestion:{…}, task:{id,key}|null}` |

409 `{message}` contoh: "Belum ada transkrip untuk rapat ini.". Persetujuan wajib terlihat sebelum masuk ruang: tampilkan `notulen.notice` / `notice_points` di pra-gabung bila `auto_minutes`.

---

## 6. Jadwal manajemen

### `GET /manajemen/jadwal[?minggu=YYYY-MM-DD]`
Rapat pimpinan (baca saja) = `ManagementSchedule` web: minggu berjalan + 4 minggu sebelumnya seperti web; `minggu` = tanggal mana pun di minggu yang diinginkan (opsional, tambahan API). Gate `viewManagementDashboard` (Direksi, HR, Super Admin) — lainnya **403**.
```json
{"week_start":"2026-10-05",
 "meetings":[{ "id","key","occurrence_date","href","minutes_href","title","description","starts_at","ends_at",
   "platform","location","join_url","organizer_id","minute_taker_id","workspace","participants":[{user_id,email,rsvp,optional}],
   "agenda","recurrence","recurrence_until","reminders","leadership","auto_minutes","canceled","minutes_status" }],
 "minutes":[notulen],
 "people":[person],
 "viewer_id":"01J…"}
```

---

## Tidak dibangun (dan alasannya)

- **Buka kembali rapat yang dibatalkan** dan **batalkan satu kemunculan seri** — web tidak punya (spec §7 butir 9).
- **Pulihkan versi notulen** — web tidak punya; hanya baca riwayat.
- **Ingatkan PIC per butir** — web hanya punya "Ingatkan" per kemunculan (`RemindActionItemOwners`); diekspos apa adanya di `…/tindak-lanjut/ingatkan`.
- **Notulen kolaboratif Yjs** (`…/notulen/kolaborasi`) — ponsel memakai autosave REST (spec §7 butir 3); token kolaborasi tetap web.
- **Obrolan & subtitle ruang** — lewat LiveKit langsung (lihat §4), tanpa endpoint.
- **Realtime Reverb** untuk ponsel — polling (lihat Aturan umum).

## Verifikasi

- `tests/Feature/Api/MeetingB4bWriteApiTest.php` (13 test) dan `tests/Feature/Api/MeetingB4bVideoApiTest.php` (12 test): hijau. Regresi `tests/Feature/Api/MeetingApiTest.php` + `tests/Feature/Meetings/` hijau (251 test total). LiveKit Room Service dipalsukan `Http::fake`; worker/LLM tidak dipanggil (`Bus::fake`).
- `vendor/bin/pint` dan `vendor/bin/phpstan analyse` (berkas `app/` + rute) bersih.
