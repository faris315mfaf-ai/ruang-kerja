# Kontrak data — Ruang rapat "Notulen Hidup" (Video RuangKerja, arah C)

> Pemilik: agen **rapatbe** (branch `claude/rapat-backend`). Kontrak antara backend rapat dan UI ruang rapat arah C (agen **rapatui**: `features/meetings/video/**`, `pages/meetings/{join,room}.tsx`). Notulen otomatis/transkrip/AI punya kontrak sendiri: [notulen-otomatis-kontrak.md](notulen-otomatis-kontrak.md) (agen notulen). Perubahan bentuk data **hanya** lewat dokumen ini: menambah kunci boleh; mengganti nama/menghapus diumumkan dulu. Tipe TypeScript yang cocok: `resources/js/types/meetings-room.ts` (`import type { … } from '@/types/meetings-room'`).
>
> Konvensi: waktu ISO-8601 UTC (`…Z`), tanggal kemunculan = tanggal kantor `YYYY-MM-DD`, id = ULID. Semua rute di belakang `FEATURE_MEETINGS` + `auth` + `verified`; rapat yang tidak terlihat → **404**; terlihat tetapi tidak berhak → **403** `{message}`; Video RuangKerja belum diatur (`LIVEKIT_*`) → **503** `{message}` untuk aksi yang butuh LiveKit. Semua endpoint menerima `?tanggal=YYYY-MM-DD` (atau `tanggal` di badan) untuk satu kemunculan rapat berulang; tanpa itu = kemunculan yang sama dengan halaman (hari ini/berikutnya). Galat validasi = 422 standar Laravel `{message, errors}`.

## 0. Ringkas

| Kebutuhan layar | Sumber |
|---|---|
| Rapat, kemunculan, peserta (nada avatar, peran penyelenggara/notulis) | prop `room.meeting`, `room.participants` |
| Navigator bagian (agenda) | prop `room.agenda` |
| Dokumen notulen di tengah | prop `room.minutes`: **kolaboratif** (Yjs, editor Catatan bersama, `GET …/notulen/kolaborasi`) bila `FEATURE_NOTES` + server kolaborasi, selain itu satu penyunting (`PUT …/notulen`, petunjuk `POST …/notulen/menyunting`); `GET …/notulen/data`, event `minutes.updated` |
| Pra-gabung: pilih sumber notulen (Lanjutkan · Templat · Kosong) + tindak lanjut terbuka rapat lalu | prop `room.notes_source` + `POST …/video/sumber-notulen` |
| Waktu bicara (bar, %, "X belum bicara") | prop `room.speaking` + `POST/GET …/video/bicara` + event `speaking.updated` |
| Kehadiran (jam masuk, terlambat, di ruang, belum masuk) + **Panggil** | prop `room.video.attendance`, `room.video.not_joined` + `GET …/video/kehadiran` + `POST …/video/panggil/{user}` + event `attendance.updated`, `participant.called` |
| Angkat tangan | `POST …/video/tangan` (atribut `hand` diatur server; token tidak bisa mengubah nama/metadata/atribut sendiri) |
| Keluarkan / izinkan masuk lagi | `DELETE …/video/peserta/{user}` (lama) + `DELETE …/video/peserta/{user}/larangan`, `room.video.removed` |
| Bendera fitur (subtitle, notulen otomatis, notulen kolaboratif), izin pengguna | prop `room.features`, `room.can` |
| Notulen otomatis (persetujuan, status) | prop `notulen` (kontrak agen notulen §2.1), `null` sampai backend notulen ada |

## 1. Halaman Inertia

`GET /rapat/{meeting}/gabung` → komponen `meetings/join` · `GET /rapat/{meeting}/ruang` → komponen `meetings/room`. Akses: `MeetingPolicy::openVideo` (penyelenggara, notulis, peserta internal yang diundang; rapat bukan video/tidak terlihat 404; dibatalkan atau pengamat rapat pimpinan yang tidak diundang 403). Keduanya memberi **props yang sama**:

```json
{
  "room": { "…": "RoomProps, §1.1" },
  "notulen": null
}
```

`notulen` = `NotulenSummary` milik agen notulen (`App\Domain\Meetings\Transcripts\Queries\NotulenSummary::for($occurrence, $user)`) bila kelas itu sudah ada di branch, selain itu `null` (UI boleh memanggil `GET /rapat/{id}/notulen-otomatis/status`).

### 1.1 `RoomProps` (`room`)

