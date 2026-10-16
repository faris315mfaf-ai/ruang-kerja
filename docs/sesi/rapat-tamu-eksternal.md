# Rapat video: tamu eksternal & ruang tunggu (kontrak backend untuk UI web dan aplikasi)

> Dibuat 15 Okt 2026 (Claude Code, branch `claude/rapat-tamu-eksternal`, dari `claude/android-bagian-5`). **Backend selesai**; UI web (`resources/js/pages/meetings/guest.tsx` masih placeholder) dan UI aplikasi dikerjakan agen lain berdasarkan dokumen ini. Fitur di balik `FEATURE_MEETINGS` dan hanya untuk rapat `platform = video`.

## 1. Keputusan pemilik (final) dan penerapannya

| Keputusan | Penerapan |
|---|---|
| Masuk lewat **tautan pribadi per tamu** (tanpa akun) + **ruang tunggu** | `https://<host>/tamu/{token}`. Tamu mengisi nama → menunggu → **penyelenggara, notulis, atau peserta internal rapat itu** menekan Izinkan masuk / Tolak. Tautan kedaluwarsa otomatis |
| Undangan **hanya salin tautan**, tanpa email otomatis | Aplikasi **tidak mengirim email/notifikasi apa pun ke tamu**. Penyelenggara menyalin tautan per tamu dari daftar tamu (web dan aplikasi) |
| Hak tamu: video, suara, berbagi layar, obrolan rapat. Tidak melihat notulen/transkrip/tugas/data aplikasi; tidak bisa moderasi; bisa dikeluarkan | Token LiveKit: `roomJoin`, `canPublish`, `canSubscribe`, `canPublishData` — **tanpa** `roomAdmin`, tanpa `canUpdateOwnMetadata`. Tamu tidak punya sesi; rute `/rapat/*` dan `/api/v1/*` menolaknya (401) |

## 2. Cara kerja tautan, dan mengapa token tidak disimpan

- **Bentuk token** (segmen terakhir URL): 58 karakter = `{id baris meeting_participants, ULID huruf kecil, 26}{32 karakter base64url dari HMAC-SHA256(APP_KEY, "guest-link|<id>|<link_nonce>")}`. Regex: `[0-9a-hjkmnp-tv-z]{26}[A-Za-z0-9_-]{32}` (`GuestLinks::PATTERN`).
- **Token mentah tidak pernah disimpan.** Database hanya menyimpan `link_nonce` (acak) dan `link_token_hash` (SHA-256 token, kunci pencarian). Karena token = HMAC deterministik dari baris + nonce, penyelenggara **bisa menyalin ulang kapan saja** (`link_url` selalu dikembalikan oleh daftar tamu), sedangkan salinan tabel saja tidak menghasilkan tautan yang berlaku. Token tidak masuk `audit_logs`, log aplikasi, maupun jawaban selain ke penyelenggara dan ke pemegang tautan.
- **Putar ulang** (`POST …/tamu/{id}/putar`) membuat nonce baru: tautan lama langsung 404, status ruang tunggu tamu dikosongkan, dan tamu yang sedang di ruang dikeluarkan dari LiveKit. **Cabut** (`DELETE …/tamu/{id}`) menghapus baris (dan tautannya) dan mengeluarkan tamu dari ruang.
- Mengganti `APP_KEY` mematikan semua tautan tamu (hash disegarkan otomatis saat penyelenggara membuka daftar tamu; tautan lama yang sudah dibagikan tidak berlaku).
- **Kedaluwarsa** (`link_expires_at`): akhir jendela gabung (selesai + `LIVEKIT_JOIN_AFTER_MINUTES`, 120 menit) kemunculan terakhir. Rapat tunggal = akhir jendela rapat itu. Seri dengan tanggal akhir = akhir jendela tanggal akhir. Seri tanpa akhir = paling lama `LIVEKIT_GUEST_LINK_MAX_DAYS` (60) hari dari pembuatan/putar ulang. Mengubah jadwal rapat menggeser kedaluwarsa semua tautan tamu (tautan tidak berubah).
- **Seri berulang:** satu tautan berlaku untuk seluruh seri, tetapi izin masuk (`lobby`) berlaku **per kemunculan**: tamu yang diizinkan hari Senin harus meminta izin lagi Senin berikutnya. Kemunculan yang dibuka tautan = kemunculan hari ini/berikutnya; bila jendela gabung kemunculan hari ini sudah tutup, tautan menunjuk ke tanggal berikutnya (jendela `early` sampai 15 menit sebelum mulai).

