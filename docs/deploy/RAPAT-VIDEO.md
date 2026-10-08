# Rapat video (Video RuangKerja): operasional

Panduan operasional untuk **rapat video bawaan RuangKerja**, **notulen otomatis** (transkrip setelah rapat + draf notulen dari AI), dan rencana **subtitle langsung** (tahap 2, GPU). Untuk admin server dan pengembang. Panduan pemakai: [`docs/fitur/rapat-video.md`](../fitur/rapat-video.md); privasi & UU PDP: [`docs/fitur/rapat-video-privasi.md`](../fitur/rapat-video-privasi.md); fitur & kode: [`docs/fitur/rapat-kalender.md`](../fitur/rapat-kalender.md) §6a.

> **Status 8 Okt 2026.** Kode **selesai** di branch `claude/dok-rapat` (gabungan `claude/rapat-ui`, `claude/rapat-backend`, `claude/notulen-otomatis`, audit): ruang arah C "Notulen Hidup", notulen otomatis (worker `transcriber/`, transkrip, draf AI, retensi), kontrak `docs/fitur/rapat-video-kontrak.md` dan `docs/fitur/notulen-otomatis-kontrak.md`, audit `docs/security/AUDIT-RAPAT-2026-10.md`. **Sudah di server:** LiveKit di VPS rapat (§1–§6). **Belum di server:** worker transkripsi (§7.5) dan webhook kedua (§3). **Rencana:** subtitle langsung di server GPU (§10).

```
                    ┌─────────────────────────── VPS aplikasi (spkd.store) ───────────────────────────┐
Browser ──HTTPS──▶  │ RuangKerja (Laravel)                                                              │
   │                │  · POST /rapat/{id}/video/token        → token JWT LiveKit                        │
   │                │  · POST /api/livekit/webhook            ← kehadiran (bertanda tangan JWT)          │
   │                │  · POST /api/notulen/livekit            ← mulai/selesai rekam notulen (JWT)        │
   │                │  · POST /api/notulen/transcript         ← status + transkrip (HMAC)               │
   │                │  · ringkasan → penyedia LLM (DeepSeek bawaan, bisa diganti) ── HTTPS ──▶ luar     │
   │                └───────────────────────▲──────────────────────────┬────────────────────────────────┘
   │ WSS (sinyal)                          │ webhook / transkrip      │ minta worker bergabung (HMAC)
   ▼                                       │                          ▼
livekit.spkd.store ── VPS rapat 103.125.181.244: Caddy (443, TLS otomatis) → LiveKit :7880
   ▲                                     └─ worker transkripsi "rk-notulen" (127.0.0.1:8090 ← notulen.spkd.store)
   │ media WebRTC: UDP 50000–60000 (utama) · TCP 7881 · TURN/UDP 3478 + relay 30000–40000 · TURN/TLS turn.spkd.store:443 (cadangan)
```

## 1. Kebutuhan & server terpasang

| Hal | Nilai |
|---|---|
| VPS | Minimal 4 vCPU **eksklusif**, 8 GB RAM, 40 GB SSD, IPv4 statis, port 1 Gbps tanpa kuota trafik (rapat 20 orang 720p ±60 Mbps keluar). Rekaman video (Egress) **tidak** dipasang. Worker transkripsi butuh tambahan CPU & RAM (§7.5). |
| DNS | `livekit.spkd.store` (sinyal/WSS) dan `turn.spkd.store` (TURN/TLS) → A record ke IP VPS rapat. Pasang **sebelum** menjalankan server agar Caddy mendapat sertifikat. |
| Firewall (Security Group Biznet + `ufw`) | masuk **80/tcp** (ACME), **443/tcp** (WSS + TURN/TLS), **7881/tcp** (WebRTC lewat TCP), **3478/udp** (TURN/UDP), **50000–60000/udp** (media), **30000–40000/udp** (relay TURN; tanpa ini peserta yang memakai TURN tidak mendapat media). Port 7880 dan 8090 **tidak** dibuka ke internet (hanya Caddy/lokal). SSH dibatasi ke IP admin. |
| Jam | NTP aktif di kedua VPS (`timedatectl` → `System clock synchronized: yes`). Webhook LiveKit dan kiriman worker ditolak bila selisih jam > 5 menit. |

**Terpasang 7 Okt 2026** di server rapat **`103.125.181.244`** (Ubuntu 24.04, 8 vCPU, 15 GB RAM):

| Bagian | Isi |
|---|---|
| Folder | `/opt/livekit`: `caddy.yaml`, `livekit.yaml`, `docker-compose.yaml` |
| Layanan | unit systemd **`livekit-docker`** (menjalankan `docker compose` di `/opt/livekit`, start otomatis saat boot) |
| Kontainer | Caddy (lapisan 4: TLS untuk `livekit.spkd.store`, SNI `turn.spkd.store:443` → TURN/TLS) + LiveKit **1.13.8**. **Tanpa Redis** (satu node; generator menawarkan Redis, tidak dipakai) |
| Kernel | `net.core.rmem_max` / `wmem_max` = `16777216` |
| Uji | `lk load-test` dari Mac (1 publisher, 2 subscriber, 20 detik): 1,2 Mbps per subscriber, packet loss 0% |

## 2. Pasang LiveKit (sekali)

Di VPS rapat (Ubuntu), sebagai pengguna ber-sudo:

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh

