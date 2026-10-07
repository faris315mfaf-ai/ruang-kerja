# Rapat video (Video RuangKerja): operasional

Panduan operasional untuk **rapat video bawaan RuangKerja**, **notulen otomatis** (transkrip setelah rapat + draf notulen dari AI), dan rencana **subtitle langsung** (tahap 2, GPU). Untuk admin server dan pengembang. Panduan pemakai: [`docs/fitur/rapat-video.md`](../fitur/rapat-video.md); privasi & UU PDP: [`docs/fitur/rapat-video-privasi.md`](../fitur/rapat-video-privasi.md); fitur & kode: [`docs/fitur/rapat-kalender.md`](../fitur/rapat-kalender.md) §6a.

> **Status 7 Okt 2026.** **Nyata:** server LiveKit di VPS rapat (§1–§6), token, webhook kehadiran, bisukan/keluarkan. **Sedang dibangun** (branch `claude/rapat-ui`, `claude/rapat-backend`, `claude/notulen-otomatis`): tampilan baru arah C "Notulen Hidup", worker transkripsi (`transcriber/`, kodenya sudah ada di branch notulen), endpoint transkrip & ringkasan di aplikasi. Bagian yang bergantung pada pekerjaan itu diberi tanda **Menunggu**. **Rencana:** subtitle langsung di server GPU (§10).

```
                    ┌─────────────────────────── VPS aplikasi (spkd.store) ───────────────────────────┐
Browser ──HTTPS──▶  │ RuangKerja (Laravel)                                                              │
   │                │  · POST /rapat/{id}/video/token        → token JWT LiveKit                        │
   │                │  · POST /api/livekit/webhook            ← kehadiran (bertanda tangan JWT)          │
   │                │  · POST /api/notulen/transcript         ← status + transkrip (HMAC)               │
   │                │  · ringkasan → penyedia LLM (DeepSeek bawaan, bisa diganti) ── HTTPS ──▶ luar     │
   │                └───────────────────────▲──────────────────────────┬────────────────────────────────┘
   │ WSS (sinyal)                          │ webhook / transkrip      │ minta worker bergabung (HMAC)
   ▼                                       │                          ▼
livekit.spkd.store ── VPS rapat 103.125.181.244: Caddy (443, TLS otomatis) → LiveKit :7880
   ▲                                     └─ worker transkripsi "rk-notulen" (:8090, Menunggu: belum terpasang)
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
    - https://spkd.store/api/livekit/webhook
```

```bash
sudo systemctl restart livekit-docker   # memutus rapat yang sedang berjalan: lakukan di luar jam rapat
sudo docker logs -f livekit-livekit-1 2>&1 | grep -i webhook   # nama kontainer: lihat `docker ps`
```

Yang dicatat aplikasi: `participant_joined` / `participant_left` / `room_finished` → tabel `meeting_attendances` (detail rapat "N orang di ruang rapat", panel **Hadir di rapat video**, isian awal kehadiran notulen). `room_started` dan kejadian lain dijawab `200 {"status":"ignored"}`. Rute ini **tanpa sesi/CSRF**; keamanannya dari tanda tangan JWT (`Authorization`, klaim `sha256` = hash badan), umur token 5 menit, penolakan kejadian lebih tua dari 5 menit, dan id kejadian yang hanya diproses sekali. Batas laju 600/menit per IP.

Jawaban endpoint: `200` tercatat/diabaikan/duplikat · `401` tanda tangan salah (kunci/rahasia tidak cocok) · `404` aplikasi belum diisi `LIVEKIT_*` atau `FEATURE_MEETINGS=false` · `413` badan terlalu besar · `422` bukan JSON atau kejadian kedaluwarsa (cek jam).