### Menyalin tautan (UI penyelenggara)

`GET /rapat/{id}/tamu` mengembalikan `link_url` penuh per tamu (`https://<host>/tamu/<token>`). UI menampilkan tombol "Salin tautan" (`navigator.clipboard.writeText`; di aplikasi `Clipboard`/share sheet) dan tombol "Putar ulang tautan" / "Cabut". Tautan itu rahasia: jangan ditulis ke log klien, jangan dimasukkan ke URL lain, jangan dikirim ke analitik.

## 3. Endpoint publik untuk tamu (tanpa sesi, tanpa CSRF, tanpa cookie)

Semua di bawah `https://<host>/api/tamu/{token}`; JSON; `Cache-Control: no-store`; middleware sesi/Inertia dilepas (`routes/meetings.php`). Token yang tidak cocok apa pun (tidak dikenal, sudah diputar, dicabut, rapat dihapus, salah format) menjawab **404 generik yang sama** `{"message":"Tautan tidak dikenal.","code":"tidak_dikenal"}` sehingga keberadaan rapat/tamu tidak bocor.

**Batas laju** (per IP **dan** per tautan, 429 `{"message":"Terlalu banyak permintaan…","code":"throttled"}`): `info` 60/30 per menit · `minta-masuk` 20/6 · `status` 120/45 (polling 3 detik ≈ 20/menit) · `token` 30/12.

### 3.1 `GET /api/tamu/{token}/info`
```json
{
  "status": "none",
  "status_label": "Belum masuk",
  "window": { "state": "open", "opens_at": "2026-10-05T02:45:00Z", "closes_at": "2026-10-05T06:00:00Z" },
  "meeting": {
    "title": "Sinkron mitra",
    "starts_at": "2026-10-05T03:00:00Z",
    "ends_at": "2026-10-05T04:00:00Z",
    "occurrence_date": "2026-10-05",
    "organizer_name": "Dimas Pratama"
  },
  "guest": { "name": "Budi" },
  "features": { "video_configured": true },
  "poll_seconds": 3,
  "notice_points": [
    "Anda masuk sebagai tamu: video, suara, berbagi layar, dan obrolan rapat.",
    "Suara dan video Anda tidak direkam dan tidak ditranskrip.",
    "Penyelenggara mencatat nama, alamat IP, dan waktu masuk Anda."
  ]
}
```
- Hanya itu yang diketahui tamu: **tidak** ada agenda, deskripsi, peserta lain, workspace, notulen. `guest.name` = nama yang diisi penyelenggara (untuk mengisi awal kolom nama) atau yang diketik tamu sebelumnya; boleh `null`.
- `window.state`: `early` (belum 15 menit sebelum mulai) · `open` · `closed`. Saat `status` = `expired`/`closed`, `meeting` dan `window` bernilai `null` (judul pun tidak ditampilkan).
- `notice_points` wajib tampil di layar tamu (privasi).

### 3.2 `POST /api/tamu/{token}/minta-masuk`  `{"name": "Budi Mitra"}`
Masuk ruang tunggu kemunculan saat ini. Nama dibersihkan server (tag dibuang, spasi dirapikan, 2–60 karakter, kata "(Tamu)" dibuang). Jawaban sama bentuknya dengan `status` (§3.3). Idempoten selama `waiting` (nama boleh diperbaiki). Tamu yang `denied`/`removed` **tidak** kembali ke `waiting`: jawabannya tetap `denied`/`removed` sampai seseorang menekan Izinkan.

Galat: `422` validasi (`errors.name`) atau `{code:"nama_kosong"}` · `409 {code:"ruang_belum_dibuka", message:"Ruang rapat dibuka pukul 09.45."}` · `410 {code:"ditutup"}` (rapat selesai/dibatalkan/bukan video) · `410 {code:"kedaluwarsa"}`.