# Buat konfigurasi dengan generator resmi
mkdir -p ~/livekit-gen && cd ~/livekit-gen
docker run --rm -it -v$PWD:/output livekit/generate
```

Jawaban generator:

- **LiveKit Server only** (tanpa Egress, tanpa Ingress).
- Domain utama: `livekit.spkd.store`; domain TURN: `turn.spkd.store`.
- SSL: Let's Encrypt (Caddy), dengan email admin.
- Redis: tidak perlu untuk satu node.
- Cara pasang: **VM / startup script** (bukan Kubernetes).

Generator mencetak **API key** dan **API secret**: simpan di pengelola sandi; keduanya dipakai aplikasi (§4) dan tidak boleh di-commit. Ia juga membuat folder `livekit.spkd.store/` berisi `init_script.sh` dan berkas konfigurasi. Jalankan skrip pemasangnya:

```bash
cd livekit.spkd.store
sudo bash init_script.sh
```

Hasilnya folder `/opt/livekit` + unit `livekit-docker` (§1). Cek:

```bash
sudo systemctl status livekit-docker
sudo docker ps                       # caddy, livekit
curl -s https://livekit.spkd.store   # → OK
```

Isi `livekit.yaml` dari generator sudah tepat untuk produksi dan **tidak perlu diubah** kecuali menambah webhook (§3): `rtc.use_external_ip: true` (alamat publik diumumkan ke peserta), `rtc.port_range_start/end: 50000/60000`, `rtc.tcp_port: 7881`, `turn.enabled: true` dengan `domain: turn.spkd.store`, `tls_port: 5349` (Caddy meneruskan `turn.spkd.store:443` ke sana lewat SNI, sehingga jaringan kantor/4G yang memblokir UDP tetap bisa masuk lewat 443), `udp_port: 3478`, relay TURN 30000–40000, dan `keys:` berisi pasangan kunci tadi.

## 3. Webhook kehadiran ke RuangKerja

Tambahkan blok ini di **`/opt/livekit/livekit.yaml`** (tingkat atas, sejajar `keys:`). `api_key` = **kunci yang sama** dengan `LIVEKIT_API_KEY` aplikasi: LiveKit menandatangani webhook dengan rahasia pasangannya, dan RuangKerja menolak webhook yang `iss`-nya bukan `LIVEKIT_API_KEY` atau tanda tangannya tidak cocok dengan `LIVEKIT_API_SECRET`.

```yaml
webhook:
  api_key: <API_KEY>
  urls:
    - https://spkd.store/api/livekit/webhook   # kehadiran (main)
    - https://spkd.store/api/notulen/livekit   # notulen otomatis (tambahkan saat fitur dirilis)
```

LiveKit mengirim **semua** kejadian ke setiap URL; masing-masing endpoint memilih yang dibutuhkannya.

```bash
sudo systemctl restart livekit-docker   # memutus rapat yang sedang berjalan: lakukan di luar jam rapat
sudo docker logs -f livekit-livekit-1 2>&1 | grep -i webhook   # nama kontainer: lihat `docker ps`
```

Yang dicatat aplikasi: `participant_joined` / `participant_left` / `room_finished` → tabel `meeting_attendances` (detail rapat "N orang di ruang rapat", panel **Hadir di rapat video**, isian awal kehadiran notulen). `room_started` dan kejadian lain dijawab `200 {"status":"ignored"}`. Rute ini **tanpa sesi/CSRF**; keamanannya dari tanda tangan JWT (`Authorization`, klaim `sha256` = hash badan), umur token 5 menit, penolakan kejadian lebih tua dari 5 menit, dan id kejadian yang hanya diproses sekali. Batas laju 600/menit per IP.

Jawaban endpoint: `200` tercatat/diabaikan/duplikat · `401` tanda tangan salah (kunci/rahasia tidak cocok) · `404` aplikasi belum diisi `LIVEKIT_*` atau `FEATURE_MEETINGS=false` · `413` badan terlalu besar · `422` bukan JSON atau kejadian kedaluwarsa (cek jam).

**Webhook kedua `/api/notulen/livekit`** (verifikasi JWT yang sama): `participant_joined` seseorang (bukan `rk-notulen`) di ruang rapat ber-`auto_minutes` → job `StartMeetingRecorder` (maks. sekali per menit per ruang) meminta worker bergabung; `room_finished` → job `FinishMeetingRecorder` meminta worker berhenti dan mentranskrip. Rapat tanpa notulen otomatis, dibatalkan, atau server notulen belum diatur → `ignored`. Worker yang tersembunyi tetap memicu `participant_joined` di webhook kehadiran (baris `meeting_attendances` dengan `user_id` null, tidak dihitung).

## 4. Konfigurasi aplikasi (VPS aplikasi)

Di `.env` produksi RuangKerja (`.env.production.example` berisi kunci kosong):

```dotenv
FEATURE_MEETINGS=true
LIVEKIT_URL=wss://livekit.spkd.store
LIVEKIT_API_URL=https://livekit.spkd.store
LIVEKIT_API_KEY=<API_KEY dari generator>
LIVEKIT_API_SECRET=<API_SECRET dari generator>
# Opsional (bawaan): LIVEKIT_TOKEN_TTL=600, LIVEKIT_JOIN_BEFORE_MINUTES=15, LIVEKIT_JOIN_AFTER_MINUTES=120, LIVEKIT_WEBHOOK_TOLERANCE=300
```

| Kunci | Bawaan | Arti (`config/livekit.php`) |
|---|---|---|
| `LIVEKIT_URL` | kosong | URL WebSocket untuk browser. Kosong (atau kunci/rahasia kosong) = pilihan "Video RuangKerja" disembunyikan, rapat video lama menampilkan catatan "belum disiapkan" |
| `LIVEKIT_API_URL` | dari `LIVEKIT_URL` (ws→http) | Room Service API untuk bisukan/keluarkan peserta, lewat Caddy di 443 |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | kosong | pasangan `keys:` di `livekit.yaml`; rahasia ≥ 32 karakter. Pasangan yang sama memverifikasi webhook |
| `LIVEKIT_TOKEN_TTL` | 600 | umur token akses (detik); server LiveKit memperbaruinya selama tersambung |
| `LIVEKIT_JOIN_BEFORE_MINUTES` / `_AFTER_MINUTES` | 15 / 120 | jendela gabung: 15 menit sebelum mulai s.d. 2 jam sesudah selesai (penyelenggara kapan saja) |
| `LIVEKIT_WEBHOOK_TOLERANCE` | 300 | umur maksimum webhook (detik) |

Lalu deploy ulang / `php artisan optimize` (konfigurasi di-cache). Tidak ada perubahan lain:

- CSP `connect-src` otomatis menambah `wss://livekit.spkd.store` dan `https://livekit.spkd.store` dari `LIVEKIT_URL`; `Permissions-Policy` sudah mengizinkan kamera, mikrofon & berbagi layar untuk situs sendiri.
- Kunci untuk notulen otomatis dan ringkasan AI: §7.3 dan §8. Subtitle tahap 2: `LIVEKIT_SUBTITLES` (`config/livekit.php`, bawaan `false`, §10).

