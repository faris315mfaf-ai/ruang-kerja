# Kontrak data — Notulen otomatis (Video RuangKerja, tahap 1)

> Pemilik: agen **notulen** (branch `claude/notulen-otomatis`). Dokumen ini adalah kontrak antara backend notulen otomatis dan UI rapat arah C "Notulen Hidup" (agen **rapatui**) serta backend rapat (agen **rapatbe**). Perubahan bentuk data **hanya** lewat dokumen ini (tambah kolom = boleh; ganti nama/hapus = umumkan dulu). Semua teks UI Bahasa Indonesia, semua waktu ISO-8601 UTC (`Z`), tanggal kemunculan = tanggal kantor `YYYY-MM-DD`.

Ringkas alurnya:

```
Penyelenggara menyalakan "Notulen otomatis" (auto_minutes)                       PUT …/pengaturan
Peserta boleh memilih "Jangan transkrip suara saya" (per orang per rapat/seri)   PUT …/persetujuan
Orang pertama masuk ruang → webhook LiveKit → aplikasi minta worker bergabung     (server ↔ server)
Rapat selesai → worker mentranskrip per pembicara → POST /api/notulen/transcript  status: recording → transcribing → summarizing → ready | failed
Ringkasan AI (DeepSeek/OpenAI-compatible) → draf                                  GET …/status, GET …/transkrip
Notulis: "Masukkan ke notulen" · "Buang draf" · "Jadikan tugas" per usulan        POST …/masukkan, DELETE …/draf, POST …/tindak-lanjut/{id}/tugas
```

## 1. Rute (semua di belakang `FEATURE_MEETINGS`, `auth`, `verified`)

Berkas `routes/notulen.php`, nama rute berawalan `meetings.notulen.`. Semua menerima `?tanggal=YYYY-MM-DD` (kemunculan; tanpa itu = kemunculan yang sama dengan detail rapat). Rapat yang tidak terlihat → **404**; terlihat tetapi tidak berhak → **403** `{message}`; server notulen belum diatur → **503** untuk aksi yang butuh worker. Wayfinder: `@/routes/meetings/notulen` dan `@/actions/App/Http/Controllers/Notulen/*`.

| Metode | URL | Nama | Siapa | Isi | Jawaban |
|---|---|---|---|---|---|
| GET | `/rapat/{meeting}/notulen-otomatis` | `meetings.notulen.page` | `view` transkrip (lihat §4) | — | Inertia `meetings/notulen-otomatis`, props §2.3 |
| GET | `/rapat/{meeting}/notulen-otomatis/status` | `meetings.notulen.status` | siapa pun yang melihat rapat | — | `NotulenSummary` (§2.1) |
| GET | `/rapat/{meeting}/notulen-otomatis/transkrip` | `meetings.notulen.transcript` | peserta + penyelenggara + notulis | — | `TranscriptSegments` (§2.2); **diaudit** `meeting.transcript_viewed` |
| PUT | `/rapat/{meeting}/notulen-otomatis/pengaturan` | `meetings.notulen.settings` | penyelenggara | `{"auto_minutes": true}` | `NotulenSummary` |
| PUT | `/rapat/{meeting}/notulen-otomatis/persetujuan` | `meetings.notulen.consent` | peserta internal (termasuk penyelenggara/notulis) | `{"opted_out": true}` | `{"opted_out": true}` |
| POST | `/rapat/{meeting}/notulen-otomatis/masukkan` | `meetings.notulen.insert` | notulis / penyelenggara | — | `{"minutes_href": "/rapat/…/notulen?tanggal=…", "inserted_at": "…", "action_item_ids": ["…"]}`; 409 bila sudah dimasukkan/dibuang atau notulen final |
| DELETE | `/rapat/{meeting}/notulen-otomatis/draf` | `meetings.notulen.discard` | notulis / penyelenggara | — | `NotulenSummary` (draf `discarded`); transkrip tetap |
| POST | `/rapat/{meeting}/notulen-otomatis/ringkas-ulang` | `meetings.notulen.resummarize` | notulis / penyelenggara | — | `NotulenSummary` (draf `pending`); 409 bila belum ada transkrip `ready` atau draf sudah dimasukkan |
| POST | `/rapat/{meeting}/notulen-otomatis/tindak-lanjut/{suggestion}/tugas` | `meetings.notulen.task` | notulis / penyelenggara (+ `editTasks` workspace) | `{"workspace_id": "01…"}` (hanya bila rapat tanpa workspace) | `{"suggestion": TindakLanjut, "task": {"id","key","href"}}`; 422 `workspace_id` bila perlu dipilih |

