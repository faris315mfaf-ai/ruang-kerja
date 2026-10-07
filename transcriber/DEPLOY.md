# Notulen otomatis — worker (tahap 1, CPU)

Ringkasan operasional untuk ditautkan dari `docs/deploy/RAPAT-VIDEO.md` §7–§8. Kontrak data aplikasi ↔ UI: `docs/fitur/notulen-otomatis-kontrak.md`.

```
Rapat video ──(LiveKit, media)──▶ worker rk-notulen (tersembunyi, subscribe mikrofon saja)
  webhook LiveKit #2 ─▶ aplikasi POST /api/notulen/livekit ─▶ job ─▶ worker POST /rooms/{room}/join|finish (HMAC)
  worker: WAV 16 kHz per peserta → faster-whisper (id, VAD) → POST aplikasi /api/notulen/transcript (HMAC) → audio dihapus
  aplikasi: simpan transkrip → job ringkasan (API OpenAI-compatible, bawaan DeepSeek) → draf untuk notulis
```

## 1. Server rapat (103.125.181.244, `/opt/livekit`)

1. DNS `notulen.spkd.store` → IP server rapat.
2. Salin `deploy/compose.notulen.yaml` dan `deploy/notulen.env.example` (→ `notulen.env`, `chmod 600`, isi `TRANSCRIBER_SECRET` dan `TRANSCRIBER_CALLBACK_SECRET` — dua nilai acak **berbeda** `openssl rand -hex 32`, masing-masing **sama** dengan aplikasi) ke `/opt/livekit/`. Image: bangun dari folder `transcriber/` (`docker build -t ruangkerja-transcriber transcriber/` lalu `TRANSCRIBER_IMAGE=ruangkerja-transcriber`) atau dari registry.
3. `sudo docker compose -f compose.notulen.yaml --env-file notulen.env up -d` — `network_mode: host`, API hanya di `127.0.0.1:8090`, **CPU dibatasi 4** (`cpus`), RAM 6 GB, `restart: unless-stopped`, volume `notulen-models` (cache model, unduh ±1,6 GB saat start pertama; commit Hugging Face + SHA-256 `model.bin` dipatok di `notulen/transcribe.py` `PINNED`, model lain wajib `WHISPER_MODEL_REVISION` + `WHISPER_MODEL_SHA256`) dan `notulen-spool` (audio sementara, batas `TRANSCRIBER_SPOOL_MAX_GB`=20: bila penuh worker menolak rekaman baru dan menghentikan rekaman berjalan dengan log `ALERT spool full`).
4. Caddy: tambahkan rute di `deploy/caddy-notulen.yaml` ke `/opt/livekit/caddy.yaml` (SNI `notulen.spkd.store` → `127.0.0.1:8090`, hanya dari IP VPS aplikasi), restart `livekit-docker`. Tidak ada port firewall baru (tetap 443).
5. `livekit.yaml` → webhook URL **kedua** (pasangan kunci yang sama):
   ```yaml
   webhook:
     api_key: <API_KEY>
     urls:
       - https://spkd.store/api/livekit/webhook
       - https://spkd.store/api/notulen/livekit
   ```
6. Uji: dari VPS aplikasi `curl -s https://notulen.spkd.store/health` → `{"status": "ok"}` (sengaja minimal; API hanya mendengar di 127.0.0.1). Log: `sudo docker logs -f notulen-transcriber-1` (tidak pernah mencetak token, rahasia, atau isi transkrip).

## 2. Aplikasi (`.env` produksi)

| Kunci | Isi |
|---|---|
| `TRANSCRIBER_URL` | `https://notulen.spkd.store` |
| `TRANSCRIBER_SECRET` | aplikasi → worker, sama dengan worker (≥ 32 karakter) |
| `TRANSCRIBER_CALLBACK_SECRET` | worker → aplikasi, sama dengan worker, **berbeda** dari `TRANSCRIBER_SECRET` |
| `MINUTES_LLM_BASE_URL` | `https://api.deepseek.com` (bawaan; API OpenAI-compatible lain boleh, sampai sebelum `/chat/completions`) |
| `MINUTES_LLM_API_KEY` | kunci penyedia; **kosong = tanpa draf AI** (transkrip tetap tersimpan) |
| `MINUTES_LLM_MODEL` | `deepseek-chat` |
| `MINUTES_TRANSCRIPT_RETENTION_DAYS` | `90` |
| opsional | `MINUTES_LLM_PROVIDER` (nama di pemberitahuan), `MINUTES_LLM_OUTSIDE_INDONESIA=true`, `MINUTES_LLM_TIMEOUT=120`, `MINUTES_LLM_CHUNK_CHARS=40000`, `TRANSCRIBER_TIMEOUT=10` |

Lalu deploy ulang (config di-cache). Antrean (Horizon) harus jalan: job `StartMeetingRecorder`, `FinishMeetingRecorder`, `RelayTranscriptConsent`, `SummarizeMeetingTranscript` (timeout 900 dtk); scheduler menjalankan `PurgeExpiredMeetingTranscripts` 02.45 WIB.

## 3. Kapasitas (diukur, jujur)

Sampel 74 detik ucapan Bahasa Indonesia (TTS macOS "Damayanti"), `large-v3-turbo` int8, beam 1, VAD:

| Mesin | Thread | Waktu transkripsi | RTF |
|---|---|---|---|
| Mac M5 Max, native (Accelerate) | 8 | 10,1 dtk | **0,14** |
| Mac M5 Max, Docker linux/arm64, `--cpus 8` | 8 | 14,9 dtk | **0,20** |
| Mac M5 Max, Docker linux/arm64, `--cpus 4` | 4 | 22,0 dtk | **0,30** |
| sama, model `small` | 4 | 13,0 dtk | 0,18 |