## 5. Uji

1. **Server saja**: dari laptop admin (CLI `lk`: `curl -sSL https://get.livekit.io/cli | bash`):

   ```bash
   lk token create --api-key <API_KEY> --api-secret <API_SECRET> \
     --join --room uji-koneksi --identity admin-uji --valid-for 1h
   ```

   Buka **https://livekit.io/connection-test**, isi URL `wss://livekit.spkd.store` dan token tadi → semua centang hijau: WebSocket, WebRTC (UDP), **TURN/UDP**, **TURN/TLS** (`turn.spkd.store:443`), publish audio/video. Ulangi dari jaringan seluler 4G dan Wi-Fi kantor.
2. **Beban**: dari laptop admin, di luar jam rapat:

   ```bash
   lk load-test --url wss://livekit.spkd.store --api-key <API_KEY> --api-secret <API_SECRET> \
     --room uji-beban --video-publishers 1 --subscribers 2 --duration 20s
   ```

   Naikkan bertahap (mis. `--video-publishers 8 --subscribers 20 --duration 1m`) sambil memantau `docker stats` di VPS rapat (target CPU < 60%). Hasilnya: bitrate per subscriber dan packet loss (harus ±0%).
3. **Aplikasi**: login sebagai penyelenggara, **Jadwalkan rapat** → Tempat rapat **Video RuangKerja** (bawaan) → undang satu orang. Detail rapat → **Gabung rapat video** → izinkan kamera/mikrofon → masuk. Orang kedua bergabung dari perangkat lain (dalam jendela 15 menit sebelum mulai s.d. 2 jam sesudah selesai).
4. Detail rapat (orang ketiga atau tab lain) memperlihatkan "2 orang di ruang rapat" dalam ≤ 30 detik → **webhook jalan**. Bila tetap "Ruang rapat terbuka": runbook R1 (§12).
5. Moderasi: penyelenggara **Bisukan** peserta (mikrofonnya mati) → **Keluarkan** (peserta melihat "Penyelenggara mengeluarkan Anda dari rapat").
6. Berbagi layar dari Chrome desktop; chat; angkat tangan; putuskan Wi-Fi 10 detik → "Menyambungkan ulang…" lalu kembali.
7. **Notulen otomatis** (setelah worker terpasang, §7.5): nyalakan notulen otomatis di rapat uji → masuk ruang → log worker `recording room rk-…` → semua keluar → ±90 detik kemudian log worker `finishing rk-…` lalu `transcribed …` → halaman `/rapat/{id}/notulen-otomatis` berstatus Mentranskrip → Meringkas → Siap. Satu peserta menyalakan "Jangan transkrip suara saya" → kalimatnya tidak ada di transkrip.

Uji manual dua pengguna di lokal: `tests/e2e/rapat-video-two-users.mjs`.

## 6. Uji coba 1–2 minggu (catat)

Jeda suara (rasa), putus-sambung, CPU (`docker stats`, target < 60% untuk 20 orang), trafik keluar per jam (panel Biznet), kualitas di 4G, berapa peserta jatuh ke TURN/TLS (log LiveKit `turn`). Setelah worker transkripsi terpasang: lama transkripsi per jam rapat, CPU saat transkripsi berjalan bersamaan dengan rapat lain, dan keluhan kualitas transkrip.

## 7. Notulen otomatis: worker transkripsi (tahap 1, CPU)

Kode: `transcriber/` (Python 3.12). Satu proses, satu kontainer, dijalankan **di VPS rapat** di samping LiveKit. Langkah pasang lengkap, angka kapasitas yang sudah diukur, dan uji lokal ada di **`transcriber/DEPLOY.md`** (berkas `transcriber/deploy/compose.notulen.yaml`, `notulen.env.example`, `caddy-notulen.yaml`); bagian ini meringkasnya untuk admin.

### 7.1 Cara kerja

1. Orang pertama masuk ruang rapat ber-notulen-otomatis → webhook kedua (§3) → job `StartMeetingRecorder` (antrean `default`, 4 percobaan, jeda 5/15/45 detik) meminta worker bergabung ke ruang `rk-{meeting}-{yyyymmdd}` (`POST /rooms/{room}/join`, HMAC) dengan token LiveKit buatan aplikasi (`TRANSCRIBER_TOKEN_TTL`, bawaan 10 menit): identitas **`rk-notulen`**, tersembunyi, hanya berlangganan, plus daftar id karyawan yang menolak transkrip. Beberapa detik pertama sebelum worker masuk tidak terekam.
2. Worker hanya berlangganan **trek mikrofon** peserta manusia yang **tidak** menolak, jadi suara orang yang menolak tidak pernah sampai ke worker. Pilihan menolak bersifat **privat**: dikirim aplikasi ke worker (`POST /rooms/{room}/exclude`, job `RelayTranscriptConsent`), **tidak pernah** sebagai atribut LiveKit (yang terlihat semua klien). Menolak di tengah rapat → langganan berhenti dan audio orang itu yang sudah terekam **dihapus**. Audio berbagi layar tidak direkam.
3. Audio per pembicara ditulis ke spool (`TRANSCRIBER_SPOOL_DIR`, WAV 16 kHz mono 16-bit, berkas baru setelah jeda 2 detik atau tiap 10 menit, nama berkas tanpa identitas; batas `TRANSCRIBER_SPOOL_MAX_GB`, bawaan 20 GB: bila penuh worker menolak rekaman baru, menghentikan rekaman berjalan, dan menulis `ALERT spool full` di log). Rekaman berhenti saat `room_finished` (job `FinishMeetingRecorder`), saat ruang tanpa manusia selama `TRANSCRIBER_EMPTY_GRACE` detik (bawaan 90), atau setelah `TRANSCRIBER_MAX_MINUTES`.
4. Antrean transkripsi worker (bawaan satu sekaligus): faster-whisper `large-v3-turbo` (revisi + SHA-256 model dipatok), bahasa Indonesia, VAD, int8; frasa halusinasi umum Whisper dibuang; semua pembicara digabung menurut waktu. Pembicara dikenali dari trek LiveKit (tanpa diarisasi); **nama diambil aplikasi dari `users.name`**, identitas lain menjadi "Peserta tamu".
5. **Audio dihapus segera setelah transkripsi** (berhasil atau gagal). Transkrip dikirim ke `POST {TRANSCRIBER_APP_URL}/api/notulen/transcript` (HMAC dengan `TRANSCRIBER_CALLBACK_SECRET`, hingga 6 percobaan dengan jeda 2→60 detik). Bila aplikasi tidak menjawab, transkrip tertahan di spool dan **dihapus setelah `TRANSCRIBER_SPOOL_MAX_AGE_HOURS`** (24 jam). Worker restart di tengah rekaman: audio sesi itu dihapus dan aplikasi diberi status gagal.
6. Aplikasi menyimpan transkrip per kemunculan (`meeting_transcripts`, kiriman ulang idempoten), membuang kalimat orang yang menolak, lalu bila kunci LLM ada menandai `summarizing` dan menjalankan ringkasan (§8). Status: `recording` → `transcribing` → `summarizing` → `ready` | `failed`; status lama yang datang terlambat tidak menimpa keadaan akhir.