Semua mutasi memakai CSRF (Inertia/axios bawaan), batas laju `throttle:api`.

Endpoint server-ke-server (bukan untuk UI): `POST /api/notulen/transcript` (worker → aplikasi, HMAC) dan `POST /api/notulen/livekit` (webhook LiveKit kedua, JWT LiveKit) — §5.

## 2. Bentuk data

### 2.1 `NotulenSummary` — status + pengaturan + persetujuan + draf (tanpa isi transkrip)

Dipakai: `GET …/status`, jawaban `PUT …/pengaturan`, `DELETE …/draf`, `POST …/ringkas-ulang`, dan **prop Inertia `notulen`** (§3). Untuk polling status selama `transcript.status` ∈ `recording|transcribing|summarizing` cukup panggil `GET …/status` tiap 15–30 detik.

```json
{
  "available": true,
  "auto_minutes": true,
  "can_configure": true,
  "can_manage": true,
  "can_view_transcript": true,
  "notice": "Notulen otomatis aktif — suara Anda ditranskrip setelah rapat. Audio dihapus segera setelah transkripsi. Transkrip disimpan 90 hari dan hanya bisa dibuka peserta rapat. Ringkasan diproses oleh DeepSeek di luar Indonesia. Anda bisa memilih \"Jangan transkrip suara saya\".",
  "notice_points": [
    "Audio dihapus segera setelah transkripsi.",
    "Transkrip disimpan 90 hari dan hanya bisa dibuka peserta rapat.",
    "Ringkasan diproses oleh DeepSeek di luar Indonesia.",
    "Anda bisa memilih \"Jangan transkrip suara saya\"."
  ],
  "consent": {
    "opted_out": false,
    "can_change": true
  },
  "optout_count": 1,
  "llm": { "enabled": true, "provider": "DeepSeek", "outside_indonesia": true },
  "retention_days": 90,
  "links": {
    "page": "/rapat/01JA…/notulen-otomatis?tanggal=2026-10-07",
    "status": "/rapat/01JA…/notulen-otomatis/status?tanggal=2026-10-07",
    "transcript": "/rapat/01JA…/notulen-otomatis/transkrip?tanggal=2026-10-07",
    "settings": "/rapat/01JA…/notulen-otomatis/pengaturan",
    "consent": "/rapat/01JA…/notulen-otomatis/persetujuan",
    "insert": "/rapat/01JA…/notulen-otomatis/masukkan?tanggal=2026-10-07",
    "discard": "/rapat/01JA…/notulen-otomatis/draf?tanggal=2026-10-07",
    "resummarize": "/rapat/01JA…/notulen-otomatis/ringkas-ulang?tanggal=2026-10-07",
    "task": "/rapat/01JA…/notulen-otomatis/tindak-lanjut/{id}/tugas?tanggal=2026-10-07",
    "minutes": "/rapat/01JA…/notulen?tanggal=2026-10-07"
  },
  "transcript": {
    "id": "01JB…",
    "status": "ready",
    "status_label": "Siap",
    "error": null,
    "language": "id",
    "model": "faster-whisper/large-v3-turbo",
    "duration_seconds": 2710,
    "segment_count": 184,
    "speakers": [
      { "identity": "01HZA…", "user_id": "01HZA…", "name": "Rina Wulandari", "seconds": 812 },
      { "identity": "01HZB…", "user_id": "01HZB…", "name": "Budi Santoso", "seconds": 640 }
    ],
    "started_at": "2026-10-07T02:00:12.000Z",
    "updated_at": "2026-10-07T03:02:40.000Z",
    "purge_after": "2027-01-05T03:02:40.000Z"
  },
  "draft": {
    "status": "ready",
    "status_label": "Draf siap diperiksa",
    "error": null,
    "model": "deepseek-chat",
    "generated_at": "2026-10-07T03:02:40.000Z",
    "inserted_at": null,
    "discarded_at": null,
    "ringkasan": "Rapat membahas keterlambatan pengiriman dari gudang Cikarang, jadwal kampanye Q4, dan pelatihan tim penjualan. Kampanye diundur ke 20 Oktober …",
    "agenda": [
      {
        "judul": "Status pengiriman gudang Cikarang",
        "poin": [
          { "teks": "Pengiriman terlambat tiga hari karena truk ekspedisi rusak.", "sumber": [{ "i": 3, "start_ms": 41200 }] }
        ]
      }
    ],
    "keputusan": [
      { "teks": "Kampanye dimulai 20 Oktober, bukan 15 Oktober.", "agenda": "Materi promosi", "sumber": [{ "i": 21, "start_ms": 402300 }] }
    ],
    "tindak_lanjut": [
      {
        "id": "tl-1",
        "judul": "Hubungi vendor logistik dan kirim jadwal pengiriman baru",
        "agenda": "Status pengiriman gudang Cikarang",
        "penanggung_jawab": { "user_id": "01HZB…", "nama": "Budi Santoso" },
        "penanggung_jawab_teks": "Budi",
        "tenggat": "2026-10-09",
        "sumber": [{ "i": 5, "start_ms": 60100 }],
        "action_item_id": null,
        "task": null
      }
    ],
    "perlu_dicek": [
      "Apakah tim cabang Surabaya ikut pelatihan secara daring atau datang langsung."
    ]
  }
}
```