**Belum diukur di server rapat** (vCPU x86 Biznet; per inti kemungkinan 2–3× lebih lambat dari M5). Perkiraan kasar untuk `cpus: 4`: RTF 0,6–1,0 → rapat 1 jam dengan ±40 menit total ucapan selesai ±25–40 menit setelah rapat. Audio tiap peserta direkam terpisah; diam dilewati VAD sehingga biaya ≈ total waktu bicara, bukan durasi × jumlah peserta. Ukur di server sebelum produksi:

```bash
sudo docker run --rm --cpus 4 -v notulen_notulen-models:/models -v $PWD:/data ruangkerja-transcriber \
  python -m notulen.bench /data/contoh.wav --threads 4      # cetak RTF
```

Bila terlalu lambat: `WHISPER_MODEL=medium` atau `small` (lebih cepat, kurang akurat), atau tahap 2 (GPU).

## 4. Privasi & keamanan (UU PDP, audit rapat N-01…N-08)

- Satu rahasia per arah (`TRANSCRIBER_SECRET`, `TRANSCRIBER_CALLBACK_SECRET`); tanda tangan yang sudah dipakai dicatat di `spool/.replay.sqlite` (tetap setelah restart) dan di cache aplikasi.
- Nama pembicara diambil aplikasi dari `users.name` (nama peserta LiveKit bisa diubah sendiri, diabaikan); identitas lain = "Peserta tamu".
- Transkrip dikirim ke AI sebagai data kutipan di antara penanda dengan perintah mengabaikan instruksi di dalamnya; keluaran divalidasi ke skema ketat, teks polos (tag dibuang), penanggung jawab hanya peserta yang berbicara dan tidak opt-out, tidak ada yang menjadi tugas tanpa klik notulis.
- Restart di tengah rekaman: audio sesi itu dihapus dan aplikasi diberi status gagal; berkas yatim/sementara dibersihkan saat start.

- Audio hanya di spool worker, dihapus segera setelah transkripsi (gagal pun dihapus); sisa apa pun dihapus setelah 24 jam.
- Pilihan "Jangan transkrip suara saya" privat: aplikasi → worker (daftar `exclude`, HMAC), bukan atribut LiveKit. Worker tidak pernah berlangganan mikrofon orang itu; bila berubah di tengah rapat, audionya yang sudah terekam dihapus. Aplikasi juga membuang segmennya saat menerima transkrip.
- Ke penyedia AI hanya dikirim nama tampilan pembicara (bukan email/id) dan teks transkrip; DeepSeek memproses di luar Indonesia — sebutkan di kebijakan privasi.
- Transkrip dihapus setelah `MINUTES_TRANSCRIPT_RETENTION_DAYS`; teks yang sudah "Dimasukkan ke notulen" ikut notulen.

## 5. Lokal (macOS + Herd)

1. `.env` aplikasi: `LIVEKIT_*` (lihat `.env.example`), `TRANSCRIBER_URL=http://127.0.0.1:8090`, `TRANSCRIBER_SECRET=<acak>`, `TRANSCRIBER_CALLBACK_SECRET=<acak lain>`, opsional `MINUTES_LLM_BASE_URL` ke server palsu (jangan memakai kunci DeepSeek sungguhan untuk uji), `LIVEKIT_WEBHOOK_HOST=<situs Herd Anda>`.
2. `docker compose --profile video up -d livekit` (+ `herd proxy livekit http://127.0.0.1:7880 --secure`). Compose sudah mengirim webhook ke `/api/livekit/webhook` **dan** `/api/notulen/livekit`.
3. Worker — di macOS jalankan **native** (kandidat ICE LiveKit lokal = `127.0.0.1`, tidak terjangkau dari kontainer lain):
   ```bash
   cd transcriber && python3.12 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
   TRANSCRIBER_SECRET=… TRANSCRIBER_CALLBACK_SECRET=… TRANSCRIBER_APP_URL=https://<situs>.test \
   TRANSCRIBER_CA_FILE="$HOME/Library/Application Support/Herd/config/valet/CA/LaravelValetCASelfSigned.pem" \
   LIVEKIT_URL=ws://127.0.0.1:7880 TRANSCRIBER_SPOOL_DIR=/tmp/notulen-spool TRANSCRIBER_HOST=127.0.0.1 \
   .venv/bin/python -m notulen
   ```
   Di Linux/OrbStack boleh `docker compose --profile notulen up -d transcriber` (layanan `transcriber` di `compose.yml`).
4. `php artisan queue:work` (atau `composer run dev`), buat rapat **Video RuangKerja** dan nyalakan "Notulen otomatis" di detail rapat. Uji otomatis dua peserta: `tests/e2e/notulen-otomatis.mjs`.
5. Uji unit worker: `cd transcriber && .venv/bin/pytest -q && .venv/bin/ruff check . && .venv/bin/ruff format --check .`

## 6. Tahap 2 (GPU, belum dibangun)

Server GPU (mis. L4 24 GB) menjalankan **Qwen3-ASR-1.7B** lewat vLLM (mode streaming) sebagai `Transcriber` kedua di worker yang sama: alih-alih spool lalu transkrip, frame 16 kHz per peserta dialirkan (potongan 0,5–1 dtk + VAD) ke vLLM; hasil sementara/final dikirim ke ruang sebagai **LiveKit text stream** topik `lk.transcription` (atribut `lk.transcribed_track_id`, `lk.segment_id`, `lk.transcription_final`) dari identitas `rk-notulen` (token perlu `canPublishData`), sehingga klien menampilkan subtitle; segmen final sekaligus menjadi transkrip akhir (tanpa transkripsi ulang). Pemberitahuan privasi & opt-out sama. Whisper large-v3-turbo tetap cadangan CPU.