### 7.2 API worker

Worker hanya mendengar di **`127.0.0.1:8090`**; Caddy di VPS rapat menerbitkannya sebagai `https://notulen.spkd.store` (SNI, hanya dari IP VPS aplikasi, tetap port 443).

| Rute | Isi |
|---|---|
| `GET /health` | `{"status":"ok"}` (sengaja minimal: tanpa model, antrean, atau nama ruang). Dipakai `HEALTHCHECK` Docker |
| `POST /rooms/{room}/join` | `{"action":"join","room","token","exclude":[id…],"nonce"}` → `202 {"status":"joining"}` / `200 {"status":"already"}`; `502` gagal masuk ruang |
| `POST /rooms/{room}/exclude` | `{"action":"exclude","room","identity","excluded":true\|false,"nonce"}` → `200` |
| `POST /rooms/{room}/finish` | `{"action":"finish","room","nonce"}` → `202` atau `404 {"status":"unknown"}` (sudah keluar sendiri; dianggap wajar) |

Tanda tangan dengan **rahasia berbeda per arah**: header `X-Notulen-Timestamp: <unix detik>` dan `X-Notulen-Signature: v1=<hex HMAC-SHA256(rahasia, "<timestamp>.<badan mentah>")>`; aplikasi → worker memakai `TRANSCRIBER_SECRET`, worker → aplikasi `TRANSCRIBER_CALLBACK_SECRET`. Ditolak `401` bila selisih jam > 300 detik atau tanda tangan pernah dipakai (worker mencatatnya di `spool/.replay.sqlite`, tetap setelah restart; aplikasi di cache). Badan wajib menyebut `action` dan `room` yang sama dengan URL (`422`), maks. 64 KB di worker; transkrip ke aplikasi maks. `TRANSCRIBER_MAX_BODY` (5 MB). Jawaban `POST /api/notulen/transcript`: `200 {"status":"recorded"|"ignored"}` · `401` · `404` belum diatur · `413` · `422`.

### 7.3 Kunci lingkungan

**Worker** (`transcriber/notulen/config.py`, contoh `transcriber/deploy/notulen.env.example`; berkas `notulen.env` `chmod 600`, tidak di-commit):

| Kunci | Bawaan | Arti |
|---|---|---|
| `TRANSCRIBER_SECRET` | wajib, ≥ 32 karakter | aplikasi → worker; sama dengan aplikasi |
| `TRANSCRIBER_CALLBACK_SECRET` | wajib, ≥ 32 karakter, **berbeda** | worker → aplikasi; sama dengan aplikasi |
| `TRANSCRIBER_APP_URL` | wajib | `https://spkd.store` |
| `LIVEKIT_URL` | `ws://127.0.0.1:7880` | LiveKit dilihat dari worker |
| `TRANSCRIBER_HOST` / `TRANSCRIBER_PORT` | `127.0.0.1` / `8090` | alamat API |
| `TRANSCRIBER_SPOOL_DIR` / `TRANSCRIBER_SPOOL_MAX_GB` | `/var/spool/notulen` / `20` | audio sementara (izin 700, pengguna non-root) |
| `WHISPER_MODEL` | `large-v3-turbo` | model lain wajib `WHISPER_MODEL_REVISION` + `WHISPER_MODEL_SHA256` |
| `WHISPER_COMPUTE_TYPE` / `WHISPER_CPU_THREADS` / `WHISPER_BEAM_SIZE` / `WHISPER_LANGUAGE` | `int8` / `4` / `1` / `id` | |
| `WHISPER_MODEL_DIR` | `/models` | volume `notulen-models` (unduhan ±1,6 GB sekali) |
| `TRANSCRIBE_CONCURRENCY` | `1` | transkripsi bersamaan |
| `TRANSCRIBER_TOLERANCE`, `TRANSCRIBER_EMPTY_GRACE`, `TRANSCRIBER_MAX_MINUTES`, `TRANSCRIBER_MAX_SEGMENT_SECONDS`, `TRANSCRIBER_SPOOL_MAX_AGE_HOURS` | `300`, `90`, `240`, `600`, `24` | |
| `TRANSCRIBER_CA_FILE` | kosong | CA tambahan (lokal: CA Herd) |

**Aplikasi** (`config/notulen.php`, juga di `.env.example` dan `.env.production.example`). Fitur tersedia bila `TRANSCRIBER_URL` dan kedua rahasia terisi, rapat `video`, dan LiveKit diatur; selain itu sakelar notulen otomatis tidak muncul.

| Kunci | Bawaan | Arti |
|---|---|---|
| `TRANSCRIBER_URL` | kosong | `https://notulen.spkd.store` |
| `TRANSCRIBER_SECRET` / `TRANSCRIBER_CALLBACK_SECRET` | kosong | sama persis dengan worker |
| `TRANSCRIBER_TIMEOUT` | 10 | batas waktu panggilan ke worker (detik) |
| `TRANSCRIBER_TOLERANCE` / `TRANSCRIBER_MAX_BODY` / `TRANSCRIBER_TOKEN_TTL` | 300 / 5242880 / 600 | |
| `MINUTES_TRANSCRIPT_RETENTION_DAYS` | 90 | transkrip + draf + waktu bicara dihapus N hari setelah rapat (§9) |
| `REDIS_LONG_QUEUE_RETRY_AFTER` | 960 | `retry_after` koneksi antrean `redis-long` (§8.1) |