```json
{
  "viewer": { "id": "01HZSARI0000000000000000AA", "name": "Sari Wulandari", "avatar_url": null },
  "meeting": {
    "id": "01JAOPS00000000000000000AA",
    "title": "Rapat mingguan Operasional",
    "occurrence_date": "2026-10-08",
    "starts_at": "2026-10-08T02:00:00Z",
    "ends_at": "2026-10-08T03:00:00Z",
    "href": "/rapat/01JAOPS00000000000000000AA?tanggal=2026-10-08",
    "minutes_href": "/rapat/01JAOPS00000000000000000AA/notulen?tanggal=2026-10-08",
    "organizer_id": "01HZDIMAS000000000000000AA",
    "minute_taker_id": "01HZSARI0000000000000000AA",
    "agenda": ["Rekap stok gudang September", "Jadwal perawatan kendaraan Q4", "Lain-lain"],
    "is_recurring": true,
    "workspace": { "id": "01HWOPS0000000000000000AAA", "key": "OPS", "name": "Operasional" }
  },
  "people": [
    { "id": "01HZDIMAS000000000000000AA", "name": "Dimas Pratama", "title": "Kepala Divisi Operasional", "division": "Operasional", "avatar_url": null }
  ],
  "participants": [ "RoomParticipant, §1.2" ],
  "agenda": [ "AgendaSection, §1.3" ],
  "minutes": { "…": "RoomMinutes, §1.4" },
  "notes_source": { "…": "NotesSource, §2.1" },
  "speaking": { "…": "SpeakingTotals, §3.1" },
  "video": { "…": "VideoSummary, §4.1" },
  "features": {
    "video_configured": true,
    "realtime": true,
    "subtitles": false,
    "auto_minutes": false,
    "collab_minutes": true
  },
  "can": {
    "edit_minutes": true,
    "choose_notes_source": true,
    "moderate": false,
    "call_participants": true,
    "report_speaking": true
  },
  "channel": "meeting.01JAOPS00000000000000000AA",
  "links": {
    "token": "/rapat/01JAOPS00000000000000000AA/video/token?tanggal=2026-10-08",
    "notes_source": "/rapat/01JAOPS00000000000000000AA/video/sumber-notulen?tanggal=2026-10-08",
    "speaking": "/rapat/01JAOPS00000000000000000AA/video/bicara?tanggal=2026-10-08",
    "attendance": "/rapat/01JAOPS00000000000000000AA/video/kehadiran?tanggal=2026-10-08",
    "call": "/rapat/01JAOPS00000000000000000AA/video/panggil/{user}?tanggal=2026-10-08",
    "readmit": "/rapat/01JAOPS00000000000000000AA/video/peserta/{user}/larangan?tanggal=2026-10-08",
    "hand": "/rapat/01JAOPS00000000000000000AA/video/tangan?tanggal=2026-10-08",
    "join": "/rapat/01JAOPS00000000000000000AA/gabung?tanggal=2026-10-08",
    "room": "/rapat/01JAOPS00000000000000000AA/ruang?tanggal=2026-10-08"
  }
}
```

- `viewer`, `meeting` (kunci lama tetap), `people` (= semua orang yang dirujuk, bentuk `Person` dari `features/meetings/types.ts`) dan `video` **tidak berubah** dari versi lama; kunci baru hanya ditambahkan.
- `features.video_configured` = `LIVEKIT_URL/KEY/SECRET` terisi. `features.realtime` = server punya broadcaster sungguhan (Reverb); `false` → UI memakai polling (§6). `features.subtitles` = `LIVEKIT_SUBTITLES=true` (`config/livekit.php`, bawaan `false`, ada di `.env.example` dan `.env.production.example`; tahap 2 GPU — meski `false`, UI tetap boleh menampilkan subtitle bila text stream `lk.transcription` dari `rk-notulen` datang). `features.auto_minutes` = `notulen.available && notulen.auto_minutes` (`false` selama `notulen` null). `features.collab_minutes` = `FEATURE_NOTES` aktif **dan** `COLLAB_SECRET` diatur → notulen kolaboratif (§1.4).
- `can.edit_minutes` **per mode** (§1.4): kolaboratif → semua yang diundang (penyelenggara, notulis, peserta internal) selama draf; satu penyunting → notulis/penyelenggara selama draf. Pengamat rapat pimpinan yang tidak diundang dan notulen final: baca saja. `can.choose_notes_source` = notulis/penyelenggara, draf, dan sumber belum dipilih. `can.moderate` = penyelenggara (bisukan, keluarkan). `can.call_participants` = notulis/penyelenggara (Panggil). `can.report_speaking` = di dalam jendela gabung (penyelenggara kapan saja).
- `links.call` dan `links.readmit` memuat placeholder `{user}`; ganti dengan id orangnya.

### 1.2 `RoomParticipant` (`room.participants[]`)

Semua karyawan yang diundang (penyelenggara dan notulis selalu ada; tamu email tidak), urutan: penyelenggara, notulis, lalu nama. `seat` = indeks stabil untuk warna kursor/kolaborator (`features/notes/cursor-tones.ts` `cursorTone(seat)`).