Aturan:

- `available` = server notulen diatur (`TRANSCRIBER_URL` + `TRANSCRIBER_SECRET`) **dan** rapat `platform = video` **dan** LiveKit diatur. `false` → sembunyikan semua kontrol notulen otomatis (atau tampilkan "belum disiapkan admin" untuk penyelenggara).
- `notice` (satu paragraf) dan `notice_points` (kalimat yang sama sebagai daftar) hanya terisi bila `auto_minutes` aktif; **wajib tampil** di pra-gabung dan di ruang (UU PDP). Isinya: audio dihapus segera setelah transkripsi; transkrip disimpan N hari (`retention_days`, dari `MINUTES_TRANSCRIPT_RETENTION_DAYS`) dan hanya untuk peserta; bila ringkasan AI aktif dan `llm.outside_indonesia`: "Ringkasan diproses oleh <provider> di luar Indonesia." Kosong: `null` / `[]`.
- `consent.opted_out` = pilihan **orang yang sedang melihat** untuk rapat/seri ini; `consent.can_change` = dia peserta internal rapat. Pilihan ini **privat**: hanya server yang meneruskannya ke worker (daftar `exclude` bertanda tangan), **tidak pernah** lewat atribut/metadata peserta LiveKit (yang diterima semua klien di ruang). Klien tidak perlu dan tidak boleh mengirimnya ke LiveKit.
- `optout_count` = jumlah orang yang memilih tidak ditranskrip untuk rapat ini (hanya angka, tanpa nama) — untuk kepala layar "Notulen otomatis".
- `transcript` = `null` sampai worker mulai merekam kemunculan ini. `status`: `recording` ("Merekam"), `transcribing` ("Mentranskrip"), `summarizing` ("Meringkas"), `ready` ("Siap"), `failed` ("Gagal", `error` terisi dalam Bahasa Indonesia).
- Nama pembicara (`speaker_name`, `speakers[].name`) selalu dari `users.name` di aplikasi (nama peserta LiveKit bisa diubah sendiri, tidak dipercaya); identitas yang bukan karyawan perusahaan = `"Peserta tamu"`. **Tamu eksternal rapat (identitas LiveKit `guest:{id}`, `docs/sesi/rapat-tamu-eksternal.md`) tidak pernah ditranskrip**: worker tidak berlangganan trek mereka (seperti menolak otomatis, tanpa daftar `exclude`) dan `RecordTranscriptUpdate` membuang segmen berawalan `guest:`; tamu tidak muncul di `speakers` dan tidak menerima kartu persetujuan.
- Semua teks draf AI = **teks polos** (tag dibuang di server); render sebagai teks, jangan sebagai HTML/Markdown. Usulan tindak lanjut tidak pernah menjadi tugas tanpa klik "Jadikan tugas".
- `links.task`: ganti `{id}` dengan id usulan (`tl-1`). `transcript.speakers[].user_id` = null bila identitas tidak dikenal (bukan karyawan perusahaan). `seconds` = total lama bicara (dasar "Waktu bicara").
- `draft` = `null` bila belum ada transkrip `ready`. `draft.status`: `pending` (sedang diringkas), `ready`, `failed` (`error`), `disabled` (tanpa `MINUTES_LLM_API_KEY` — transkrip tetap ada, draf tidak dibuat), `inserted` (sudah dimasukkan, `inserted_at`), `discarded` ("Buang draf", `discarded_at`). Isi (`ringkasan`, `agenda`, …) hanya ada pada `ready`/`inserted`; pada status lain berupa string kosong/array kosong.
- `sumber[].i` = indeks baris di `TranscriptSegments.segments[].i`; `start_ms` sama dengan baris itu (tautan "lompat ke transkrip" / sorot baris sumber).
- `tindak_lanjut[].penanggung_jawab` hanya diisi bila cocok dengan **peserta rapat** (tidak pernah orang di luar daftar); bila AI menyebut nama yang tidak cocok → `null`, nama aslinya di `penanggung_jawab_teks`, dan muncul satu baris di `perlu_dicek`. `tenggat` = `YYYY-MM-DD` atau `null`. `action_item_id` terisi setelah usulan masuk ke tabel tindak lanjut notulen; `task` = `{id, key: "OPS-157", href: "/tugas/01…"}` setelah "Jadikan tugas".
- **Pengamat rapat pimpinan yang tidak diundang** (`can_view_transcript = false`) hanya mendapat status: `transcript` = `{id, status, status_label, updated_at}` dengan `speakers: []`, `segment_count: 0`, `duration_seconds`/`started_at`/`model`/`error` = null; `optout_count: 0`; `draft: null` (audit T-09).
- "Ringkas ulang" dicatat di `audit_logs` (`meeting.transcript_resummarized`, penyedia + di luar Indonesia) karena transkrip dikirim lagi ke penyedia AI (audit T-08).
- `can_manage` = notulis/penyelenggara (Masukkan, Buang, Ringkas ulang, Jadikan tugas). `can_view_transcript` = peserta internal/penyelenggara/notulis (pengamat rapat pimpinan yang tidak diundang **tidak** melihat transkrip).