### 7.4 Pilihan model & kapasitas

| `WHISPER_MODEL` | Kapan |
|---|---|
| `large-v3-turbo` (bawaan) | kualitas terbaik yang masih wajar di CPU |
| `medium` / `small` | antrean menumpuk; lebih cepat, lebih banyak salah dengar |

Angka terukur (Mac M5 Max, sampel 74 detik, `transcriber/DEPLOY.md` §3): RTF 0,14 native, 0,30 di Docker dengan 4 CPU. **Belum diukur di server rapat**; perkiraan untuk `cpus: 4` RTF 0,6–1,0, jadi rapat 1 jam dengan ±40 menit total ucapan selesai ±25–40 menit setelah rapat. Biaya ≈ total waktu bicara (hening dilewati VAD). Ukur sebelum produksi dengan rekaman uji yang disetujui pembicaranya: `python -m notulen.bench contoh.wav --threads 4` (perintah lengkap di `DEPLOY.md`).

Batas yang sudah ada di `compose.notulen.yaml`: `cpus: 4`, RAM 6 GB, satu transkripsi sekaligus, agar LiveKit di mesin 8 vCPU tetap punya ruang. Jangan menaikkan `WHISPER_CPU_THREADS` melebihi `cpus`.

### 7.5 Pasang (ringkas)

Lengkapnya `transcriber/DEPLOY.md` §1–§2:

1. DNS `notulen.spkd.store` → IP VPS rapat.
2. Salin `transcriber/deploy/compose.notulen.yaml` dan `notulen.env` ke `/opt/livekit/`, `sudo docker compose -f compose.notulen.yaml --env-file notulen.env up -d` (`network_mode: host`, `restart: unless-stopped`, volume `notulen-models` dan `notulen-spool`).
3. Rute Caddy dari `transcriber/deploy/caddy-notulen.yaml` ke `/opt/livekit/caddy.yaml` (SNI `notulen.spkd.store` → `127.0.0.1:8090`, hanya IP VPS aplikasi), restart `livekit-docker` di luar jam rapat. Tidak ada port firewall baru.
4. URL webhook kedua di `livekit.yaml` (§3).
5. `.env` aplikasi (§7.3, §8), deploy, `php artisan horizon:terminate`.
6. Uji dari VPS aplikasi: `curl -s https://notulen.spkd.store/health` → `{"status":"ok"}`; log `sudo docker logs -f notulen-transcriber-1` (tidak pernah mencetak token, rahasia, atau isi transkrip).

## 8. Ringkasan AI (LLM)

Setelah transkrip diterima, job **`SummarizeMeetingTranscript`** membuat **draf notulen** lewat `MinutesSummarizer`: ringkasan, pembahasan per agenda, keputusan, usulan tindak lanjut, dan "perlu dicek", masing-masing dengan nomor baris sumber. Penyedia = **API chat completions kompatibel OpenAI** (`POST {base_url}/chat/completions`, `response_format: json_object`); bawaan **DeepSeek**, di luar Indonesia. Transkrip dikirim sebagai data kutipan di antara penanda dengan perintah mengabaikan instruksi di dalamnya; keluaran divalidasi ke skema ketat dan dijadikan teks polos; penanggung jawab hanya peserta yang berbicara dan tidak menolak; tidak ada yang menjadi tugas tanpa klik notulis.

| Kunci (`config/notulen.php` › `llm`) | Bawaan | Arti |
|---|---|---|
| `MINUTES_LLM_BASE_URL` | `https://api.deepseek.com` | URL dasar sampai sebelum `/chat/completions` |
| `MINUTES_LLM_API_KEY` | kosong | kosong = transkrip tetap disimpan, **draf tidak dibuat**, tidak ada yang dikirim ke luar |
| `MINUTES_LLM_MODEL` | `deepseek-chat` | |
| `MINUTES_LLM_PROVIDER` / `MINUTES_LLM_OUTSIDE_INDONESIA` | `DeepSeek` / `true` | nama dan tanda "di luar Indonesia" yang **tampil di pemberitahuan** pra-gabung dan detail rapat |
| `MINUTES_LLM_TIMEOUT` / `MINUTES_LLM_RETRIES` | 120 / 2 | per permintaan; ulang untuk koneksi gagal, `429`, `5xx` |
| `MINUTES_LLM_CHUNK_CHARS` / `MINUTES_LLM_MAX_TOKENS` | 40000 / 4000 | transkrip panjang diringkas per potongan lalu digabung |

Yang dikirim: judul, tanggal, judul agenda, transkrip bernomor (`[i] mm:ss Nama: teks`), dan nama tampilan peserta yang **berbicara dan tidak menolak**; tidak pernah audio, email, id, atau jabatan. Kunci API dan isi transkrip tidak pernah ditulis ke log. Notulis bisa **Ringkas ulang** selama draf belum dimasukkan; setiap ringkas ulang dicatat di log audit (`meeting.transcript_resummarized`, dengan penyedia) karena transkrip dikirim lagi ke penyedia. Privasi & Pasal 56: `docs/fitur/rapat-video-privasi.md` §6.

### 8.1 Antrean & Horizon

| Job | Antrean | Catatan |
|---|---|---|
| `StartMeetingRecorder`, `FinishMeetingRecorder`, `RelayTranscriptConsent` | `default` (`supervisor-1`) | panggilan singkat ke worker |
| `SummarizeMeetingTranscript` | **`long`** pada koneksi **`redis-long`** (`supervisor-long`: 1 proses, timeout 900 detik, 1 percobaan) | bisa berjalan sampai 900 detik; `retry_after` koneksi ini 960 detik (`REDIS_LONG_QUEUE_RETRY_AFTER`) agar Redis tidak menyerahkan job yang sama ke worker kedua di tengah jalan. Job yang mati di luar `handle()` (timeout, worker dibunuh) menandai draf gagal, tidak macet "sedang disusun" |
| `PurgeExpiredMeetingTranscripts` (02.45 WIB), `PruneSpeakingTimes` (03.20 WIB) | scheduler harian | retensi (§9) |