```json
{
  "id": "01HZDIMAS000000000000000AA",
  "name": "Dimas Pratama",
  "first_name": "Dimas",
  "initials": "DP",
  "title": "Kepala Divisi Operasional",
  "division": "Operasional",
  "avatar_url": null,
  "tone": "blue",
  "seat": 0,
  "roles": ["organizer"],
  "role_label": "Penyelenggara",
  "rsvp": "yes",
  "optional": false
}
```

- `tone` ∈ `blue` · `teal` · `amber` = hasil yang sama dengan `avatarTone(name)` (`components/ui/avatar.tsx`) → kelas `bg-avatar-{tone} text-avatar-{tone}-fg`.
- `roles` ⊆ `organizer`, `minute_taker` (bisa keduanya). `role_label`: "Penyelenggara", "Notulis", "Penyelenggara · Notulis", atau `null`.
- `rsvp` ∈ `pending|yes|maybe|no`.

### 1.3 `AgendaSection` (`room.agenda[]`) — navigator bagian kiri

Dari bagian notulen bila notulen sudah ada, selain itu dari agenda rapat (`meetings.agenda`, diisi di form jadwal). Selalu diakhiri dua blok tetap notulen: Keputusan dan Tindak lanjut.

```json
[
  { "key": "section-0", "index": 0, "title": "Rekap stok gudang September", "kind": "agenda", "has_notes": true },
  { "key": "section-1", "index": 1, "title": "Jadwal perawatan kendaraan Q4", "kind": "agenda", "has_notes": false },
  { "key": "section-2", "index": 2, "title": "Tindak lanjut rapat lalu", "kind": "extra", "has_notes": true },
  { "key": "decisions", "index": null, "title": "Keputusan", "kind": "decisions", "has_notes": true },
  { "key": "action-items", "index": null, "title": "Tindak lanjut", "kind": "action_items", "has_notes": false }
]
```

`kind`: `agenda` (judul = butir agenda rapat), `extra` (bagian tambahan, mis. dari "Lanjutkan notulen rapat lalu"), `decisions`, `action_items`. `index` = indeks di `minutes.doc.sections` (null untuk blok tetap). `key` dipakai sebagai id jangkar (`#section-0`). Sesudah notulen tersimpan, UI menurunkan ulang navigator dari `minutes.doc.sections` (judul yang sama).

### 1.4 `RoomMinutes` (`room.minutes`) — dokumen notulen di tengah

Notulen = notulen terstruktur yang sudah ada (`meeting_minutes`: kehadiran, catatan per bagian, keputusan, tindak lanjut). Teksnya (bagian + keputusan) disunting dalam salah satu dari dua **mode** (keputusan lead 7 Okt 2026):

| | `mode: "collab"` | `mode: "autosave"` |
|---|---|---|
| Kapan | `FEATURE_NOTES` aktif **dan** server kolaborasi diatur (`COLLAB_SECRET`) — `features.collab_minutes: true` | selain itu |
| Editor | editor Catatan bersama (Tiptap + Yjs, `features/notes`) tersambung ke server kolaborasi yang sama, dokumen `meeting-minutes.{minutes id}` | editor notulen terstruktur (simpan otomatis seperti `features/meetings/use-minutes.ts`) |
| Siapa menyunting teks (`can_edit`, `can.edit_minutes`) | semua yang diundang (penyelenggara, notulis, peserta internal), draf saja | notulis + penyelenggara, draf saja |
| Bentrok | digabung Yjs (kursor kolaborator: `participants[].seat` → `cursorTone(seat)`) | **tulisan terakhir menang**; petunjuk "X sedang menyunting" (`editing`) |
| Simpan | server kolaborasi → `POST /internal/rapat/notulen/{id}/state` (otomatis); teks disalin ke `sections`/`decisions` | `PUT links.save` badan `{attendance, sections, decisions}` |
| Kehadiran, finalkan, tindak lanjut | notulis/penyelenggara (`can_edit_attendance`, `can_finalize`) lewat endpoint lama; di mode collab kirim `PUT links.save` dengan `{"attendance_only": true, "attendance": [...]}` (bagian/keputusan diabaikan) | sama, `PUT links.save` penuh |