### 3.3 `GET /api/tamu/{token}/status` (polling)
```json
{ "status": "waiting", "status_label": "Menunggu diizinkan penyelenggara", "window": "open" }
```
`status`:

| Nilai | Arti | Tindakan UI |
|---|---|---|
| `none` | belum meminta masuk (untuk kemunculan ini) | tampilkan form nama |
| `waiting` | menunggu keputusan | layar "Menunggu penyelenggara…", poll tiap `poll_seconds` (3 detik) |
| `admitted` | diizinkan | panggil `token` (§3.4), tampilkan pra-gabung/ruang |
| `denied` | ditolak | pesan "Penyelenggara menolak permintaan Anda"; tanpa tombol coba lagi |
| `removed` | dikeluarkan dari ruang | pesan "Penyelenggara mengeluarkan Anda dari rapat ini" |
| `expired` | tautan kedaluwarsa | "Minta tautan baru kepada penyelenggara" |
| `closed` | rapat selesai/dibatalkan, atau jendela gabung tutup | "Rapat sudah selesai" |

`window` ∈ `early|open|closed` (null untuk `expired`/`closed`). Polling berhenti pada status akhir (`denied`, `removed`, `expired`, `closed`) atau setelah `admitted`.

### 3.4 `POST /api/tamu/{token}/token`
Hanya bila `admitted` dan dalam jendela gabung. 200:
```json
{
  "url": "wss://livekit.spkd.store",
  "token": "<JWT LiveKit, 10 menit>",
  "room": "rk-01j…-20261005",
  "identity": "guest:01jb…",
  "name": "Budi Mitra (Tamu)",
  "expires_at": "2026-10-05T03:00:00Z",
  "occurrence_date": "2026-10-05",
  "role": "guest",
  "can": { "moderate": false, "call_participants": false, "edit_minutes": false }
}
```
- Sambungkan dengan `livekit-client` memakai `url` + `token`. Minta token baru saat sambung ulang (TTL 10 menit); permintaan ditolak bila tamu sudah dikeluarkan/diputar ulang/jendela tutup.
- Galat: `403 {code: "belum_meminta"|"menunggu"|"ditolak"|"dikeluarkan"}` · `410 {code:"ditutup"|"kedaluwarsa"}` · `503 {code:"video_belum_siap"}`.
- **Nama tampilan tamu di ruang** = `participant.name` dari LiveKit (`Nama (Tamu)`); nilainya ditandatangani server dan tamu tidak punya `canUpdateOwnMetadata`, jadi tidak bisa mengubahnya. Peserta dengan `identity` berawalan **`guest:`** (atau `metadata.guest === true`) harus diberi lencana "Tamu" dan **tidak dicari** di `people` (daftar karyawan); jangan tampilkan tile "peserta tidak dikenal" generik. Tidak ada avatar/atribut `hand` untuk tamu (tombol angkat tangan tamu belum dibangun).
- Obrolan rapat memakai LiveKit data (grant `canPublishData` sudah ada). Layar tamu tidak boleh memuat panel notulen, transkrip, tugas, atau kehadiran karyawan, dan tidak memanggil endpoint `/rapat/*` mana pun.

### 3.5 Halaman web tamu: `GET /tamu/{token}`
Rute web (sesi tetap berjalan, tanpa `auth`), Inertia `meetings/guest`, **muat penuh** (`EnsureFullPageLoad`) agar `Permissions-Policy` mengizinkan kamera, mikrofon, dan berbagi layar; header `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store, private`. Props: `{ token: string|null, guest: <jawaban §3.1> }`. Token tak dikenal → status HTTP 404 dengan `token: null` dan `guest: {status: "unknown", status_label: "Tautan tidak dikenal"}`. Tata letak full-screen tanpa shell (`resources/js/app.tsx` sudah mendaftarkan `meetings/guest` tanpa layout). Layar yang dibutuhkan: nama + "Minta masuk", menunggu, ditolak/dikeluarkan/kedaluwarsa/selesai, pra-gabung (cek kamera/mikrofon, memakai komponen pra-gabung yang sudah ada tanpa panel notulen), ruang (grid, berbagi layar, obrolan, keluar). Mobile mengikuti `docs/PLATFORM.md` (satu kolom, tombol ≥ 44px).