Semua sudah di `config/queue.php` dan `config/horizon.php`; setelah deploy cukup `php artisan horizon:terminate`. Tanpa Horizon (mis. Windows): tambahkan `php artisan queue:work redis-long --queue=long --timeout=900` di samping worker antrean biasa. Bila `REDIS_LONG_QUEUE_RETRY_AFTER` diubah, nilainya harus tetap lebih besar dari 900.

## 9. Retensi data rapat (ringkas)

| Data | Di mana | Berapa lama |
|---|---|---|
| Audio & video rapat | tidak disimpan (tanpa Egress) | — |
| Chat dalam rapat | tidak disimpan (data channel LiveKit) | — |
| Audio untuk transkrip | spool worker di VPS rapat | dihapus segera setelah transkripsi; sisa (crash) ≤ 24 jam |
| Transkrip tertunda kirim | spool worker | sampai terkirim, maks. 24 jam |
| Transkrip + draf AI (`meeting_transcripts`) | basis data aplikasi | **90 hari** setelah rapat (`MINUTES_TRANSCRIPT_RETENTION_DAYS`, kolom `purge_after`); job `PurgeExpiredMeetingTranscripts` tiap hari 02.45 WIB (`routes/console.php`, butuh scheduler) |
| Teks yang sudah "Masukkan ke notulen", notulen final | basis data aplikasi | seperti notulen biasa (belum ada retensi otomatis) |
| Waktu bicara (`meeting_speaking_times`) | basis data aplikasi | sama dengan transkrip (`MINUTES_TRANSCRIPT_RETENTION_DAYS`); job `PruneSpeakingTimes` tiap hari 03.20 WIB |
| Kehadiran video (`meeting_attendances`), pilihan menolak (`meeting_transcript_consents`), larangan masuk (`meeting_video_removals`) | basis data aplikasi | belum ada retensi otomatis (**keputusan pemilik**) |
| Log LiveKit/Caddy (identitas peserta, IP) | log Docker VPS rapat | atur rotasi log Docker (`max-size`/`max-file`) |

Detail hak & persetujuan: [`docs/fitur/rapat-video-privasi.md`](../fitur/rapat-video-privasi.md).

## 10. Tahap 2 (rencana): subtitle langsung di server GPU

Tujuan: subtitle Bahasa Indonesia **selama rapat** (bukan hanya transkrip sesudahnya) dan transkrip yang langsung siap saat rapat selesai.

| Bagian | Rencana |
|---|---|
| Model | **Qwen3-ASR-1.7B** disajikan **vLLM** dengan mode streaming |
| Tempat | server GPU terpisah (atau GPU sewaan per jam kerja); VPS rapat tetap CPU |
| Tempat (contoh) | GPU kelas L4 24 GB (`transcriber/DEPLOY.md` §6); ukur dulu |
| Alur | worker ikut ruang sebagai `rk-notulen`, mengalirkan audio tiap pembicara yang tidak menolak (potongan 0,5–1 detik + VAD) ke vLLM, lalu mengirim teks sementara/final ke ruang lewat **LiveKit text streams** topik **`lk.transcription`** dengan atribut `lk.transcribed_track_id`, `lk.segment_id`, `lk.transcription_final`; segmen final sekaligus menjadi transkrip akhir |
| **Wajib: peserta agen yang tidak tersembunyi** | Untuk subtitle, worker harus bergabung sebagai peserta **agen yang TIDAK `hidden`** (token `hidden: false`, `canPublishData: true`, tetap tanpa `canPublish` audio/video). Di LiveKit 1.13.8 text stream dari peserta `hidden` **tidak sampai ke browser** (diuji saat membangun UI: bot `rk-notulen` dengan `hidden: false` tampil, versi tersembunyi tidak). Perekam tahap 1 boleh tetap tersembunyi; worker subtitle tidak. UI menyaring peserta agen ini dari pita video dan daftar orang |
| Keamanan (audit N-07) | UI hanya menerima stream `lk.transcription` dari identitas persis `rk-notulen`; stream bertopik sama dari peserta lain diabaikan; teks dirender sebagai teks polos |
| Bendera | `LIVEKIT_SUBTITLES=true` (`config/livekit.php`, bawaan `false`) menandai fitur di props ruang; UI tetap menampilkan subtitle bila stream sah datang |
| Kode | `transcriber/notulen/transcribe.py` sudah memisahkan antarmuka `Transcriber`; backend GPU ditambah tanpa mengubah perekam & pipeline |
| Tampilan (sudah dibangun) | kotak subtitle (nama pembicara + teks) di atas bilah kontrol **hanya bila** stream sah datang, chip "Notulen otomatis aktif · Subtitle ID", tombol subtitle di bilah kontrol (⌘/Ctrl+Alt+S; ponsel: menu ⋯ › Tampilkan/Sembunyikan subtitle); tanpa stream tidak ada yang tampil |
| Privasi | sama dengan tahap 1: peserta yang menolak tidak dilanggani, sehingga tidak ada subtitle dari suaranya |

Yang harus diputuskan sebelum tahap 2: spesifikasi & biaya GPU (VRAM cukup untuk model + beberapa aliran bersamaan; ukur dengan rapat 20 orang), lokasi server (Indonesia agar audio tidak keluar negeri), latensi target (< 1–2 detik), dan apakah tahap 1 (CPU) tetap menjadi cadangan.

## 11. Operasional rutin

### 11.1 Pembaruan

- **LiveKit**: ubah tag image di `/opt/livekit/docker-compose.yaml` → `sudo systemctl restart livekit-docker` **di luar jam rapat** (semua ruang terputus). Baca catatan rilis dulu; samakan versi lokal di `compose.yml`.
- **Worker**: build ulang image dari `transcriber/` (versi paket terkunci di `requirements.txt`), restart kontainer **di luar jam rapat dan setelah transkripsi selesai** (log `transcribed … segments`): rekaman yang terputus restart dihapus dan rapat itu berstatus gagal (tanpa transkrip).

### 11.2 Ganti kunci API LiveKit (rotasi)

LiveKit menerima beberapa pasangan di `keys:`; aplikasi hanya memakai satu (`LIVEKIT_API_KEY`) untuk token **dan** verifikasi webhook (`iss` harus sama). Lakukan di luar jam rapat:

