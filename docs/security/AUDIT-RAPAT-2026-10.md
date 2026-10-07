# Audit keamanan, bug & efisiensi — Rapat video & sekitarnya (Okt 2026)

Auditor: agen **audit** (Claude Code), cabang `claude/audit-rapat`, worktree `../ruang-kerja-audit`.
Basis: `main` @ `b690875` (PR #10 Video RuangKerja/LiveKit, PR #11 sandi bawaan). Tanggal: 7 Oktober 2026.

Cakupan fase 1: `app/Domain/Meetings/**` (VideoRooms, LiveKitTokens, LiveKitRoomService, RecordVideoEvent, IssueVideoToken, Mute/Remove, VideoAttendance), `MeetingVideoController`, `LiveKitWebhookController`, `MeetingPolicy`, `config/livekit.php`, CSP/Permissions-Policy, front-end ruang rapat (`resources/js/features/meetings/video/*`), fitur sandi bawaan (PR #11), Caddy/compose/deploy/PITR, serta efisiensi (query, indeks, bundle, render ulang, polling). Ditambah tinjauan **awal** cabang `claude/notulen-otomatis` (worker Python `transcriber/` + kontrak data); `claude/rapat-ui` dan `claude/rapat-backend` belum punya commit saat audit ini.

Tingkat: **Kritis** · **Tinggi** · **Sedang** · **Rendah** · **Info**. Status: **Diperbaiki** (commit di cabang ini + test regresi) · **Rekomendasi** (pemilik kode/agen lain) · **Keputusan pemilik** · **Diterima**.

## 1. Ringkasan temuan

| ID | Tingkat | Temuan | Berkas | Status |
|---|---|---|---|---|
| R-01 | **Tinggi** | "Sandi bawaan" bisa diberikan HR **tanpa** "wajib ganti" → akun tetap memakai sandi yang diketahui semua karyawan, tanpa batas waktu | `app/Domain/Auth/Actions/SetEmployeePassword.php:37-49`, `SetEmployeePasswordRequest.php:43`, `set-password-dialog.tsx:197-210` | **Diperbaiki** `c81f372` |
| R-02 | Sedang | Webhook LiveKit menandai id kejadian "sudah diproses" **sebelum** diproses; bila gagal, percobaan ulang LiveKit dijawab `duplicate` → baris kehadiran terbuka selamanya | `app/Http/Controllers/Meetings/LiveKitWebhookController.php:58-64` | **Diperbaiki** `a744384` |
| R-03 | Sedang | Token browser penyelenggara membawa grant `roomAdmin` → bisa memanggil Room Service API LiveKit langsung (keluarkan, ganti nama/izin peserta lain, bisukan, kirim data) tanpa Policy & audit | `app/Domain/Meetings/Actions/IssueVideoToken.php:45-47` | **Diperbaiki** `9f6d292` |
| R-04 | Sedang | "Keluarkan peserta" tidak efektif: orang yang dikeluarkan langsung minta token baru dan masuk lagi (tidak ada daftar larangan) | `RemoveVideoParticipant.php:14-16,32`, `MeetingPolicy::joinVideo` | Rekomendasi (agen rapatbe) + keputusan pemilik |
| R-05 | Sedang | `canUpdateOwnMetadata` mengizinkan peserta mengganti **nama tampilan** & metadata sendiri (`setName`, `setMetadata`) → menyamar ("Direktur Utama") di chat, daftar peserta, dan — di notulen otomatis — **nama pembicara transkrip** | `IssueVideoToken.php:42`, `room-panels.tsx:146-150,209`, `room-stage.tsx:66`, `transcriber/notulen/recorder.py:132-137` | Rekomendasi (agen rapatui, notulen, rapatbe) |
| R-06 | Sedang | HR bisa mengatur sandi akun **Direksi/HR lain** (mode "Ketik sendiri", tanpa wajib ganti) lalu masuk sebagai mereka; padahal hanya Super Admin yang boleh memberi peran direksi/hr | `app/Policies/UserPolicy.php:112-115` | Keputusan pemilik |
| R-07 | Rendah | Badan JSON besar didekode middleware global (`TrimStrings` → `$request->json()`) **sebelum** batas 64 KB di webhook; batas efektif = `post_max_size`/Caddy 110 MB untuk semua endpoint tanpa autentikasi | `LiveKitWebhookController.php:35-39`, `bootstrap/app.php:41`, `docker/caddy/Caddyfile:20-23` | Rekomendasi (ops) |
| R-08 | Rendah | Bisukan peserta tidak diaudit (keluarkan diaudit) | `MuteVideoParticipant.php:29` | Rekomendasi (rapatbe) |
| R-09 | Rendah | Sesi video tetap hidup setelah rapat dibatalkan / akun dinonaktifkan / jendela gabung tutup (LiveKit memperbarui token selama tersambung) | `IssueVideoToken`, `CancelMeeting`, `DeactivateEmployee` | Rekomendasi (rapatbe): `DeleteRoom`/`RemoveParticipant` saat batal/nonaktif |
| R-10 | Rendah | Orang yang masuk dengan sandi bawaan (belum ganti) masih bisa membaca `inbox.feed` (judul notifikasi korban) tanpa jejak selain login | `EnsurePasswordChanged.php:44` | Rekomendasi |
| R-11 | Rendah | Membuka nilai sandi bawaan (`GET …/kata-sandi/bawaan`) tidak diaudit | `EmployeePasswordController.php:42-50` | Rekomendasi |
| R-12 | Rendah | Balapan `participant_joined` + `participant_left` bersamaan untuk SID yang sama → `UniqueConstraintViolation` (500). Setelah R-02, percobaan ulang LiveKit memulihkannya | `RecordVideoEvent.php:72-80` | Mitigasi lewat R-02; rekomendasi `createOrFirst` |
| R-13 | Info | `room_finished` mencari `meeting_attendances.room` tanpa indeks (Seq Scan) | `RecordVideoEvent.php:98` | Rekomendasi (lihat §4) |
| R-14 | Info | `Permissions-Policy` `microphone=(self), display-capture=(self)` berlaku di **semua** halaman, bukan hanya `/rapat/*/gabung|ruang` | `config/security.php:111` | Diterima / opsional |
| R-15 | Info | Token admin server memakai `roomList` (tidak terikat ruang) padahal hanya butuh `roomAdmin` | `LiveKitTokens.php:72` | Rekomendasi |
| R-16 | Info | `docker/caddy/site.caddy.template` (edge bersama) tidak punya rute landing `/` seperti `docker/caddy/Caddyfile`, padahal komentarnya "keep them in sync"; landing statis tanpa CSP | `docker/caddy/site.caddy.template`, `docker/caddy/Caddyfile:54-61` | Rekomendasi (ops) |
| R-17 | Info | IP publik server rapat tercantum di `docs/deploy/RAPAT-VIDEO.md:22` (repo publik) | dok | Diterima (sudah terungkap lewat DNS) |
| R-18 | Info | Risiko bawaan fitur sandi bawaan: akun yang belum pernah login bisa diambil alih rekan yang tahu sandi bawaan (login → ganti sandi → pemilik terkunci) | desain PR #11 | Diterima pemilik; saran: kedaluwarsa sandi bawaan (mis. 7 hari) + notifikasi email saat sandi bawaan diganti |

Tidak ada temuan **Kritis**. Satu-satunya temuan **Tinggi** (R-01) sudah diperbaiki.

Hal yang diperiksa dan **aman**: verifikasi webhook (JWT HS256 dengan `Key` → tidak ada kebingungan algoritme, `iss` dicek, klaim `sha256` mengikat badan, `hash_equals`, toleransi waktu, dedup id); nama ruang `rk-{ulid}-{yyyymmdd}` divalidasi regex + `checkdate`, tanggal kemunculan seri divalidasi `meetsOn`; matriks `MeetingPolicy` (perusahaan lain/bukan undangan 404, rapat batal 403, pengamat rapat pimpinan tidak bisa gabung, organizer kapan saja); token 10 menit, identitas = ULID pengguna; `Cache-Control: no-store` untuk token dan nilai sandi bawaan; `DefaultPassword::matches` `hash_equals`; `NotDefaultPassword` di semua jalur penggantian sandi; `EnsurePasswordChanged` memblokir rute JSON (403) termasuk token video & `/broadcasting/auth`; React meng-escape nama/chat (tidak ada `dangerouslySetInnerHTML` di modul rapat); CSP `connect-src` hanya origin LiveKit dari konfigurasi; skrip PITR/deploy tidak mencetak rahasia.

## 2. Rincian, skenario, bukti, perbaikan

### R-01 (Tinggi) — Sandi bawaan tanpa "wajib ganti" — **Diperbaiki**
- **Skenario:** HR membuka Atur kata sandi, memilih "Sandi bawaan", menghapus centang "Wajib ganti…" (teksnya hanya "Disarankan"). Server menerima `{"mode":"default","must_change":false}` → `password` = hash sandi bawaan, `password_change_required=false`. Siapa pun yang tahu `EMPLOYEE_DEFAULT_PASSWORD` (semua karyawan) bisa masuk sebagai orang itu kapan saja, termasuk Kepala Divisi (menyetujui pengajuan) — bertentangan dengan `docs/CRITICAL.md` §3 ("wajib ganti saat login pertama").
- **Bukti:** `tests/Feature/Audit/DefaultPasswordAuditTest.php` — sebelum perbaikan test `always requires a change … even with must_change off` dan `forces the change when someone signs in with the default password but the flag is missing` **merah**.
- **Perbaikan (`c81f372`):** `SetEmployeePassword` memaksa `$mustChange = $mustChange || $toDefault` (audit mencatat `must_change: true`); dialog mengunci centang untuk mode "Sandi bawaan" dengan penjelasan; jaring pengaman di `AuthenticateEmployee`: login sukses dengan sandi bawaan (bukan Super Admin) selalu menyalakan `password_change_required` → akun lama yang terlanjur tanpa flag ikut tertangkap. Mode "Ketik sendiri" tetap boleh tanpa wajib ganti.

### R-02 (Sedang) — Dedup webhook sebelum diproses — **Diperbaiki**
- **Skenario:** `Cache::add('livekit:webhook:<id>')` dijalankan sebelum `RecordVideoEvent::handle`. Galat DB sesaat atau balapan R-12 → 500 → LiveKit mengirim ulang (klien HTTP notifier LiveKit memakai retry) → jawaban `duplicate` → `participant_left` hilang → peserta tampil "masih di ruang", durasi terus bertambah, isian kehadiran notulen salah.
- **Bukti:** `tests/Feature/Audit/LiveKitWebhookAuditTest.php` (galat pertama disimulasikan lewat event `creating`): sebelum perbaikan pengiriman ulang menjawab `duplicate`.
- **Perbaikan (`a744384`):** kunci cache dilepas (`Cache::forget`) bila pemrosesan melempar exception, lalu exception diteruskan; kejadian yang sudah sukses tetap `duplicate`.

### R-03 (Sedang) — `roomAdmin` di token browser — **Diperbaiki**
- **Skenario:** penyelenggara (siapa pun bisa membuat rapat) mengambil token dari `POST …/video/token` (atau token yang diperbarui LiveKit selama tersambung) lalu memanggil `POST {LIVEKIT_URL}/twirp/livekit.RoomService/UpdateParticipant` untuk mengganti nama/izin peserta lain, `RemoveParticipant` tanpa audit `meeting.video_participant_removed`, `SendData` sebagai server, `UpdateRoomMetadata`. UI tidak memakai grant ini sama sekali (moderasi lewat `videoApi` → server).
- **Bukti:** test lama `gives the organizer roomAdmin` di `MeetingVideoTest.php` menegaskan klaim `video.roomAdmin = true` pada token penyelenggara.
- **Perbaikan (`9f6d292`):** grant dihapus; penanda penyelenggara tetap di `metadata.organizer`; test diubah menjadi "tanpa roomAdmin". Moderasi tetap jalan (token admin 60 detik hanya di server). **Catatan dok:** `docs/fitur/rapat-kalender.md:143` masih menyebut "roomAdmin untuk penyelenggara" — perlu diperbarui agen dok.

### R-04 (Sedang) — Peserta yang dikeluarkan langsung masuk lagi — Rekomendasi
- **Langkah:** penyelenggara `DELETE /rapat/{id}/video/peserta/{identitas}` (200, diaudit) → orang itu klik "Coba lagi" → `POST /rapat/{id}/video/token` → 200 → kembali di ruang. Komentar kode sudah mengakui "no ban list yet".
- **Saran (agen rapatbe, perlu keputusan pemilik soal "izinkan lagi"):** `RemoveVideoParticipant` menyimpan larangan per kemunculan (`Cache::put("video:removed:{room}:{user}", true, closesAt)` atau tabel kecil), `MeetingPolicy::joinVideo` menolak dengan pesan "Penyelenggara mengeluarkan Anda dari rapat ini.", tombol "Izinkan masuk lagi" untuk penyelenggara; test: remove → token 403.

### R-05 (Sedang) — Ganti nama sendiri lewat `canUpdateOwnMetadata` — Rekomendasi
- **Langkah:** di ruang, konsol browser: `room.localParticipant.setName('Direktur Utama')` (SDK `LocalParticipant.setName` — "requires `canUpdateOwnMetadata`"). Nama baru muncul di chat (`message.from.name`), daftar peserta, ubin video; `setMetadata('{"avatar_url":"…","organizer":true}')` mengganti avatar. Identitas (ULID) tidak berubah, jadi kehadiran & Policy aman.
- **Dampak di notulen otomatis:** worker menyimpan `participant.name` sebagai `speaker_name` → baris transkrip, "Waktu bicara", draf AI, dan usulan tindak lanjut bisa diatribusikan ke nama palsu.
- **Saran:** (a) **rapatui**: tampilkan nama/avatar dari prop server `people` berdasarkan `participant.identity`; `participant.name` hanya cadangan untuk identitas tak dikenal. (b) **notulen**: aplikasi memetakan `speaker_identity` → `users.name` dan mengabaikan `speaker_name` dari worker bila `user_id` dikenal. (c) **rapatbe** (opsional): angkat tangan & opt-out lewat data message/endpoint lalu cabut `canUpdateOwnMetadata`.

### R-06 (Sedang) — HR mengambil alih akun Direksi/HR — Keputusan pemilik
- **Bukti (PoC Pest, tidak di-commit):** `Gate::forUser($hr)->allows('setPassword', $direksi)` = `true`; HR `POST admin/karyawan/{direksi}/kata-sandi` mode manual `must_change=false` → logout → login sebagai Direksi **berhasil**. Ada jejak (audit `user.password_set_by_hr`, email ke korban, semua sesi korban keluar), tetapi HR memperoleh izin Direksi (`dashboard.view_company`, rapat pimpinan) padahal `RoleChangeGuard` melarang HR memberi peran direksi/hr.
- **Saran:** `UserPolicy::setPassword` mensyaratkan Super Admin bila target memegang peran yang `onlySuperAdminAssigns()` (super_admin, direksi, hr); HR tetap bisa menyetujui "Lupa kata sandi" mereka (pemilik akun sendiri yang mengetik sandi baru).

### R-07 (Rendah) — Badan besar sebelum batas 64 KB — Rekomendasi
Middleware global `TrimStrings` memanggil `$request->json()` untuk `Content-Type` `*/json`/`+json` sebelum controller, sehingga badan hingga ±100 MB didekode untuk request tanpa autentikasi (600/menit/IP di webhook; juga `/login`, webhook Hiring). Saran ops: batas per jalur di Caddy (`request_body /api/* { max_size 1MB }` kecuali unggahan) dan/atau middleware awal yang menolak `Content-Length` > N untuk rute API.

### R-08 … R-18
- **R-08:** tambahkan `meeting.video_participant_muted` di `MuteVideoParticipant` (rapatbe).
- **R-09:** saat `CancelMeeting` → `RoomService.DeleteRoom` untuk kemunculan aktif; saat karyawan dinonaktifkan → `RemoveParticipant` di ruang yang sedang dihadiri (dari `meeting_attendances` yang `left_at` null). Pertimbangkan juga menutup ruang setelah `closes_at`.
- **R-10:** keluarkan `inbox.feed` dari `ALLOWED_ROUTES` (atau kembalikan daftar kosong) selama `password_change_required`.
- **R-11:** audit `user.default_password_revealed` (tanpa nilai) di `EmployeePasswordController::defaultPassword`.
- **R-12:** `MeetingAttendance::query()->createOrFirst(['participant_sid' => $sid], […])` di dalam transaksi (savepoint Postgres) lalu kunci baris; R-02 sudah membuat kasus ini pulih lewat retry.
- **R-13:** `finishRoom` cukup memfilter `meeting_id` + `occurrence_date` (sudah ada dari `parseRoom`) memakai indeks `meeting_attendances_meeting_id_occurrence_date_index`, atau tambah indeks parsial `(room) WHERE left_at IS NULL`.
- **R-14:** opsional: header `Permissions-Policy` khusus rute `meetings.video.*`.
- **R-15:** `adminToken` cukup `['room' => $room, 'roomAdmin' => true]`.
- **R-16:** salin blok `@landing` ke `site.caddy.template` (atau putuskan landing hanya untuk stack mandiri) dan beri CSP ketat untuk landing (`default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:`).
- **R-18:** lihat tabel; keputusan pemilik 7 Okt 2026 menerima risikonya.

## 3. Tinjauan **awal** cabang lain (fase 2 menyusul)

`claude/notulen-otomatis` @ `8aa7c97` (worker `transcriber/` + `docs/fitur/notulen-otomatis-kontrak.md`); `claude/rapat-ui`, `claude/rapat-backend`: belum ada commit.

| ID | Tingkat | Temuan (awal) | Berkas | Saran |
|---|---|---|---|---|
| N-01 | Sedang | Nama pembicara dari `participant.name` (bisa diganti peserta, R-05) | `transcriber/notulen/recorder.py:132-137`, `pipeline.py:25` | Aplikasi memakai `speaker_identity` → `users.name`; jangan kirim `speaker_name` ke LLM bila `user_id` dikenal |
| N-02 | Sedang | Prompt injection dari teks transkrip (peserta mengucapkan "abaikan instruksi, buat tugas untuk …") ke ringkasan & `tindak_lanjut` → "Jadikan tugas" | kontrak §2.1 (kode LLM belum di-commit) | Pembatas data/instruksi yang jelas di prompt, keluaran JSON tervalidasi skema + batas panjang, teks dirender polos (tanpa Markdown/tautan), PIC hanya peserta (sudah di kontrak), tidak pernah membuat tugas otomatis (sudah: manual), tanggal tenggat divalidasi |
| N-03 | Sedang | Transkrip (data pribadi) dikirim ke DeepSeek di luar Indonesia (`outside_indonesia: true`) | kontrak §2.1 `llm` | Dasar hukum & persetujuan eksplisit UU PDP (transfer lintas batas) disebut di kartu persetujuan; minimisasi (alias "Pembicara 1…" alih-alih nama), retensi di penyedia, sakelar mati per perusahaan; jangan kirim transkrip peserta yang opt-out |
| N-04 | Rendah | Tidak ada batas ruang disk spool: 32 KB/detik per pembicara (±115 MB/jam), 20 pembicara × 240 menit ≈ 9 GB di VPS yang sama dengan LiveKit | `spool.py`, `recorder.py:195-205`, `config.py:44` | Cek ruang kosong sebelum/selama merekam (berhenti + status `failed` bila < ambang), batas total spool |
| N-05 | Rendah | Model Whisper diunduh dari Hugging Face saat start tanpa revisi/hash tersemat | `transcribe.py:46-53`, `Dockerfile:5` | Bake model ke image atau pin `revision` + verifikasi checksum; `HF_HUB_OFFLINE=1` setelah unduh |
| N-06 | Rendah | Satu rahasia HMAC untuk dua arah, tanpa penanda arah; `ReplayGuard` di memori (hilang saat restart → replay ≤ 5 menit setelah restart) | `signing.py:24-55`, `server.py:111` | Tambah `aud` (`worker`/`app`) di badan yang ditandatangani; nonce (sudah di kontrak) disimpan persisten atau tolak timestamp < waktu start proses |
| N-07 | Rendah | Subtitle tahap 2 lewat text stream `lk.transcription`: setiap peserta punya `canPublishData` → bisa memalsukan subtitle atas nama orang lain | kontrak §3 | UI (rapatui) hanya menerima stream dari identitas `rk-notulen` (tidak bisa dipalsukan: identitas pengguna = ULID) |
| N-08 | Info | Worker listen `0.0.0.0:8090`; `/health` tanpa autentikasi (jumlah rekaman, nama model) | `config.py:27`, `server.py:67` | Publikasikan port hanya ke `127.0.0.1`/jaringan privat; firewall |
| N-09 | Info | Webhook kehadiran perlu mengabaikan identitas `rk-notulen`; webhook kedua `/api/notulen/livekit` perlu pola anti-replay yang sama **dan** perbaikan R-02 | kontrak §3, §5 | rapatbe/notulen |

Yang sudah baik di worker: path spool aman (nama ruang divalidasi regex, sesi `uuid4`, nama berkas tanpa identitas, folder sesi 0700), audio dihapus segera setelah transkripsi dan sisa dibersihkan 24 jam, token LiveKit tidak di-log, `Settings.__repr__` menyamarkan rahasia, URL LiveKit dari konfigurasi (bukan dari request → tidak ada SSRF), batas badan 64 KB dicek sebelum dibaca, `hmac.compare_digest`, opt-out mencegah langganan audio sama sekali, TLS ke aplikasi diverifikasi.

## 4. Efisiensi (diukur)

Lingkungan: Mac dev, Postgres 17 lokal, Pest (`RefreshDatabase`), waktu = satu request di test (indikatif).

| Halaman / query | Ukuran data | Query | Waktu |
|---|---|---|---|
| `GET /rapat/{id}` (detail video) | 3 → 30 peserta (+30 baris kehadiran) | **22 → 22** | 22 → 33 ms |
| `GET /rapat/{id}/gabung` | 3 → 30 peserta | 22 → 22 | 23 → 35 ms |
| `GET /rapat/{id}/ruang` | 3 → 30 peserta | 22 → 22 | 22 → 31 ms |
| Polling detail `only: ['video']` tiap 30 dtk | 3 → 30 | **9** → 9 | 12 → 17 ms |
| `GET /rapat`, `/kalender`, `/kalender?tampilan=bulan` | 3 → 40 rapat | 20 → 20 | 36–67 ms |
| `GET /manajemen/jadwal` | 3 → 40 rapat | 19 → 19 | 37 ms |

- **Tidak ada N+1** di halaman rapat (jumlah query konstan).
- **Polling detail:** prop `detail` di `MeetingController::show` (`:93-103`) dihitung **eager**, jadi setiap partial reload `only: ['video']` tetap memuat peserta, notulen, dan `people` lalu membuangnya: ±5 dari 9 query terbuang. Saran (rapatbe): bungkus `detail` dalam closure (`fn () => [...]`) seperti `video`.
- **EXPLAIN (dev DB):** kehadiran per kemunculan → *Index Scan* `meeting_attendances_meeting_id_occurrence_date_index` (0,05 ms; cast `::date` dari `whereDate` tidak menghalangi indeks); notulen → *Index Scan* unik; `room_finished` (`where room = ? and left_at is null`) → **Seq Scan** (R-13).
- **Bundle (vite build, `public/build/manifest.json`):** chunk LiveKit (`prefabs-*.js`, livekit-client + components) **567 KB mentah / 149 KB gzip / 122 KB brotli**, dimuat hanya oleh `meetings/join` dan `meetings/room` (sudah terpisah per halaman). Total JS statis halaman: ruang 1.346 KB (44 chunk), pra-gabung 1.309 KB (37), detail rapat 772 KB (42, **tanpa** LiveKit). Chunk `room-*.js` 47 KB / 16 KB gzip. Memuat SDK di pra-gabung justru memanaskan cache untuk ruang; tidak perlu diubah.
- **Render ulang ruang (analisis kode, untuk UI arah C):** `useClock()` (interval 15 dtk) dan `useParticipants()` dipanggil di komponen akar `room.tsx:332,340` → seluruh pohon (ubin video, panel) dirender ulang tiap 15 detik dan pada setiap event peserta (bicara, kualitas koneksi, atribut). Saran rapatui: jam di komponen daun sendiri, `useParticipants({ updateOnlyOn: [...] })`, `memo` untuk ubin, daftar "Waktu bicara" dihitung dari event `ActiveSpeakersChanged` dengan throttle.
- **Polling lain:** kartu gabung detail rapat 30 dtk hanya saat jendela terbuka (baik); `meetings-context` menyegarkan `now` per interval (tanpa request).

## 5. Commit di cabang ini

| Commit | Isi | Test regresi |
|---|---|---|
| `c81f372` | fix(akun): sandi bawaan selalu wajib ganti (R-01) | `tests/Feature/Audit/DefaultPasswordAuditTest.php` (4) |
| `a744384` | fix(rapat): webhook LiveKit yang gagal diproses tidak dianggap duplikat (R-02) | `tests/Feature/Audit/LiveKitWebhookAuditTest.php` (1) |
| `9f6d292` | fix(rapat): token browser penyelenggara tanpa roomAdmin (R-03) | `tests/Feature/Meetings/MeetingVideoTest.php` (test diubah) |

Berkas milik agen lain yang tersentuh (perubahan keamanan minimal): `app/Http/Controllers/Meetings/LiveKitWebhookController.php`, `app/Domain/Meetings/Actions/IssueVideoToken.php`, `tests/Feature/Meetings/MeetingVideoTest.php` (rapatbe).

## 6. Butuh dari agen lain / pemilik

- **rapatbe:** R-04 (larangan masuk lagi), R-08, R-09, R-12, R-13, polling `detail` lazy (§4), abaikan `rk-notulen` di `RecordVideoEvent` (N-09), terapkan pola R-02 di webhook notulen.
- **rapatui:** R-05 (nama/avatar dari `people` per identitas), N-07 (subtitle hanya dari `rk-notulen`), render ulang ruang (§4).
- **notulen:** N-01 … N-06, N-08.
- **dok:** `docs/fitur/rapat-kalender.md:143` (hapus "roomAdmin untuk penyelenggara"), rujukan audit ini di `docs/security/ASVS-L1.md` + changelog.
- **Pemilik:** R-06 (HR vs akun Direksi/HR), R-04 (perilaku "izinkan lagi"), R-18 (kedaluwarsa sandi bawaan), N-03 (DeepSeek & UU PDP).
- **Ops/integrator:** R-07 (batas badan per jalur), R-16 (landing di edge bersama).