## 4. Endpoint untuk penyelenggara dan peserta internal

Satu controller (`MeetingGuestController`) melayani web dan API v1; bentuk JSON **identik**. Rapat yang tidak terlihat → 404. Semua jawaban `Cache-Control: no-store`. Parameter `?tanggal=YYYY-MM-DD` memilih kemunculan seri (seperti endpoint video lain).

| Web | API ponsel (`/api/v1`, Bearer) | Siapa | Isi |
|---|---|---|---|
| `GET /rapat/{id}/tamu` | `GET /rapat/{id}/tamu` | **penyelenggara** (`manageGuests`) | daftar tamu + tautan |
| `POST /rapat/{id}/tamu` | idem | penyelenggara | `{email, name?}` → 201 `{guest}` (200 bila email sudah ada) |
| `POST /rapat/{id}/tamu/{participant}/putar` | idem | penyelenggara | tautan baru → `{guest}` |
| `DELETE /rapat/{id}/tamu/{participant}` | idem | penyelenggara | cabut → `{ok:true}` |
| `GET /rapat/{id}/video/ruang-tunggu` | idem | penyelenggara, notulis, peserta internal (`manageLobby`) | daftar yang menunggu |
| `POST /rapat/{id}/video/ruang-tunggu/{participant}/izinkan` | idem | `manageLobby` | izinkan masuk |
| `POST /rapat/{id}/video/ruang-tunggu/{participant}/tolak` | idem | `manageLobby` | tolak |
| `DELETE /rapat/{id}/video/peserta/guest:{participant}` | `POST /rapat/{id}/video/keluarkan` `{user_id: "guest:{participant}"}` | penyelenggara | keluarkan dari ruang (LiveKit `RemoveParticipant`) |
| `POST /rapat/{id}/video/peserta/guest:{participant}/bisukan` `{track_sid}` | `POST …/video/bisukan` `{user_id:"guest:…", track_sid}` | penyelenggara | bisukan mikrofon tamu |
| — (izinkan lagi = `…/ruang-tunggu/{participant}/izinkan`) | `POST …/video/izinkan-masuk` `{user_id:"guest:…"}` | penyelenggara | izinkan lagi tamu yang dikeluarkan (sama dengan izinkan) |

`{participant}` = `guests[].id` (ULID). Web memakai CSRF/axios biasa; API memakai `Idempotency-Key` seperti rute tulis lain.

**Siapa boleh apa (`MeetingPolicy`)**

| Kemampuan | Penyelenggara | Notulis | Peserta internal | Pengamat rapat pimpinan tak diundang | Lainnya |
|---|---|---|---|---|---|
| `manageGuests` (daftar+tautan, tambah, putar, cabut) | ✓ | 403 | 403 | 403 | 404 |
| `manageLobby` (lihat ruang tunggu, izinkan, tolak) | ✓ | ✓ | ✓ | 403 | 404 |
| keluarkan / bisukan tamu | ✓ | 403 | 403 | 403 | 404 |

Rapat dibatalkan atau bukan `video`: semuanya 403/404 sesuai Policy. Admin/HR/Super Admin tidak punya hak tambahan.

### 4.1 `GET /rapat/{id}/tamu`
```json
{
  "occurrence_date": "2026-10-05",
  "window": { "state": "open", "opens_at": "2026-10-05T02:45:00Z", "closes_at": "2026-10-05T06:00:00Z" },
  "limit": 30,
  "guests": [
    {
      "id": "01jb…",
      "email": "budi@mitra.test",
      "name": "Budi Mitra",
      "link_url": "https://ruangkerja.test/tamu/01jb…Qx9…",
      "link_expires_at": "2026-10-05T06:00:00Z",
      "link_expired": false,
      "link_rotated_at": null,
      "status": "waiting",
      "status_label": "Menunggu",
      "requested_at": "2026-10-05T02:58:10Z",
      "admitted_at": null,
      "in_room": false,
      "identity": "guest:01jb…"
    }
  ]
}
```
`status` ∈ `none|waiting|admitted|denied|removed` **untuk kemunculan `occurrence_date`**. `in_room` = ada sesi LiveKit terbuka (dari webhook). `limit` = 30 tamu per rapat (422 `{code:"terlalu_banyak_tamu"}`). Tamu yang ditambah lewat kolom email di formulir rapat (`guest_emails`, plus `guest_names` opsional `{"email": "Nama"}`) muncul di sini juga; tautan dibuat otomatis (untuk tamu lama, saat daftar dibuka pertama kali).