```json
{
  "mode": "collab",
  "collab": {
    "token_url": "/rapat/01JAOPS00000000000000000AA/notulen/kolaborasi?tanggal=2026-10-08",
    "url": "wss://kantor.example/collab"
  },
  "doc": {
    "id": "01JBMXN0000000000000000AAA",
    "meeting_id": "01JAOPS00000000000000000AA",
    "meeting_key": "01JAOPS00000000000000000AA:2026-10-08",
    "href": "/rapat/01JAOPS00000000000000000AA/notulen?tanggal=2026-10-08",
    "status": "draft",
    "saved_at": "2026-10-08T02:18:40Z",
    "version_count": 3,
    "finalized_at": null,
    "co_editor_id": null,
    "attendance": [{ "user_id": "01HZDXMAS000000000000000AA", "present": true, "reason": null }],
    "sections": [{ "title": "Rekap stok gudang September", "body": "Selisih stok 0,8% (target < 1%)." }],
    "decisions": ["Servis AC dipindah ke minggu ketiga Oktober."],
    "action_items": [{ "id": "01JBA000000000000000000AAA", "text": "Ajukan PO ban", "assignee_id": "01HZRZKY0000000000000000AA", "due_date": "2026-10-10", "task_key": "OPS-1284", "task_url": "/w/OPS/tasks/1284", "done": false }],
    "source": "continue"
  },
  "can_edit": true,
  "can_edit_attendance": true,
  "can_finalize": true,
  "editing": null,
  "links": {
    "page": "/rapat/01JAOPS00000000000000000AA/notulen?tanggal=2026-10-08",
    "data": "/rapat/01JAOPS00000000000000000AA/notulen/data?tanggal=2026-10-08",
    "save": "/rapat/01JAOPS00000000000000000AA/notulen?tanggal=2026-10-08",
    "finalize": "/rapat/01JAOPS00000000000000000AA/notulen/final?tanggal=2026-10-08",
    "items": "/rapat/01JAOPS00000000000000000AA/tindak-lanjut?tanggal=2026-10-08",
    "tasks": "/rapat/01JAOPS00000000000000000AA/notulen/tugas?tanggal=2026-10-08",
    "editing": "/rapat/01JAOPS00000000000000000AA/notulen/menyunting?tanggal=2026-10-08"
  }
}
```

- `doc` = bentuk `Minutes` yang sudah ada (`features/meetings/types.ts`) + `source` (`continue|template|blank|null`, §2). Notulen yang belum pernah disimpan: `id` null, isi = draf kosong (bagian = agenda).
- **Kehadiran di notulen ≠ persetujuan transkrip.** `doc.attendance` adalah daftar hadir rapat (siapa hadir/izin, isian awal dari siapa yang masuk ruang video menurut webhook) dan diatur notulis/penyelenggara. Pilihan "Jangan transkrip suara saya" (notulen otomatis, kontrak agen notulen §3) **tidak** mengubah kehadiran: orang yang menolak transkrip tetap tercatat hadir, dan orang yang tidak hadir tidak perlu menolak apa pun.
- **Mode collab — token** `GET collab.token_url` (`meetings.minutes.collab`, siapa pun yang melihat rapat; 503 bila kolaborasi mati; `Cache-Control: no-store`; membuat baris notulen bila belum ada):

  ```json
  { "document": "meeting-minutes.01JBMXN0000000000000000AAA", "token": "eyJub3Rl…", "url": "wss://kantor.example/collab", "can_edit": true, "expires_in": 120 }
  ```

  Pakai seperti `GET /catatan/{id}/token` (HocuspocusProvider `name = document`, `token`, minta token baru saat sambung ulang). `can_edit: false` → sambungan baca saja. Saat notulen difinalkan/dibuka kembali server memutus semua sambungan dokumen itu (klien sambung ulang dengan token baru → baca saja / bisa menyunting lagi).
- **Isi dokumen kolaboratif** (ProseMirror StarterKit): satu `heading` (level 2) per bagian diikuti paragraf/daftar catatannya, lalu heading **"Keputusan"** dengan satu butir daftar per keputusan. Saat disimpan: setiap heading memulai bagian baru, heading "Keputusan" mengumpulkan keputusan, teks sebelum heading pertama menjadi bagian "Catatan", daftar menjadi baris "• …". Tindak lanjut **bukan** bagian dokumen (tetap baris tabel: chip tugas di UI, `links.items`). Perubahan dari luar dokumen (simpan mode autosave dari halaman notulen, sumber notulen, "Masukkan ke notulen" notulen otomatis) **mengganti** isi dokumen yang sedang terbuka (tulisan terakhir menang).
- **Mode autosave — petunjuk menyunting** `POST links.editing` `{"active": true|false}` (`meetings.minutes.editing`, notulis/penyelenggara; 403 lainnya) → `{"editing": {"user_id", "name", "since", "expires_at"} | null}`. Kirim `active: true` tiap 15 detik selama editor fokus, `false` saat blur/keluar. Pemegang pertama bertahan sampai 30 detik setelah detak terakhir; tidak pernah memblokir simpan. Tampilkan "Sari sedang menyunting" bila `editing.user_id` ≠ diri sendiri. Event `minutes.editing` (§5).
- Endpoint lama (tidak berubah): `PUT links.save` → `{minutes}`; `POST links.finalize` → `{minutes}`; `POST links.items` `{text, assignee_id, due_date}` → 201 `{item}`; `PATCH/DELETE /rapat/{id}/tindak-lanjut/{item}`; `POST links.tasks` `{item_ids, workspace_id?}` → `{created, minutes}`. Bagian boleh judul bebas (maks. 40 bagian, judul ≤ 200, isi ≤ 20.000 karakter teks biasa). **Baru** `attendance_only` di `PUT links.save`.
- `GET links.data` → `{"minutes": Minutes}` (`meetings.minutes.data`, siapa pun yang melihat rapat; `no-store`) — ambil ulang setelah `minutes.updated`.