### 2.2 `TranscriptSegments` — `GET …/transkrip`

Header `Cache-Control: no-store`. Setiap pemanggilan dicatat ke `audit_logs` (`meeting.transcript_viewed`, paling sering sekali per orang per transkrip per 10 menit).

```json
{
  "transcript_id": "01JB…",
  "status": "ready",
  "language": "id",
  "duration_seconds": 2710,
  "speakers": [
    { "identity": "01HZA…", "user_id": "01HZA…", "name": "Rina Wulandari", "seconds": 812 }
  ],
  "segments": [
    { "i": 0, "speaker_identity": "01HZA…", "user_id": "01HZA…", "speaker_name": "Rina Wulandari", "start_ms": 1200, "end_ms": 5400, "text": "Selamat pagi semuanya. Kita mulai rapat koordinasi peluncuran Q4." },
    { "i": 1, "speaker_identity": "01HZB…", "user_id": "01HZB…", "speaker_name": "Budi Santoso", "start_ms": 6100, "end_ms": 9800, "text": "Pagi. Saya mulai dari status gudang Cikarang." }
  ]
}
```

`start_ms`/`end_ms` = milidetik sejak `transcript.started_at` (tampilkan `mm:ss` atau `j:mm:ss`). Status selain `ready`/`summarizing` → `segments: []`. Pencarian dilakukan di klien.

### 2.3 Halaman `meetings/notulen-otomatis` (layar "Notulen otomatis" sesudah rapat)

Props Inertia:

```json
{
  "meeting": {
    "id": "01JA…",
    "title": "Koordinasi peluncuran Q4",
    "occurrence_date": "2026-10-07",
    "starts_at": "2026-10-07T02:00:00Z",
    "ends_at": "2026-10-07T03:00:00Z",
    "href": "/rapat/01JA…?tanggal=2026-10-07",
    "minutes_href": "/rapat/01JA…/notulen?tanggal=2026-10-07",
    "agenda": ["Status pengiriman gudang Cikarang", "Materi promosi", "Pelatihan tim penjualan"],
    "workspace": { "id": "01…", "key": "OPS", "name": "Operasional" }
  },
  "people": [ { "id": "01HZA…", "name": "Rina Wulandari", "title": "Staf Pemasaran", "division": "Pemasaran", "avatar_url": null } ],
  "notulen": { "…": "NotulenSummary §2.1" },
  "workspaces": [ { "id": "01…", "key": "OPS", "name": "Operasional" } ]
}
```