> **Menunggu (`claude/rapat-backend`, `claude/notulen-otomatis`):** apakah webhook juga memicu worker transkripsi (mis. `room_started`/`participant_joined` pada rapat dengan notulen otomatis) dan apakah ada webhook kedua. Perbarui bagian ini dari `docs/fitur/rapat-video-kontrak.md` dan `docs/fitur/notulen-otomatis-kontrak.md`.

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
- Kunci untuk notulen otomatis dan ringkasan AI: §7.3 dan §8.

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
7. **Notulen otomatis** (Menunggu §7): rapat dengan notulen otomatis aktif → setelah semua keluar, `GET /health` worker menunjukkan `queued`/`transcribing` → draf muncul di halaman notulen. Satu peserta menyalakan "Jangan transkrip suara saya" → kalimatnya tidak ada di transkrip.

Uji manual dua pengguna di lokal: `tests/e2e/rapat-video-two-users.mjs`.

## 6. Uji coba 1–2 minggu (catat)

Jeda suara (rasa), putus-sambung, CPU (`docker stats`, target < 60% untuk 20 orang), trafik keluar per jam (panel Biznet), kualitas di 4G, berapa peserta jatuh ke TURN/TLS (log LiveKit `turn`). Setelah worker transkripsi terpasang: lama transkripsi per jam rapat, CPU saat transkripsi berjalan bersamaan dengan rapat lain, dan keluhan kualitas transkrip.

## 7. Notulen otomatis: worker transkripsi (tahap 1, CPU)

Kode: `transcriber/` (Python 3.12, branch `claude/notulen-otomatis`). Satu proses, satu kontainer, dijalankan **di VPS rapat** di samping LiveKit.

### 7.1 Cara kerja

1. Aplikasi meminta worker bergabung ke ruang `rk-{meeting}-{yyyymmdd}` (`POST /rooms/{room}/join`, ditandatangani HMAC) dengan token LiveKit yang dibuat aplikasi: identitas **`rk-notulen`**, tersembunyi, hanya berlangganan (tidak bisa bicara/tampil), plus daftar identitas yang dikecualikan.
2. Worker hanya berlangganan **trek mikrofon** peserta manusia yang **tidak** menolak. Peserta yang menyalakan "Jangan transkrip suara saya" (atribut LiveKit `rk_notulen_optout`) atau yang dikecualikan aplikasi tidak pernah dilanggani, jadi suaranya tidak sampai ke worker. Menolak di tengah rapat → langganan berhenti dan rekaman orang itu yang sudah ada **dihapus**. Audio berbagi layar tidak direkam.
3. Audio per pembicara ditulis ke spool lokal (`TRANSCRIBER_SPOOL_DIR`, WAV 16 kHz mono 16-bit, berkas baru setelah jeda 2 detik/bisu atau tiap 10 menit; nama berkas tanpa identitas). Rekaman berhenti saat aplikasi memanggil `POST /rooms/{room}/finish`, saat ruang kosong dari manusia selama `TRANSCRIBER_EMPTY_GRACE` detik, atau setelah `TRANSCRIBER_MAX_MINUTES`.
4. Antrean transkripsi (konkurensi `TRANSCRIBE_CONCURRENCY`, bawaan 1): faster-whisper (bahasa Indonesia, VAD, int8) per berkas, potongan diberi waktu sesuai jam dinding, frasa halusinasi umum Whisper ("terima kasih telah menonton", dll.) dibuang, semua pembicara digabung menurut waktu. Nama pembicara langsung dari trek LiveKit (tanpa model diarisasi).
5. **Audio dihapus segera setelah transkripsi** (berhasil atau gagal), lalu transkrip dikirim ke aplikasi `POST {TRANSCRIBER_APP_URL}/api/notulen/transcript` (HMAC, hingga 6 percobaan dengan jeda 2→60 detik). Bila aplikasi tidak menjawab, `result.json` (teks transkrip) tertahan di spool dan **dihapus otomatis setelah `TRANSCRIBER_SPOOL_MAX_AGE_HOURS`** (bawaan 24 jam). Setelah restart, sesi yang belum selesai diproses ulang.

Status yang dikirim ke aplikasi: `recording` → `transcribing` → `ready` | `failed` (dengan `error` singkat, mis. "Transkripsi gagal (RuntimeError).").