## 2. Sumber notulen di pra-gabung

### 2.1 `NotesSource` (`room.notes_source`)

```json
{
  "chosen": null,
  "chosen_by": null,
  "chosen_at": null,
  "can_choose": true,
  "suggested": "continue",
  "previous": {
    "occurrence_date": "2026-10-01",
    "href": "/rapat/01JAOPS00000000000000000AA/notulen?tanggal=2026-10-01",
    "status": "final",
    "open_count": 2
  },
  "open_follow_ups": [
    {
      "id": "01JBAI00000000000000000AAB",
      "text": "Kirim jadwal servis ke vendor",
      "assignee_id": "01HZRIZKY000000000000000AA",
      "due_date": "2026-10-03",
      "task_key": "OPS-1270",
      "task_url": "/tugas/01…",
      "done": false,
      "overdue": true
    }
  ],
  "template": {
    "key": "agenda",
    "label": "Templat Rapat mingguan",
    "sections": ["Rekap stok gudang September", "Jadwal perawatan kendaraan Q4", "Lain-lain"],
    "blocks": ["Keputusan", "Tindak lanjut"]
  }
}
```

- `previous` = notulen terakhir **rapat/seri yang sama** sebelum kemunculan ini (draf atau final), `null` bila tidak ada (rapat sekali, kemunculan pertama). `open_follow_ups` = tindak lanjutnya yang belum selesai (`done_at` kosong dan tugasnya belum berkategori selesai), maks. 20, urut tenggat; `overdue` = tenggat < tanggal kemunculan ini.
- `template.label` mengikuti jenis/judul rapat: seri mingguan "Templat Rapat mingguan", seri hari kerja "Templat Rapat harian", Sen–Rab–Jum "Templat Rapat Sen–Rab–Jum", rapat sekali "Templat {judul rapat}". `template.key` selalu `agenda`.
- `suggested` = `continue` bila ada tindak lanjut terbuka, selain itu `template`. `chosen` ≠ null → kartu pilihan diganti "Notulen memakai: …" dan tombol "Masuk dan buka notulen".
- `can_choose` false untuk peserta biasa: mereka hanya membuka apa yang ada (pilihan tidak tampil/nonaktif).

### 2.2 `POST /rapat/{meeting}/video/sumber-notulen` (`meetings.video.notes-source`)

Badan `{"source": "continue" | "template" | "blank"}` (UI: "Lanjutkan notulen rapat lalu" · `template.label` · "Dokumen kosong"). Siapa: notulis/penyelenggara (`MeetingPolicy::editMinutes`); peserta lain 403; notulen final 403. `throttle:api`.

Jawaban 200:

```json
{
  "applied": true,
  "notes_source": { "…": "NotesSource (chosen terisi, can_choose false)" },
  "minutes": { "…": "Minutes (doc §1.4)" }
}
```

Aturan (`App\Domain\Meetings\Actions\ChooseMinutesSource`, dalam transaksi + row lock):

- **Idempoten per kemunculan**: sumber yang sudah dipilih tidak pernah diterapkan lagi. Pilihan kedua (sama atau berbeda) → 200 `applied: false` dengan keadaan sekarang, tanpa menggandakan apa pun.
- `continue`: menambah bagian **"Tindak lanjut rapat lalu"** (kind `extra`) di akhir bagian, isinya satu baris per tindak lanjut terbuka: `• Kirim jadwal servis ke vendor — Rizky Aditya · tenggat 3 Okt · OPS-1270`. Tanpa tindak lanjut terbuka → tidak ada bagian baru (hanya pilihan yang dicatat). Bagian berjudul sama yang sudah ada tidak ditambah lagi.
- `template` (`template.label`): memastikan satu bagian per butir agenda (urutan agenda; bagian yang sudah ada dipertahankan isinya, bagian tambahan tetap di belakang); agenda kosong → satu bagian "Agenda". Keputusan dan Tindak lanjut adalah blok tetap notulen.
- `blank`: bila notulen belum berisi apa-apa (semua catatan kosong, tanpa keputusan, tanpa tindak lanjut) bagian dikosongkan (`sections: []`), selain itu isi tidak diubah. Kehadiran tidak pernah diubah.
- Isi yang berubah tercatat sebagai versi notulen (aturan `SaveMinutes`), dan event `minutes.source_chosen` + `minutes.updated` disiarkan (§5).

## 3. Waktu bicara