`POST /rapat/{id}/tamu` → `{ "guest": { …bentuk di atas… } }`. Menambahkan email yang sudah ada tidak mengubah tautannya (hanya nama).

### 4.2 `GET /rapat/{id}/video/ruang-tunggu` (polling ±4 detik atau kanal realtime §5)
```json
{
  "occurrence_date": "2026-10-05",
  "window": { "state": "open", "opens_at": "…", "closes_at": "…" },
  "waiting": [
    { "id": "01jb…", "name": "Budi Mitra", "email": "budi@mitra.test", "requested_at": "2026-10-05T02:58:10Z", "identity": "guest:01jb…" }
  ],
  "waiting_count": 1
}
```
UI: badge/daftar "Tamu menunggu" di ruang dan di halaman pra-gabung penyelenggara/peserta; tombol **Izinkan masuk** dan **Tolak** per baris. Email ditampilkan kecil sebagai pembanding nama yang diketik.

### 4.3 `POST …/izinkan` dan `…/tolak`
200 `{ "guest": { "id", "name", "status": "admitted"|"denied", "status_label" } }`. Izinkan boleh dari `waiting`, `denied`, `removed` (mengizinkan lagi tamu yang ditolak/dikeluarkan); tolak hanya dari `waiting`. Menekan tombol yang sama dua kali tidak mengubah apa pun (idempotent). Galat: `409 {code:"belum_meminta"}` (tamu belum meminta masuk), `409 {code:"status_berubah"}` (status sudah berubah; muat ulang daftar), `410 {code:"ditutup"|"kedaluwarsa"}`.

### 4.4 Mengeluarkan tamu
`RemoveVideoParticipant` menerima identitas `guest:{participant}`: status tamu untuk kemunculan itu menjadi `removed` (token baru ditolak dengan `403 dikeluarkan`), lalu LiveKit `RemoveParticipant`. "Izinkan masuk lagi" = `…/ruang-tunggu/{participant}/izinkan`. Kegagalan LiveKit → 502 `{message}` (tamu tetap tidak bisa masuk lagi).

## 5. Realtime (opsional) dan kehadiran

- Kanal privat Reverb `meeting.{id}` (hanya orang yang diundang): event baru **`lobby.updated`** `{occurrence_date, waiting}` (jumlah yang menunggu) setiap tamu minta masuk / diizinkan / ditolak / tautan diputar. UI cukup memuat ulang `…/ruang-tunggu` saat event datang; polling 4 detik tetap sebagai cadangan (aplikasi ponsel belum punya klien Echo → polling). Tamu **tidak** berlangganan kanal ini.
- **Kehadiran:** webhook LiveKit mencatat identitas `guest:{id}` di `meeting_attendances` dengan `user_id` null, `participant_id` dan `guest_name` ("Nama (Tamu)"). `GET /rapat/{id}/video/kehadiran` (web dan API `…/video/kehadiran`) dan prop `video` pada halaman pra-gabung/ruang kini memuat **`guests`**: `[{participant_id, name, joined_at, left_at, duration_seconds, in_room, sessions}]`. Tamu **tidak** dihitung di `in_room` (angka karyawan); tampilkan sebagai kelompok/lencana "Tamu". Tamu tidak pernah masuk kehadiran notulen (`attendedUserIds` hanya karyawan) dan tidak pernah dipetakan ke pengguna.

## 6. Privasi, transkrip, keamanan