### 7.2 API worker

| Rute | Isi |
|---|---|
| `GET /health` | `{"status":"ok","recording":N,"queued":N,"transcribing":N,"model":"large-v3-turbo"}`; tanpa rahasia & nama ruang. Dipakai `HEALTHCHECK` Docker |
| `POST /rooms/{room}/join` | badan `{"action":"join","room":…,"token":…,"exclude":[identitas…]}` → `202 {"status":"joining"}` atau `200 {"status":"already"}`; `502` gagal masuk ruang |
| `POST /rooms/{room}/finish` | badan `{"action":"finish","room":…}` → `202` atau `404 {"status":"unknown"}` |

Tanda tangan dua arah (aplikasi → worker, worker → aplikasi): header `X-Notulen-Timestamp: <unix detik>` dan `X-Notulen-Signature: v1=<hex HMAC-SHA256(TRANSCRIBER_SECRET, "<timestamp>.<badan mentah>")>`. Ditolak `401` bila timestamp di luar `TRANSCRIBER_TOLERANCE` (bawaan 300 detik) atau tanda tangan pernah dipakai (anti-replay). Badan wajib menyebut `action` dan `room` yang sama dengan URL (`422` bila tidak), maks. 64 KB (`413`). URL LiveKit diambil dari konfigurasi worker, tidak pernah dari permintaan. Pasangan PHP: `App\Domain\Meetings\Services\NotulenSignature` (Menunggu: belum di-commit).

### 7.3 Kunci lingkungan

**Worker** (`transcriber/notulen/config.py`; worker menolak mulai bila tiga kunci pertama salah):

| Kunci | Bawaan | Arti |
|---|---|---|
| `TRANSCRIBER_SECRET` | — (wajib, ≥ 32 karakter) | rahasia HMAC bersama aplikasi; nilai sama di `.env` aplikasi |
| `TRANSCRIBER_APP_URL` | — (wajib) | URL dasar aplikasi, `https://spkd.store` |
| `LIVEKIT_URL` | `ws://127.0.0.1:7880` | LiveKit dilihat dari worker (lokal di VPS rapat, tanpa TLS) |
| `TRANSCRIBER_HOST` / `TRANSCRIBER_PORT` | `0.0.0.0` / `8090` | alamat API worker; port hanya dipublikasikan ke localhost/Caddy |
| `TRANSCRIBER_SPOOL_DIR` | `/var/spool/notulen` | audio sementara (izin 700, pengguna `notulen` uid 10001) |
| `WHISPER_MODEL` | `large-v3-turbo` | nama/path model faster-whisper (§7.4) |
| `WHISPER_COMPUTE_TYPE` | `int8` | presisi CTranslate2 |
| `WHISPER_CPU_THREADS` | `4` | thread per transkripsi |
| `WHISPER_BEAM_SIZE` | `1` | beam search (lebih besar = sedikit lebih akurat, lebih lambat) |
| `WHISPER_LANGUAGE` | `id` | bahasa transkrip |
| `WHISPER_MODEL_DIR` | `/models` (Dockerfile) | lokasi unduhan model; pasang volume agar tidak mengunduh ulang |
| `TRANSCRIBE_CONCURRENCY` | `1` | transkripsi bersamaan |
| `TRANSCRIBER_TOLERANCE` | `300` | jendela anti-replay tanda tangan (detik, min 30) |
| `TRANSCRIBER_EMPTY_GRACE` | `90` | keluar dari ruang setelah tanpa manusia selama N detik |
| `TRANSCRIBER_MAX_MINUTES` | `240` | batas satu sesi rekaman |
| `TRANSCRIBER_MAX_SEGMENT_SECONDS` | `600` | potong berkas audio setiap N detik |
| `TRANSCRIBER_SPOOL_MAX_AGE_HOURS` | `24` | sisa audio/transkrip di spool dihapus setelah N jam |
| `TRANSCRIBER_CA_FILE` | kosong | CA tambahan untuk `TRANSCRIBER_APP_URL` (lokal: CA Herd) |