Tabel `meeting_speaking_times` (satu baris per kemunculan × orang, `ms_spoken`). **Setiap klien melaporkan waktu bicaranya sendiri** (akumulasi lokal dari `isSpeaking`/audio level peserta lokal LiveKit), tidak pernah orang lain.

**Sumber angka (keputusan lead):** selama rapat, panel "Waktu bicara" **hanya** memakai `meeting_speaking_times` (endpoint/event di bawah). Sesudah rapat, `transcript.speakers[].seconds` dari notulen otomatis hanya ditampilkan di layar ulasan notulen otomatis — kedua angka tidak dicampur. Retensi: baris `meeting_speaking_times` dihapus bersama transkrip (`MINUTES_TRANSCRIPT_RETENTION_DAYS`, bawaan 90 hari, job harian `PruneSpeakingTimes`). `meeting_attendances` (kehadiran) tetap disimpan — keputusan retensinya masih terbuka (pemilik).

### 3.1 `SpeakingTotals` (`room.speaking`, `GET/POST …/video/bicara`)

```json
{
  "occurrence_date": "2026-10-08",
  "total_ms": 1086000,
  "updated_at": "2026-10-08T02:18:30Z",
  "people": [
    { "user_id": "01HZDIMAS000000000000000AA", "ms": 432000, "share": 40 },
    { "user_id": "01HZSARI0000000000000000AA", "ms": 246000, "share": 23 },
    { "user_id": "01HZYOGA0000000000000000AA", "ms": 0, "share": 0 }
  ],
  "silent": ["01HZYOGA0000000000000000AA"],
  "mine_ms": 246000,
  "interval_seconds": 15
}
```

- `people` urut `ms` turun (lalu id); `share` = persen bulat dari `total_ms` (0 bila total 0). `silent` = orang yang pernah masuk ruang kemunculan ini (webhook) atau sudah melapor, dengan `ms = 0` ("Yoga belum bicara").
- `mine_ms` = nilai tersimpan milik pengguna yang melihat. **Klien memulai penghitungnya dari `mine_ms`** (muat ulang/sambung ulang tidak mengulang dari 0).
- `GET` (`meetings.video.speaking`): siapa pun dengan `openVideo` (peserta). Untuk polling bila `features.realtime` false: tiap 15–30 detik.

### 3.2 `POST /rapat/{meeting}/video/bicara` (`meetings.video.speaking.report`)

Badan `{"ms": 246000}` = total akumulasi milik sendiri (bilangan bulat 0…86.400.000). Kirim tiap `interval_seconds` (15 detik) selama di ruang, **juga bila 0** (agar masuk daftar "belum bicara"), dan sekali saat keluar (`navigator.sendBeacon` tidak bisa CSRF → pakai `fetch(..., {keepalive: true})`). Siapa: `MeetingPolicy::joinVideo` (peserta di dalam jendela gabung). Batas laju `throttle:20,1` per pengguna → 429.

Jawaban 200: `SpeakingTotals` + `"accepted_ms": 246000`. Aturan anti-pembengkakan (`ReportSpeakingTime`):

- Monoton: nilai yang lebih kecil dari yang tersimpan diabaikan (tidak pernah turun).
- Dibatasi waktu nyata: ≤ (sekarang − masuk ruang pertama menurut webhook) + 5 detik; dan ≤ nilai tersimpan + (sekarang − laporan terakhir) + 5 detik; laporan pertama tanpa data webhook ≤ 60 detik. Kelebihan dipotong (bukan galat).
- Laporan < 3 detik setelah laporan sebelumnya diabaikan (jawaban tetap 200 dengan total sekarang).
- Siaran `speaking.updated` paling sering sekali per 5 detik per kemunculan.

## 4. Kehadiran & Panggil

### 4.1 `VideoSummary` (`room.video`, juga di detail rapat) — tambahan

Kunci lama tetap (`configured, join_href, room_href, token_url, opens_at, closes_at, is_organizer, can_join, denied_reason, attendance, in_room`). `attendance[]` mendapat `late_minutes` dan `late`; kunci baru `not_joined`, `late_grace_minutes`. Dihitung dengan **satu query** (`VideoAttendance::roster`).

```json
{
  "attendance": [
    {
      "user_id": "01HZRIZKY000000000000000AA",
      "joined_at": "2026-10-08T02:04:10Z",
      "left_at": null,
      "duration_seconds": 860,
      "in_room": true,
      "sessions": 1,
      "late_minutes": 4,
      "late": true
    }
  ],
  "in_room": 6,
  "not_joined": [
    { "user_id": "01HZLUKMAN00000000000000AA", "rsvp": "yes", "optional": false, "called_at": "2026-10-08T02:12:00Z" }
  ],
  "late_grace_minutes": 2,
  "removed": [
    { "user_id": "01HZBXYU0000000000000000AA", "removed_by": "01HZDXMAS000000000000000AA", "removed_at": "2026-10-08T02:20:00Z" }
  ]
}
```