1. Buat pasangan baru (kunci acak + rahasia ≥ 32 karakter, mis. `openssl rand -hex 32`), simpan di pengelola sandi.
2. `/opt/livekit/livekit.yaml`: **tambahkan** pasangan baru di `keys:` (yang lama tetap), ubah `webhook.api_key` ke kunci baru → `sudo systemctl restart livekit-docker`.
3. `.env` aplikasi: `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` = pasangan baru → deploy / `php artisan optimize`. Di antara langkah 2 dan 3 webhook ditolak `401` (kehadiran sesaat itu hilang), jadi kerjakan berurutan dan cepat.
4. Uji §5 langkah 3–5. Setelah token lama kedaluwarsa (≥ `LIVEKIT_TOKEN_TTL`), **hapus** pasangan lama dari `keys:` → restart.
5. Bila rahasia bocor: lakukan segera walau ada rapat (memutus rapat lebih kecil risikonya).

### 11.3 Ganti `TRANSCRIBER_SECRET` / `TRANSCRIBER_CALLBACK_SECRET`

Tidak ada masa tumpang tindih (satu rahasia per arah). Di luar jam rapat dan setelah transkripsi terakhir selesai: buat dua nilai baru yang **berbeda** (`openssl rand -hex 32`), ubah di `notulen.env` worker dan `.env` aplikasi, restart worker, deploy aplikasi (`php artisan horizon:terminate`). Kiriman worker yang gagal di antaranya diulang (retry) setelah keduanya sama.

### 11.4 Pemantauan

| Apa | Cara | Tanda bahaya |
|---|---|---|
| LiveKit hidup | `curl -s https://livekit.spkd.store` → `OK`; `systemctl status livekit-docker` | bukan `OK`, unit gagal |
| Sertifikat | `echo \| openssl s_client -connect livekit.spkd.store:443 -servername livekit.spkd.store 2>/dev/null \| openssl x509 -noout -enddate` (juga `turn.spkd.store`) | < 14 hari dan tidak diperbarui Caddy |
| CPU/RAM | `docker stats` di VPS rapat | LiveKit > 60% saat rapat; worker merebut CPU saat rapat berlangsung |
| Webhook | log Laravel + `docker logs` LiveKit `grep webhook` | `401`/`422` berulang |
| Worker | `curl -s https://notulen.spkd.store/health` dari VPS aplikasi; `docker ps` (status `healthy`); log `recording room` / `transcribed` / `ALERT spool full` | `unhealthy`, `ALERT spool full`, `not delivered` |
| Spool | `du -sh` folder spool worker | tumbuh terus = transkrip gagal terkirim |
| Uji koneksi | https://livekit.io/connection-test tiap bulan dari 4G & Wi-Fi kantor | TURN/TLS merah |
| Kapasitas | `lk load-test` (§5) setelah pembaruan besar | packet loss > 1% |

## 12. Runbook

### R1. Rapat tidak bisa terhubung

Gejala: pra-gabung berhasil, tetapi ruang menampilkan "Tidak bisa tersambung ke server rapat. Periksa jaringan Anda (UDP atau port 443 mungkin diblokir)." atau terus "Menyambungkan ulang…".

1. **Satu orang atau semua?** Semua → langkah 2. Satu orang → langkah 5.
2. `curl -s https://livekit.spkd.store` → `OK`? Tidak: `sudo systemctl status livekit-docker`, `sudo docker ps`, `sudo docker logs --tail 200 livekit-livekit-1`; lalu `sudo systemctl restart livekit-docker`.
3. Tombol gabung memberi "Video RuangKerja belum disiapkan di server ini." (`503`): `LIVEKIT_*` di `.env` aplikasi kosong/salah → `php artisan config:show livekit` (jangan menempel rahasia ke kanal obrolan), lalu `php artisan optimize`.
4. Token ditolak LiveKit (log LiveKit `invalid token`/`unauthorized`): kunci aplikasi tidak ada di `keys:` (sering setelah rotasi §11.2), atau jam VPS aplikasi meleset (`timedatectl`).
5. Satu orang/satu jaringan: buka https://livekit.io/connection-test dari perangkatnya. UDP merah tetapi **TURN/TLS** hijau → seharusnya tetap bisa (lewat `turn.spkd.store:443`, kualitas sedikit turun). Bila TURN/TLS juga merah: firewall kantor memblokir 443 ke IP rapat atau memeriksa TLS (proksi SSL) → minta TI kantor mengizinkan `livekit.spkd.store` dan `turn.spkd.store` (443/tcp) tanpa inspeksi TLS, atau pakai 4G.
6. Pesan "Ruang rapat dibuka pukul HH.MM" / "Rapat sudah selesai. Ruang rapat sudah ditutup." bukan gangguan: jendela gabung (§4). Penyelenggara selalu bisa masuk.
7. Media tidak jalan setelah perubahan firewall: pastikan 50000–60000/udp, 3478/udp, 30000–40000/udp, 7881/tcp, 443/tcp terbuka di **Security Group Biznet dan `ufw`** (`sudo ufw status`).

### R2. Transkrip tidak muncul

Gejala: rapat dengan notulen otomatis sudah selesai > 1 jam, halaman notulen belum menampilkan transkrip/draf.