Segmen **tidak** ikut props (diaudit, diambil lewat `GET …/transkrip` saat halaman terbuka). `workspaces` = pilihan untuk "Jadikan tugas" bila `meeting.workspace` null (sama dengan `EditableWorkspaces`). Versi awal halaman ini dibuat minimal oleh agen notulen; tampilan arah C dibangun agen rapatui di berkas yang sama (`resources/js/pages/meetings/notulen-otomatis.tsx`) dan komponen di `resources/js/features/meetings/notulen/**`.

## 3. Pra-gabung & ruang (UI rapatui, backend rapatbe)

- **Prop Inertia `notulen`** pada `meetings/join` dan `meetings/room` (lewat `NotulenBridge` milik rapatbe, sudah tergabung): `NotulenSummary::for($occurrence, $user)` → `NotulenSummary` §2.1, atau **`null`** bila rapat bukan video, atau server notulen belum diatur **dan** `auto_minutes` mati (tanpa query DB). `room.features.auto_minutes` = `available && auto_minutes`. Detail rapat dan halaman `notulen-otomatis` memakai `GET …/status` / prop halaman (selalu objek penuh, `NotulenSummary::summary()`).
- **Kartu persetujuan pra-gabung** ("Notulen otomatis aktif", toggle "Jangan transkrip suara saya"): tampil bila `available && auto_minutes`. Toggle → `PUT …/persetujuan {opted_out}` **sebelum** meminta token; aplikasi meneruskannya ke worker (worker langsung berhenti merekam orang itu dan menghapus audionya bila sudah terlanjur).
- **Di ruang**: chip "Notulen otomatis aktif" (+ "· Subtitle ID" di tahap 2) dan toggle yang sama (menu/panel) → `PUT …/persetujuan`. Tidak ada langkah LiveKit di klien; server langsung memberi tahu worker (worker berhenti merekam orang itu dan menghapus audionya).
- **Token peserta (rapatbe, `IssueVideoToken`)**: **jangan** menaruh pilihan opt-out di atribut/metadata token (privat). `metadata.auto_minutes` boleh (sama untuk semua orang).
- **Peserta tersembunyi**: worker bergabung dengan identitas **`rk-notulen`** (persis string ini, `config('notulen.transcriber.identity')`), `hidden`, `kind=agent`, subscribe saja; ia tidak muncul di daftar peserta LiveKit klien. Webhook kehadiran (`RecordVideoEvent`, rapatbe) **mengabaikan** identitas `rk-notulen` (tidak membuat baris `meeting_attendances`).
- **Subtitle (tahap 2, belum dibangun)**: teks langsung akan datang lewat LiveKit text stream topik `lk.transcription` dengan atribut `lk.transcribed_track_id`, `lk.segment_id`, `lk.transcription_final` (konvensi LiveKit Agents). **Wajib (audit N-07):** UI hanya menerima stream itu bila `participantInfo.identity === 'rk-notulen'`; stream bertopik sama dari peserta lain diabaikan (siapa pun dengan `canPublishData` bisa memalsukannya). Kotak subtitle tampil hanya bila stream sah itu datang; teks dirender sebagai teks polos.

## 3a. Data yang dikirim ke penyedia ringkasan AI (minimalisasi)

Hanya: judul rapat, tanggal, judul agenda, baris transkrip bernomor `[i] mm:ss Nama: teks`, dan **nama tampilan** peserta yang **berbicara** di transkrip dan **tidak** memilih opt-out (segmen orang yang opt-out sudah dibuang sebelumnya). Tidak pernah: email, id/ULID, jabatan, daftar undangan lain. Penanggung jawab hanya bisa dicocokkan ke orang dalam daftar itu.

## 4. Otorisasi (`App\Policies\MeetingTranscriptPolicy`)

| Kemampuan | Penyelenggara | Notulis | Peserta internal | Pengamat rapat pimpinan (tidak diundang) | Lainnya |
|---|---|---|---|---|---|
| `status` (NotulenSummary) | ✓ | ✓ | ✓ | ✓ (tanpa isi draf: `draft` = null) | 404 |
| `view` (transkrip + halaman) | ✓ | ✓ | ✓ | 403 | 404 |
| `configure` (auto_minutes) | ✓ | 403 | 403 | 403 | 404 |
| `consent` (opt-out sendiri) | ✓ | ✓ | ✓ | 403 | 404 |
| `manage` (masukkan, buang, ringkas ulang, jadikan tugas) | ✓ | ✓ | 403 | 403 | 404 |

Rapat dibatalkan: `configure`/`consent` 403.