**Aplikasi:** `TRANSCRIBER_URL` (alamat API worker) dan `TRANSCRIBER_SECRET` (sama dengan worker), seperti disebut di kode worker.

> **Menunggu (`claude/notulen-otomatis`):** nama pasti kunci aplikasi di `config/*.php` dan `.env.production.example`, sakelar fitur (bila ada), cara aplikasi menjangkau worker dari VPS aplikasi (rute Caddy di VPS rapat berbatas IP, atau terowongan), dan kapan aplikasi memanggil `join`/`finish`.

### 7.4 Pilihan model

| `WHISPER_MODEL` | Kapan | Catatan |
|---|---|---|
| `large-v3-turbo` (bawaan) | kualitas terbaik yang masih wajar di CPU | unduhan ±1,6 GB; pilihan rancangan ("Whisper turbo · bahasa Indonesia") |
| `medium` | CPU sempit, antrean menumpuk | lebih cepat, lebih banyak salah dengar istilah |
| `small` | darurat / uji | cepat, kualitas Bahasa Indonesia jelas turun |

Ukur di server sendiri sebelum memilih (model diunduh pada percobaan pertama, tidak ikut dihitung):

```bash
docker run --rm -v notulen-models:/models -v $PWD:/data <image-transcriber> \
  python -m notulen.bench /data/contoh-rapat.wav --model large-v3-turbo --threads 4
# → audio=…s transcribe=…s RTF=… (RTF 0,25 = empat kali lebih cepat dari waktu nyata)
```

Gunakan rekaman uji yang **disetujui** pembicaranya (bukan rekaman rapat nyata). Waktu transkripsi ≈ RTF × total durasi bicara semua peserta (bagian hening dilewati VAD).

### 7.5 Ukuran & batas CPU

- Worker berbagi mesin dengan LiveKit. Rekaman ringan (dekode Opus beberapa pembicara); **transkripsi berat** dan berjalan setelah rapat, bisa bersamaan dengan rapat lain. Karena itu bawaannya satu transkripsi (`TRANSCRIBE_CONCURRENCY=1`) × 4 thread.
- Batasi kontainer worker agar LiveKit selalu punya ruang: di server 8 vCPU, `cpus: "4"` dan batas memori ±6 GB (model turbo int8 + satu berkas 10 menit). Jangan menaikkan `WHISPER_CPU_THREADS` melebihi batas `cpus`. Angka ini perkiraan awal; sesuaikan dari pengukuran §6.
- Disk spool: ±115 MB per jam bicara per pembicara (16 kHz × 16-bit), dihapus setelah transkripsi. Sediakan ruang untuk rapat terpanjang × jumlah pembicara aktif (mis. 4 jam × 8 orang ≈ 3,7 GB) + model ±1,6 GB.
- Bila antrean (`queued` di `/health`) sering > 0 lebih dari satu jam setelah rapat: pakai model lebih kecil, tambah vCPU, atau pindah ke tahap 2 (GPU).

### 7.6 Pasang

> **Menunggu (`claude/notulen-otomatis`):** layanan compose/systemd resmi untuk worker belum ada di repo; yang sudah ada `transcriber/Dockerfile` (python:3.12-slim, pengguna non-root `notulen`, `EXPOSE 8090`, `HEALTHCHECK` ke `/health`, model diunduh ke `/models` saat mulai pertama). Setelah cara pasangnya ditetapkan, isi langkah di sini: build/tarik image, volume `/models` dan spool, `env_file` berisi kunci §7.3 (izin 600, tidak di-commit), jaringan yang bisa menjangkau `127.0.0.1:7880`, batas `cpus`/`mem_limit` (§7.5), dan rute Caddy berbatas IP VPS aplikasi ke `:8090`.

Cek setelah terpasang: `curl -s http://127.0.0.1:8090/health` di VPS rapat → `"status":"ok"`; log worker `notulen worker on 0.0.0.0:8090, Settings(app_url=…, livekit_url=…, model=…)` (rahasia tidak pernah dicetak).