- `late_minutes` = menit utuh antara mulai kemunculan dan masuk pertama (0 bila tepat/lebih awal). `late` = `late_minutes > late_grace_minutes` → lencana "Terlambat 4 mnt"; selain itu "Hadir". Jam masuk ditampilkan dari `joined_at` (zona kantor).
- `not_joined` = karyawan yang diundang (termasuk penyelenggara/notulis) yang belum pernah masuk ruang kemunculan ini, urut: penyelenggara, notulis, lalu urutan undangan; `rsvp = "no"` tetap ikut (UI boleh meredupkan). `called_at` = Panggil terakhir (null bila belum).
- `removed` = dikeluarkan penyelenggara dari ruang kemunculan ini (audit R-04): mereka **tidak** mendapat token lagi (`POST …/video/token` → 403 "Penyelenggara mengeluarkan Anda dari rapat ini."; laporan bicara juga 403) sampai penyelenggara menekan **Izinkan masuk lagi**: `DELETE links.readmit` (`meetings.video.readmit`, `moderateVideo`) → `{"readmitted": true|false}`, diaudit `meeting.video_participant_readmitted`. Larangan dicatat walau panggilan LiveKit gagal (502).
- `GET /rapat/{meeting}/video/kehadiran` (`meetings.video.attendance`, `openVideo`) → `{"attendance": […], "in_room": 6, "not_joined": […], "late_grace_minutes": 2, "removed": […]}` (untuk panel + polling 30 detik bila tanpa realtime).

### 4.2 `POST /rapat/{meeting}/video/panggil/{user}` (`meetings.video.call`)

Tanpa badan (kecuali `tanggal`). Siapa: notulis/penyelenggara (`MeetingPolicy::callParticipant`; peserta biasa 403). Target harus karyawan yang diundang, aktif, bukan diri sendiri, dan **belum di ruang**; selain itu 422 `{message}`. Hanya selama jendela gabung (di luar → 422). Batas: **sekali per menit per orang yang dipanggil** (per kemunculan) → 429 `{"message": "Lukman baru saja dipanggil. Coba lagi dalam 42 detik.", "retry_after": 42}`.

Jawaban 200:

```json
{ "called": { "user_id": "01HZLUKMAN00000000000000AA", "called_at": "2026-10-08T02:12:00Z", "called_by": "01HZSARI0000000000000000AA" } }
```

Efek: notifikasi in-app (Inbox + toast realtime di kanal pribadi orang itu; email sesuai preferensi `meeting`) berjudul **"Rapat sudah dimulai — Gabung"**, isi "Sari Wulandari memanggil Anda ke Rapat mingguan Operasional · Kam, 8 Okt 2026 · 09.00–10.00 WIB", tombol **Gabung** → pra-gabung (`/rapat/{id}/gabung?tanggal=…`); dicatat di `audit_logs` (`meeting.video_participant_called`); event `participant.called` (§5). Belum ada push perangkat (tidak ada kanal push di aplikasi).

### 4.3 Angkat tangan & token (audit R-05, R-08, R-09)

- Token peserta **tidak** lagi punya `canUpdateOwnMetadata` (dan tidak pernah `roomAdmin`): klien tidak bisa `setName`, `setMetadata`, atau `setAttributes`. Nama/avatar di UI diambil dari `room.people`/`participants` menurut `participant.identity` (rapatui), bukan `participant.name`.
- **Angkat tangan** `POST links.hand` `{"raised": true|false}` (`meetings.video.hand`, `joinVideo`, `throttle:30,1`) → `{"hand": "1759889400123"}` (waktu angkat dalam ms) atau `{"hand": ""}`. Server mengatur atribut LiveKit `hand` peserta itu (Room Service `UpdateParticipant`); klien lain melihatnya lewat `ParticipantAttributesChanged` seperti sebelumnya (urut menurut nilai). 502 bila LiveKit gagal, 503 bila belum diatur. Atribut `rk_notulen_optout` (agen notulen) juga harus diatur server (`LiveKitRoomService::updateAttributes`), bukan klien.
- Bisukan (`POST …/video/peserta/{user}/bisukan`) kini diaudit `meeting.video_participant_muted`.
- Rapat video **dibatalkan** → semua ruang LiveKit-nya yang mungkin hidup dihapus (`DeleteRoom`, job `CloseMeetingRooms`): klien menerima `Disconnected` (alasan `ROOM_DELETED`) → tampilkan "Rapat dibatalkan". Akun **dinonaktifkan** → tidak mendapat token dan dikeluarkan dari ruang yang sedang diikuti (job `RemoveUserFromVideoRooms`).

## 5. Realtime (Reverb)