**Notulen live**: "Masukkan ke notulen" menyimpan lewat `SaveMinutes` (rapatbe), yang memanggil `MinutesCollab::replaceLive()` (editor kolaboratif yang sedang terbuka menerima isi baru) dan `RoomEvents::minutesChanged()` (event `minutes.updated` di kanal `meeting.{id}`); tiap tindak lanjut yang ditambahkan juga memicu `minutes.updated`. **Atribut `rk_notulen_optout`** di whitelist `SetOwnAttributes` (rapatbe) **tidak dipakai** dan sebaiknya dihapus: pilihan opt-out privat (server → worker). "Jadikan tugas" juga butuh `WorkspacePolicy::editTasks` di workspace tujuan.

## 5. Server ke server (untuk referensi; UI tidak memanggil)

**Tanda tangan HMAC** (dua arah, **rahasia berbeda per arah**): `X-Notulen-Timestamp: <unix detik>`, `X-Notulen-Signature: v1=<hex HMAC-SHA256(rahasia, "<timestamp>.<badan mentah>")>` — aplikasi → worker memakai `TRANSCRIBER_SECRET`, worker → aplikasi memakai `TRANSCRIBER_CALLBACK_SECRET`. Ditolak bila selisih jam > 300 detik atau tanda tangan sudah pernah dipakai (aplikasi: cache; worker: SQLite di spool, tetap setelah restart). Badan menyebut `room` dan `action` + `nonce` acak. Worker mendengar di `127.0.0.1` (Caddy menerbitkannya); `GET /health` hanya `{"status":"ok"}`.

- Aplikasi → worker (`TRANSCRIBER_URL`): `POST /rooms/{room}/join` `{"action":"join","room":"rk-…","token":"<JWT LiveKit rk-notulen, hidden, subscribe saja, 10 menit>","exclude":["<user id yang menolak>"],"nonce":"…"}` · `POST /rooms/{room}/exclude` `{"action":"exclude","room","identity","excluded":true,"nonce"}` · `POST /rooms/{room}/finish` `{"action":"finish","room","nonce"}` · `GET /health`.
- Status `recording`/`transcribing` yang datang setelah transkrip `ready`/`summarizing`/`failed` diabaikan (tidak menimpa keadaan akhir); `ready` tanpa `session` memakai kunci deterministik dari isi (`h-…`) sehingga kiriman ulang idempoten (audit T-10).
- Antrean: `SummarizeMeetingTranscript` (≤ 900 dtk) berjalan di antrean **`long`** pada koneksi **`redis-long`** (`retry_after` 960 dtk) dengan supervisor Horizon `supervisor-long` (timeout 900); job lain di `default` (audit T-05).
- Worker → aplikasi: `POST /api/notulen/transcript` `{"room","session","status":"recording|transcribing|ready|failed","started_at","ended_at","language","model","duration_ms","segments":[{"speaker_identity","speaker_name","start_ms","end_ms","text"}],"error"}` → `200 {"status":"recorded"|"ignored"}`, `401` tanda tangan, `404` tidak diatur, `413`, `422`.
- LiveKit → aplikasi (URL webhook **kedua** di `livekit.yaml`): `POST /api/notulen/livekit` (JWT LiveKit seperti `/api/livekit/webhook`): `participant_joined` (bukan `rk-notulen`) pada rapat ber-`auto_minutes` → job `StartMeetingRecorder`; `room_finished` → job `FinishMeetingRecorder`.

## 6. Pengaturan rapat `auto_minutes`

Kolom `meetings.auto_minutes` (bool, bawaan `false`). Diubah lewat `PUT …/pengaturan` (penyelenggara, hanya rapat `video`, `available` harus true untuk menyalakan; mematikan selalu boleh). Untuk formulir jadwal (rapatbe/rapatui): `SaveMeetingRequest` boleh menerima `auto_minutes` (boolean, hanya berlaku untuk `platform = video`) dan `ScheduleMeeting::attributes` menyimpannya; nilai sekarang untuk formulir ubah = `$meeting->auto_minutes`. Sebelum itu ada, UI formulir dapat memanggil `PUT …/pengaturan` setelah rapat tersimpan. Teks penjelas toggle: "Notulen otomatis — suara peserta ditranskrip setelah rapat, lalu AI menyusun draf notulen untuk diperiksa notulis. Peserta bisa menolak. Transkrip dihapus otomatis setelah 90 hari."