## 8. Ringkasan AI (LLM)

Setelah transkrip `ready`, aplikasi membuat **draf notulen**: ringkasan, keputusan (dengan tautan waktu ke transkrip), usulan tindak lanjut (bisa "Jadikan tugas"), dan "Perlu dicek" (hal yang tidak pasti). Penyedia bawaan **DeepSeek** (API di luar Indonesia) dan **bisa diganti** lewat konfigurasi; yang dikirim ke penyedia adalah **teks transkrip** + nama pembicara + judul/agenda rapat, **bukan** audio.

> **Menunggu (`claude/notulen-otomatis`, `docs/fitur/notulen-otomatis-kontrak.md`):** nama kunci `.env` (penyedia, URL dasar, model, kunci API, batas waktu/token), isi persis yang dikirim ke penyedia, job & antrean yang menjalankannya, retry, perilaku bila gagal, dan apakah nama pembicara disamarkan sebelum dikirim. Jangan menulis kunci API di dokumen ini.

## 9. Retensi data rapat (ringkas)

| Data | Di mana | Berapa lama |
|---|---|---|
| Audio & video rapat | tidak disimpan (tanpa Egress) | — |
| Chat dalam rapat | tidak disimpan (data channel LiveKit) | — |
| Audio untuk transkrip | spool worker di VPS rapat | dihapus segera setelah transkripsi; sisa (crash) ≤ 24 jam |
| Transkrip tertunda kirim | spool worker (`result.json`) | sampai terkirim, maks. 24 jam |
| Transkrip | basis data aplikasi | rancangan: **90 hari**, bisa diatur (Menunggu: kunci & job penghapusan) |
| Draf/notulen final | basis data aplikasi | seperti notulen biasa (belum ada retensi otomatis) |
| Kehadiran video (`meeting_attendances`) | basis data aplikasi | belum ada retensi otomatis |
| Log LiveKit/Caddy (identitas peserta, IP) | log Docker VPS rapat | atur rotasi log Docker (`max-size`/`max-file`) |

Detail hak & persetujuan: [`docs/fitur/rapat-video-privasi.md`](../fitur/rapat-video-privasi.md).

## 10. Tahap 2 (rencana): subtitle langsung di server GPU

Tujuan: subtitle Bahasa Indonesia **selama rapat** (bukan hanya transkrip sesudahnya) dan transkrip yang langsung siap saat rapat selesai.

| Bagian | Rencana |
|---|---|
| Model | **Qwen3-ASR-1.7B** disajikan **vLLM** dengan mode streaming |
| Tempat | server GPU terpisah (atau GPU sewaan per jam kerja); VPS rapat tetap CPU |
| Alur | worker ikut ruang sebagai `rk-notulen`, mengalirkan audio tiap pembicara (yang tidak menolak) ke vLLM, lalu mengirim teks sementara/final ke ruang lewat **LiveKit text streams** dengan topik **`lk.transcription`** (dengan identitas pembicara), dan menyimpan hasil final sebagai transkrip seperti tahap 1 |
| Kode | `transcriber/notulen/transcribe.py` sudah memisahkan antarmuka `Transcriber`; backend GPU ditambah tanpa mengubah perekam & pipeline |
| Tampilan | ruang rapat menampilkan kotak subtitle (nama pembicara + teks) di atas bilah kontrol **hanya bila** ruang menerima text stream `lk.transcription`, dan chip "Notulen otomatis aktif · Subtitle ID"; tanpa stream, kotak tidak tampil |
| Privasi | sama dengan tahap 1: peserta yang menolak tidak dilanggani, sehingga tidak ada subtitle dari suaranya |

Yang harus diputuskan sebelum tahap 2: spesifikasi & biaya GPU (VRAM cukup untuk model + beberapa aliran bersamaan; ukur dengan rapat 20 orang), lokasi server (Indonesia agar audio tidak keluar negeri), latensi target (< 1–2 detik), dan apakah tahap 1 (CPU) tetap menjadi cadangan.