- **Tidak ditranskrip, tidak direkam:** identitas `guest:*` dikecualikan dari rekaman worker notulen otomatis (`transcriber/notulen/optout.py`: `may_record` menolak awalan `guest:`; uji `transcriber/tests/test_optout.py`) **dan** dibuang lagi oleh `RecordTranscriptUpdate` bila segmennya tetap sampai. Tamu bukan "peserta internal": tidak ada kartu persetujuan dan tidak ada di `speakers`. Tidak ada rekaman video/audio di aplikasi.
- **Akses data:** tamu hanya punya tautan; semua rute `/rapat/*`, `/api/v1/*`, transkrip, notulen, tugas, `/internal/*` menuntut sesi/Sanctum (401). Uji `tests/Feature/Meetings/MeetingGuestTest.php` ("keeps guests away from every employee route").
- **Token mentah** hanya ada di: respons ke penyelenggara (daftar tamu) dan URL yang diketik/dibuka tamu. Tidak di DB, `audit_logs`, log, event, atau jawaban `info`/`status`.
- **Anti-penyalahgunaan:** 404 generik untuk semua token tidak sah; batas laju per IP + per tautan; nama dibersihkan dan selalu diberi akhiran "(Tamu)" oleh server (tidak bisa meniru "Direktur Utama" tanpa lencana); tamu tidak punya `roomAdmin`/`canUpdateOwnMetadata` sehingga tidak bisa mengubah nama, mengeluarkan orang, atau memanggil Room Service API; token LiveKit 10 menit; rapat yang dibatalkan menutup ruang (`CloseMeetingRooms`).
- **Audit** (`audit_logs`, tanpa token): `meeting.guest_added`, `meeting.guest_removed` (dicabut), `meeting.guest_link_rotated`, `meeting.guest_admitted`, `meeting.guest_denied`, `meeting.guest_joined` (sekali per izin; pelaku = pengguna yang sedang masuk jika ada, selain itu kosong), `meeting.guest_kicked`. Menghapus tamu lewat daftar email di formulir rapat tidak diaudit per tamu (hanya perubahan rapat).

### Teks kebijakan privasi yang perlu ditambahkan (versi **tidak** diubah di sini)
Tambahkan di `resources/markdown/privacy-policy.md` (pemilik yang menaikkan `PRIVACY_POLICY_VERSION`):
> **Tamu rapat video.** Orang di luar perusahaan dapat diundang ke rapat video melalui tautan pribadi. Untuk tamu, kami mencatat nama yang diketik, alamat email yang dimasukkan penyelenggara, alamat IP dan waktu permintaan masuk, serta waktu masuk dan keluar ruang rapat. Suara dan video tamu tidak direkam dan tidak ditranskrip. Tamu tidak dapat melihat notulen, transkrip, tugas, atau data lain di aplikasi. Data kehadiran tamu disimpan bersama data rapat; tautan tamu kedaluwarsa otomatis setelah rapat berakhir.

Dan di bagian retensi: data kehadiran tamu mengikuti retensi `meeting_attendances` (belum ada batas otomatis; keputusan pemilik masih terbuka).

## 7. Yang sengaja tidak dibangun

- Email/notifikasi/WhatsApp ke tamu; undangan kalender Google untuk tamu.
- Tamu menulis obrolan di luar LiveKit, angkat tangan, waktu bicara, subtitle (butuh atribut yang diatur server untuk identitas `guest:*`; belum ada).
- Daftar "pernah hadir" lintas rapat, akun tamu, dan pendaftaran mandiri.
- Peran tamu yang bisa menjadi moderator atau co-host; pembatasan jumlah tamu aktif di ruang selain batas 30 undangan per rapat.
- Izin otomatis ("izinkan tanpa menunggu") dan izin yang berlaku lintas kemunculan seri.
- Notifikasi dorong ke penyelenggara saat tamu menunggu (hanya event `lobby.updated` + polling).
- Perubahan teks kebijakan privasi/versi persetujuan.

## 8. Daftar pekerjaan UI (untuk agen web dan ponsel)