1. Status di halaman **Notulen otomatis** (`GET /rapat/{id}/notulen-otomatis/status`): tidak ada transkrip sama sekali → langkah 2–3 (worker tidak pernah merekam); **Merekam** lama setelah rapat → worker belum keluar (ruang belum kosong ±90 detik, atau `room_finished` tidak sampai) → langkah 3; **Mentranskrip** → langkah 4; **Gagal** → langkah 6. Pastikan juga rapat memang ber-`auto_minutes` dan `TRANSCRIBER_URL`/`SECRET` terisi (`php artisan config:show notulen.transcriber.url`).
2. Worker hidup? `curl -s https://notulen.spkd.store/health` dari VPS aplikasi (dan `curl -s http://127.0.0.1:8090/health` di VPS rapat untuk memisahkan masalah Caddy). Mati → `docker logs --tail 200 <worker>`; galat `config: …` = kunci §7.3 salah.
3. Worker pernah diminta bergabung? Log worker `recording room rk-…`. Tidak ada → cek berurutan: URL webhook kedua `https://spkd.store/api/notulen/livekit` ada di `livekit.yaml` (§3); job `StartMeetingRecorder` gagal di Horizon/`failed_jobs` (`Transcriber join unreachable: …` = jaringan/DNS/rute Caddy `/notulen`; `Transcriber join answered HTTP 401` = rahasia beda atau jam meleset; `HTTP 502` = worker tidak bisa masuk ruang: `LIVEKIT_URL` worker salah atau token ditolak).
4. Masih diproses? Log `finishing rk-…` tanpa `transcribed …` → transkripsi berjalan; perkirakan dari RTF (§7.4). Log `recording of … was interrupted by a restart; audio deleted` → worker restart di tengah rapat, transkrip rapat itu tidak bisa dibuat. `ALERT spool full` → kosongkan/naikkan `TRANSCRIBER_SPOOL_MAX_GB`.
5. Terkirim? Log worker `app refused … HTTP 4xx` = aplikasi menolak (rahasia/format, cek log Laravel); `app unreachable` = jaringan/DNS/TLS (lokal: `TRANSCRIBER_CA_FILE`); `transcript for … not delivered; kept until the spool purge` = perbaiki penyebabnya lalu restart worker **sebelum 24 jam** (dikirim ulang); setelah itu transkrip terhapus.
6. Gagal dengan "Transkripsi gagal (…)": lihat traceback di log worker (model gagal diunduh → `WHISPER_MODEL_DIR` & ruang disk; kehabisan memori → model/threads lebih kecil, naikkan batas memori).
7. Transkrip ada tetapi seseorang tidak muncul: dia menyalakan "Jangan transkrip suara saya", mikrofonnya mati, atau suaranya hanya lewat audio berbagi layar (tidak direkam). Ini perilaku yang benar.

### R3. Ringkasan gagal

Gejala: transkrip ada, tetapi draf notulen AI kosong/galat.

Status draf (`GET …/notulen-otomatis/status` › `draft`): `disabled` = `MINUTES_LLM_API_KEY` kosong (bukan galat); `failed` dengan `error`; `pending` lama = supervisor `supervisor-long` tidak jalan (Horizon › antrean `long`, §8.1).

1. Baca `draft.error` atau log Laravel `Meeting transcript summary failed` (berisi id transkrip + pesan, tanpa isi transkrip).
2. *"Layanan ringkasan AI HTTP 401."* / `403` / `402` → kunci API salah/kedaluwarsa/saldo habis: perbarui `MINUTES_LLM_API_KEY`, `php artisan optimize` + `php artisan horizon:terminate` (atau deploy ulang; job berjalan di worker antrean yang menyimpan konfigurasi lama sampai di-restart), lalu notulis menekan **Ringkas ulang**.
3. *"Layanan ringkasan AI HTTP 429."* / `5xx` / *"… tidak terjangkau."* → penyedia sibuk/terputus (sudah diulang otomatis `MINUTES_LLM_RETRIES` kali); tunggu lalu **Ringkas ulang**. Batas waktu: naikkan `MINUTES_LLM_TIMEOUT` atau turunkan `MINUTES_LLM_CHUNK_CHARS` untuk rapat panjang.
4. *"Ringkasan AI tidak berbentuk JSON yang valid."* → model tidak mendukung mode JSON dengan baik; ganti model/penyedia (R4).
5. Penyedia tidak bisa dijangkau dari VPS aplikasi (DNS/egress firewall) → `curl -sI $MINUTES_LLM_BASE_URL` dari kontainer aplikasi.
6. Sementara itu notulis tetap bisa menulis notulen dari transkrip; transkrip tidak hilang karena ringkasan gagal.

### R4. Ganti penyedia LLM

Alasan: biaya, kualitas, atau keputusan privasi (mis. pindah ke penyedia/server di Indonesia atau model lokal).

1. Pilih penyedia dan pastikan dasar hukumnya: transfer data pribadi ke luar negeri wajib memenuhi UU PDP Pasal 56 (lihat `docs/fitur/rapat-video-privasi.md` §6); penyedia di Indonesia atau model di server sendiri menghapus kebutuhan itu.
2. Penyedia harus menyediakan API **kompatibel OpenAI** `POST /chat/completions` dengan `response_format: {"type":"json_object"}` (mis. layanan lain yang kompatibel, atau model lokal di belakang vLLM/Ollama berantarmuka OpenAI). Isi `.env` aplikasi: `MINUTES_LLM_BASE_URL`, `MINUTES_LLM_API_KEY`, `MINUTES_LLM_MODEL`, `MINUTES_LLM_PROVIDER` (nama yang tampil), `MINUTES_LLM_OUTSIDE_INDONESIA` (`false` bila server penyedia di Indonesia) → deploy ulang, atau `php artisan optimize` + `php artisan horizon:terminate` agar worker antrean memuat konfigurasi baru.
3. Uji dengan satu rapat uji (bukan rapat nyata): ringkasan, keputusan bertanda waktu, usulan tindak lanjut, "Perlu dicek" terisi dan berbahasa Indonesia.
4. Perbarui daftar penyedia layanan di kebijakan privasi (`resources/markdown/privacy-policy.md` §5) dan `docs/fitur/rapat-video-privasi.md`, lalu naikkan `PRIVACY_POLICY_VERSION`/`PRIVACY_POLICY_DATE` (catatan: menaikkan versi juga meminta persetujuan ulang lokasi & selfie absensi, `config/attendance.php`).
5. Cabut kunci API penyedia lama di dasbor penyedia itu.

## 13. Lokal

LiveKit: `docs/SETUP-LOKAL.md` › "Rapat video" (`compose.yml` profil `video`, `herd proxy livekit … --secure` untuk `wss://livekit.test`). Worker transkripsi lokal: `transcriber/DEPLOY.md` §5 (di macOS jalankan **native**, bukan di kontainer, karena kandidat ICE LiveKit lokal = 127.0.0.1; uji dua peserta `tests/e2e/notulen-otomatis.mjs`; uji unit `pytest` + `ruff`). Untuk sekadar melihat tampilan notulen otomatis tanpa worker: isi `TRANSCRIBER_URL` + kedua rahasia dengan nilai lokal apa pun, lalu buat data contoh transkrip (mis. skenario gambar dokumentasi). Jangan memakai kunci DeepSeek sungguhan untuk uji.