## 11. Operasional rutin

### 11.1 Pembaruan

- **LiveKit**: ubah tag image di `/opt/livekit/docker-compose.yaml` → `sudo systemctl restart livekit-docker` **di luar jam rapat** (semua ruang terputus). Baca catatan rilis dulu; samakan versi lokal di `compose.yml`.
- **Worker**: build ulang image dari `transcriber/` (versi paket terkunci di `requirements.txt`), restart kontainer setelah antrean kosong (`/health` → `queued: 0, transcribing: 0`). Sesi yang terputus diproses ulang setelah restart.

### 11.2 Ganti kunci API LiveKit (rotasi)

LiveKit menerima beberapa pasangan di `keys:`; aplikasi hanya memakai satu (`LIVEKIT_API_KEY`) untuk token **dan** verifikasi webhook (`iss` harus sama). Lakukan di luar jam rapat:

1. Buat pasangan baru (kunci acak + rahasia ≥ 32 karakter, mis. `openssl rand -hex 32`), simpan di pengelola sandi.
2. `/opt/livekit/livekit.yaml`: **tambahkan** pasangan baru di `keys:` (yang lama tetap), ubah `webhook.api_key` ke kunci baru → `sudo systemctl restart livekit-docker`.
3. `.env` aplikasi: `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` = pasangan baru → deploy / `php artisan optimize`. Di antara langkah 2 dan 3 webhook ditolak `401` (kehadiran sesaat itu hilang), jadi kerjakan berurutan dan cepat.
4. Uji §5 langkah 3–5. Setelah token lama kedaluwarsa (≥ `LIVEKIT_TOKEN_TTL`), **hapus** pasangan lama dari `keys:` → restart.
5. Bila rahasia bocor: lakukan segera walau ada rapat (memutus rapat lebih kecil risikonya).

### 11.3 Ganti `TRANSCRIBER_SECRET`

Tidak ada masa tumpang tindih (satu rahasia di tiap sisi). Tunggu antrean worker kosong, ubah rahasia di `env_file` worker dan `.env` aplikasi, restart worker, deploy aplikasi. Kiriman worker yang gagal di antaranya diulang (retry) setelah keduanya sama.

### 11.4 Pemantauan

| Apa | Cara | Tanda bahaya |
|---|---|---|
| LiveKit hidup | `curl -s https://livekit.spkd.store` → `OK`; `systemctl status livekit-docker` | bukan `OK`, unit gagal |
| Sertifikat | `echo \| openssl s_client -connect livekit.spkd.store:443 -servername livekit.spkd.store 2>/dev/null \| openssl x509 -noout -enddate` (juga `turn.spkd.store`) | < 14 hari dan tidak diperbarui Caddy |
| CPU/RAM | `docker stats` di VPS rapat | LiveKit > 60% saat rapat; worker merebut CPU saat rapat berlangsung |
| Webhook | log Laravel + `docker logs` LiveKit `grep webhook` | `401`/`422` berulang |
| Worker | `curl -s http://127.0.0.1:8090/health`; `docker ps` (status `healthy`) | `unhealthy`, `queued` naik terus |
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