1. **Penyelenggara:** panel "Tamu" pada detail rapat video / pra-gabung: daftar `GET …/tamu`, tambah (email + nama), salin tautan, putar ulang, cabut, status tamu; tombol "Keluarkan" di tile tamu (identity `guest:`).
2. **Semua yang diundang:** daftar "Menunggu masuk" (poll 4 detik atau `lobby.updated`) dengan Izinkan/Tolak, di pra-gabung dan di ruang; bunyi/animasi halus saat ada yang baru (hormati `prefers-reduced-motion`).
3. **Tamu (web `meetings/guest`):** alur di §3 dengan teks Indonesia, status berikut label dari `status_label`, `notice_points` tampil sebelum "Minta masuk".
4. **Ruang:** lencana "Tamu" untuk identitas `guest:*`; kelompok "Tamu" di panel Kehadiran memakai `guests`.
5. **Ponsel:** panel Tamu + ruang tunggu memakai rute API v1 di atas (hanya penyelenggara/undangan; tamu membuka tautan di peramban).

## 9. UI aplikasi Android (agen ponsel, 15 Okt 2026)

Kode: `apps/mobile/src/api/rapatTamu.ts` (7 panggilan, semuanya `cache: false`), `src/features/rapat/{tamu.ts (logika murni), useTamuRapat.ts, useRuangTunggu.ts, KartuTamu.tsx}`, `src/features/video/SheetRuangTunggu.tsx`; perubahan di `app/rapat/[id]/index.tsx`, `app/rapat/[id]/video/{ruang,pra-gabung}.tsx`, `FormRapat.tsx`, `PemilihPeserta.tsx`, `Ubin.tsx`, `SheetKehadiran.tsx`, `useRuang.ts`. Uji murni: `cd apps/mobile && npm run test:rapat-tamu`. Tidak ada paket baru dan tidak ada perubahan backend/web.

### Keputusan

- **Tautan dibagikan lewat sheet Bagikan sistem (`Share`), bukan clipboard.** `expo-clipboard` belum terpasang dan paket baru dilarang untuk tugas ini; sheet Bagikan Android sudah punya "Salin", WhatsApp, dll. Tombolnya berlabel "Bagikan tautan" (bukan "Salin") dan **tidak ada snackbar "Tautan disalin"** karena aplikasi tidak bisa memastikannya. Bila nanti `expo-clipboard` dipasang (butuh build native baru), cukup ganti isi fungsi `bagikan` di `KartuTamu.tsx`.
- **Tautan rahasia:** tidak pernah ditampilkan utuh (UI hanya `host/tamu/…`), tidak masuk log (uji menolak `console.*` di modul tamu), tidak masuk cache offline (`/tamu` ditambahkan ke `TOLAK_PENGGALAN` di `src/offline/cache.ts` **dan** tiap panggilan `cache: false`), tidak disimpan di state selain memori hook layar detail.
- **Hanya online:** tambah/putar/cabut/izinkan/tolak tidak pernah diantrekan; offline → "Butuh koneksi — … tidak bisa dilakukan saat offline." Daftar tamu offline tidak ditampilkan dari cache (memuat tautan).
- **Hak diturunkan di klien dari peran di rapat**, karena detail API (`GET /rapat/{id}`) belum mengirim `manage_guests`/`manage_lobby` dan `video.can_join` mengikuti jendela gabung (bukan `openVideo`), serta `video.is_organizer` tidak ada di jawaban detail: penyelenggara = `manageGuests`; penyelenggara/notulis/peserta internal = `manageLobby`. Server tetap hakim: 403/404 menghentikan pemantauan dan menyembunyikan lencana.
- **Polling ruang tunggu** `jedaRuangTunggu`: 4 detik, backoff ×2 sampai 30 detik saat gagal, hanya saat layar aktif (tersambung di ruang / pra-gabung siap) **dan** aplikasi di latar depan; kembali ke depan langsung segar; berhenti pada 403/404/410. Pemberitahuan tamu baru: toast di ruang ("Budi menunggu masuk", tombol Lihat) + getar 40 ms (`Vibration`, izin VIBRATE sudah ada; `expo-haptics` tidak terpasang). Tamu yang diizinkan/ditolak lalu minta lagi diumumkan lagi.
- **Peserta LiveKit `guest:*`** tidak pernah di-parse sebagai ULID user dan tidak memicu panggilan profil: nama = `participant.name` (ditandatangani server, "Nama (Tamu)"), ubin berlabel "(Tamu)" (nama depan + "(Tamu)" di ubin kecil), panel Kehadiran memberi lencana "Tamu", moderasi (Bisukan/Keluarkan) memakai `POST …/video/bisukan|keluarkan` dengan `user_id: "guest:{id}"`. Tamu dikecualikan dari "Waktu bicara" (kontrak §7). Tamu yang dikeluarkan muncul di "Tamu dikeluarkan" (diambil dari `GET …/tamu`, hanya penyelenggara) dengan "Izinkan masuk lagi" = `…/ruang-tunggu/{id}/izinkan`.
- **Formulir buat/ubah rapat** mengirim `guest_emails` + `guest_names` (peta email huruf kecil → nama bersih; email tanpa nama tidak dikirim sehingga nama yang sudah ada tidak tertimpa). Pemilih peserta punya isian "Nama tamu (opsional)", batas 30 tamu, dan teks diganti dari "undangan email ditahan" menjadi "masuk lewat tautan pribadi". Setelah simpan dengan tamu pada rapat video, detail dibuka dengan `?tamu=1` yang otomatis membuka daftar tamu (tombol Bagikan).