Kanal privat **`meeting.{meetingId}`** (`Echo.private('meeting.' + id)`; otorisasi `routes/channels.php` = `MeetingPolicy::openVideo`, hanya rapat video). Satu kanal per rapat/seri: **setiap payload membawa `occurrence_date`; abaikan yang bukan kemunculan Anda.** Event dikirim setelah commit lewat antrean `realtime`. Nama event (pakai titik di depan: `.listen('.speaking.updated', …)`):

| Event | Payload | Kapan | Reaksi UI |
|---|---|---|---|
| `speaking.updated` | `{occurrence_date, totals: SpeakingTotals tanpa mine_ms/interval_seconds}` | laporan bicara diterima; maks. 1×/5 detik per kemunculan | perbarui panel Waktu bicara |
| `participant.called` | `{occurrence_date, user_id, called_by, called_at}` | Panggil berhasil | "Dipanggil 09.12" di baris belum masuk |
| `minutes.source_chosen` | `{occurrence_date, source, chosen_by, chosen_at}` | sumber notulen dipilih | pra-gabung orang lain: ganti kartu pilihan |
| `minutes.updated` | `{occurrence_date, minutes_id, version, saved_at, updated_by, status}` | notulen disimpan/difinalkan/dibuka kembali, tindak lanjut berubah, sumber dipilih | debounce 1 detik → `GET minutes.links.data` (abaikan bila `updated_by` = diri sendiri dan tidak ada perubahan status) |
| `minutes.editing` | `{occurrence_date, editing: {user_id, name, since, expires_at} \| null}` | mode autosave: pemegang petunjuk menyunting berganti / dilepas | tampilkan/hapus "X sedang menyunting" |
| `attendance.updated` | `{occurrence_date, user_id, event: "joined" \| "left" \| "finished"}` | webhook LiveKit tercatat | ambil ulang `GET …/video/kehadiran` (debounce 2 detik) |

Tanpa realtime (`features.realtime` false atau WebSocket putus): polling `GET …/video/bicara` 15–30 detik, `GET …/video/kehadiran` 30 detik, `GET …/notulen/data` 10 detik saat dokumen tidak sedang diketik.

## 6. Ringkasan rute baru

| Metode | URL | Nama | Kebijakan | Laju |
|---|---|---|---|---|
| GET | `/rapat/{meeting}/notulen/data` | `meetings.minutes.data` | `view` | `throttle:api` |
| GET | `/rapat/{meeting}/notulen/kolaborasi` | `meetings.minutes.collab` | `view` (+ kolaborasi aktif, 503) | `throttle:60,1` |
| POST | `/rapat/{meeting}/notulen/menyunting` | `meetings.minutes.editing` | `editMinutes` | `throttle:api` |
| DELETE | `/rapat/{meeting}/video/peserta/{user}/larangan` | `meetings.video.readmit` | `moderateVideo` | `throttle:api` |
| POST | `/rapat/{meeting}/video/tangan` | `meetings.video.hand` | `joinVideo` | `throttle:30,1` |
| POST | `/rapat/{meeting}/video/sumber-notulen` | `meetings.video.notes-source` | `editMinutes` | `throttle:api` |
| GET | `/rapat/{meeting}/video/bicara` | `meetings.video.speaking` | `openVideo` | `throttle:api` |
| POST | `/rapat/{meeting}/video/bicara` | `meetings.video.speaking.report` | `joinVideo` | `throttle:20,1` |
| GET | `/rapat/{meeting}/video/kehadiran` | `meetings.video.attendance` | `openVideo` | `throttle:api` |
| POST | `/rapat/{meeting}/video/panggil/{user}` | `meetings.video.call` | `callParticipant` | `throttle:api` + 1/menit/orang |

Wayfinder: `@/routes/meetings` (mis. `meetings.video.speaking.report.url(id, {query: {tanggal}})`) atau `@/actions/App/Http/Controllers/Meetings/MeetingRoomController`.

## 7. Riwayat kontrak

| Tanggal | Perubahan |
|---|---|
| 7 Okt 2026 | Versi pertama (rapatbe). |
| 7 Okt 2026 | Keputusan lead: notulen kolaboratif (`mode`, `collab`, token `…/notulen/kolaborasi`, `can_edit` per mode, `can_edit_attendance`, `attendance_only`), petunjuk menyunting (`editing`, `…/notulen/menyunting`, event `minutes.editing`), sumber waktu bicara & retensi, `template.key = agenda` + `template.label` (ganti `template.name`), kehadiran ≠ persetujuan transkrip. |
| 7 Okt 2026 | Audit keamanan: `removed` + Izinkan masuk lagi (R-04), token tanpa `canUpdateOwnMetadata` + `POST …/video/tangan` (R-05), bisukan diaudit (R-08), ruang ditutup saat batal / akun nonaktif (R-09), `links.readmit`, `links.hand`. |