1. Halaman notulen menampilkan status apa? (Menunggu: teks status dari UI baru.) Gagal → langkah 6.
2. Worker hidup? `curl -s http://127.0.0.1:8090/health` di VPS rapat. Mati → `docker logs --tail 200 <worker>`; galat `config: …` = kunci §7.3 salah.
3. Worker pernah diminta bergabung? Log worker `recording room rk-…`. Tidak ada → aplikasi tidak memanggil `join`: cek log Laravel (Menunggu: nama job/log), `TRANSCRIBER_URL` & `TRANSCRIBER_SECRET` aplikasi, jangkauan jaringan VPS aplikasi → worker. `401` di worker = rahasia beda atau jam meleset; `502 could not join the room` = token/URL LiveKit salah.
4. Antrean: `queued`/`transcribing` > 0 → masih diproses; perkirakan dari RTF (§7.4). Antrean macet lama → restart worker (sesi dilanjutkan).
5. Terkirim? Log worker `app refused … HTTP 4xx` = aplikasi menolak (rahasia/format, cek log Laravel); `app unreachable` = jaringan/DNS/TLS (lokal: `TRANSCRIBER_CA_FILE`); `transcript for … not delivered; kept until the spool purge` = perbaiki penyebabnya lalu restart worker **sebelum 24 jam** (dikirim ulang); setelah itu transkrip terhapus.
6. Gagal dengan "Transkripsi gagal (…)": lihat traceback di log worker (model gagal diunduh → `WHISPER_MODEL_DIR` & ruang disk; kehabisan memori → model/threads lebih kecil, naikkan batas memori).
7. Transkrip ada tetapi seseorang tidak muncul: dia menyalakan "Jangan transkrip suara saya", mikrofonnya mati, atau suaranya hanya lewat audio berbagi layar (tidak direkam). Ini perilaku yang benar.

### R3. Ringkasan gagal

Gejala: transkrip ada, tetapi draf notulen AI kosong/galat.

> **Menunggu (`claude/notulen-otomatis`):** nama job, pesan galat, dan cara mengulang ringkasan dari UI/artisan.

1. Log Laravel & Horizon (`failed_jobs`): galat HTTP dari penyedia LLM.
2. `401/403` → kunci API LLM salah/kedaluwarsa/saldo habis: perbarui kunci di `.env`, `php artisan optimize`, ulangi job.
3. `429`/`5xx`/batas waktu → penyedia sibuk; tunggu dan ulangi. Transkrip sangat panjang → periksa batas token (Menunggu).
4. Penyedia tidak bisa dijangkau dari VPS aplikasi (DNS/egress firewall) → `curl -sI <URL dasar penyedia>` dari kontainer aplikasi.
5. Sementara itu notulis tetap bisa menulis notulen manual dari transkrip; tidak ada data yang hilang.

### R4. Ganti penyedia LLM

Alasan: biaya, kualitas, atau keputusan privasi (mis. pindah ke penyedia/server di Indonesia atau model lokal).

1. Pilih penyedia dan pastikan dasar hukumnya: transfer data pribadi ke luar negeri wajib memenuhi UU PDP Pasal 56 (lihat `docs/fitur/rapat-video-privasi.md` §6); penyedia di Indonesia atau model di server sendiri menghapus kebutuhan itu.
2. Isi kunci penyedia baru di `.env` aplikasi (Menunggu: nama kunci §8) → `php artisan optimize`.
3. Uji dengan satu rapat uji (bukan rapat nyata): ringkasan, keputusan bertanda waktu, usulan tindak lanjut, "Perlu dicek" terisi dan berbahasa Indonesia.
4. Perbarui daftar penyedia layanan di kebijakan privasi (`resources/markdown/privacy-policy.md` §5) dan `docs/fitur/rapat-video-privasi.md`, lalu naikkan `PRIVACY_POLICY_VERSION`/`PRIVACY_POLICY_DATE` (catatan: menaikkan versi juga meminta persetujuan ulang lokasi & selfie absensi, `config/attendance.php`).
5. Cabut kunci API penyedia lama di dasbor penyedia itu.

## 13. Lokal

LiveKit: `docs/SETUP-LOKAL.md` › "Rapat video" (`compose.yml` profil `video`, `herd proxy livekit … --secure` untuk `wss://livekit.test`). Worker transkripsi: uji dengan `cd transcriber && pip install -r requirements-dev.txt && pytest`; menjalankan worker ke situs Herd butuh `TRANSCRIBER_APP_URL=https://ruangkerja.test`, `TRANSCRIBER_CA_FILE=<CA Herd>`, `LIVEKIT_URL=ws://127.0.0.1:7880` (Menunggu: langkah resmi di `docs/SETUP-LOKAL.md`).