### Selisih / celah kontrak (untuk agen backend)

1. Detail rapat API v1 sebaiknya menyertakan `can.manage_guests` dan `can.manage_lobby` (dan `video.is_organizer`); sekarang diturunkan di klien.
2. `GET rapat/formulir` untuk rapat yang ada mengembalikan `guest_emails` tetapi **tanpa `guest_names`**: saat mengubah rapat nama tamu tidak bisa diisi awal (aman: tidak dikirim berarti tidak menimpa). Nama tamu baru dari formulir ubah tetap terkirim.
3. Baris tamu di `participants` detail rapat hanya memuat `email` (`user_id` null, tanpa `id` tamu dan tanpa `guest_name`); id tamu hanya ada di `GET …/tamu` (penyelenggara).
4. `Share` tidak bisa memberi tahu aplikasi bahwa tautan benar-benar disalin/dikirim.

### Perlu diverifikasi di emulator setelah build native

Tidak ada modul native baru (`expo prebuild` tidak perlu), cukup bundle JS baru. Daftar periksa (server lokal dengan `FEATURE_MEETINGS`, LiveKit lokal `docs/SETUP-LOKAL.md` §10, rapat video dengan 1 tamu):
1. Detail rapat (penyelenggara): kartu "Tamu eksternal" memuat daftar; Tambah (email valid, nama 1 huruf ditolak, email dobel = 200 tanpa ubah tautan); Bagikan membuka sheet sistem dengan teks berisi tautan; Putar ulang (dialog; tautan lama 404 di peramban); Cabut (dialog); batas 30.
2. Detail rapat sebagai peserta internal/notulis: hanya ringkasan jumlah tamu; pengamat rapat pimpinan: tidak ada kartu.
3. Pesawat/offline: aksi tamu menampilkan "Butuh koneksi"; daftar tamu tidak muncul dari cache.
4. Buat rapat video dengan tamu + nama → setelah simpan daftar tamu terbuka; ubah rapat tidak menghapus tamu lama.
5. Tamu membuka tautan di peramban lain dan meminta masuk: toast + getar di ruang (dan di pra-gabung kartu "Menunggu masuk"); Izinkan/Tolak (dialog tolak); ketuk lencana "Menunggu masuk (N)" di baris status ruang.
6. Tamu di ruang: ubin berlabel "(Tamu)", panel Kehadiran (lencana Tamu, menu Bisukan/Keluarkan/Sematkan), Keluarkan → tamu di peramban melihat "dikeluarkan"; "Tamu dikeluarkan" → Izinkan masuk lagi → tamu bisa masuk lagi.
7. Aplikasi ke latar belakang dan kembali: polling berhenti lalu segar lagi (cek jaringan di Metro/log server); keluar ruang menghentikan polling.
8. Tidak crash saat peserta berformat `guest:{id}` mengangkat tangan/berbicara/berbagi layar; "Waktu bicara" tidak memuat tamu; TalkBack membaca lencana "Tamu".
9. Detail rapat sesudah rapat: "Hadir di rapat video" memisahkan "Tamu eksternal (N)".
