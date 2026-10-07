# Rapat video (Video RuangKerja) di server LiveKit sendiri

Panduan memasang server **LiveKit** untuk rapat video bawaan RuangKerja (`docs/fitur/rapat-kalender.md` §6a) di **VPS rapat terpisah** (Biznet Gio NEO Lite Pro), mengikuti cara resmi LiveKit "Deploy to a VM" (`livekit/generate`). Aplikasi RuangKerja tetap di VPS aplikasi (https://spkd.store); VPS rapat hanya menjalankan LiveKit + Caddy + Redis.

```
Browser ──HTTPS──▶ spkd.store (RuangKerja)  ── token JWT (POST /rapat/{id}/video/token)
   │                        ▲
   │ WSS (sinyal)           │ webhook kehadiran (POST /api/livekit/webhook, bertanda tangan)
   ▼                        │
livekit.spkd.store ─────────┘    VPS rapat: Caddy (443, TLS otomatis) → LiveKit :7880
   ▲ media WebRTC: UDP 50000–60000 (utama) · TCP 7881 · TURN/UDP 3478 + relay 30000–40000 · TURN/TLS turn.spkd.store:443 (cadangan)
```

## 1. Kebutuhan

| Hal | Nilai |
|---|---|
| VPS | 4 vCPU **eksklusif**, 8 GB RAM, 40 GB SSD, IPv4 statis, port 1 Gbps tanpa kuota trafik (rapat 20 orang 720p ±60 Mbps keluar). Rekaman (Egress) **tidak** dipasang. |
| DNS | `livekit.spkd.store` (sinyal/WSS) dan `turn.spkd.store` (TURN/TLS) → A record ke IP VPS rapat. Pasang **sebelum** menjalankan server agar Caddy mendapat sertifikat. |
| Firewall (Security Group Biznet + `ufw`) | masuk **80/tcp** (ACME), **443/tcp** (WSS + TURN/TLS), **7881/tcp** (WebRTC lewat TCP), **3478/udp** (TURN/UDP), **50000–60000/udp** (media), **30000–40000/udp** (relay TURN; tanpa ini peserta yang memakai TURN tidak mendapat media). Port 7880 **tidak** dibuka (hanya Caddy lokal). SSH dibatasi ke IP admin. |

> **Terpasang 7 Okt 2026** di server rapat `103.125.181.244` (Ubuntu 24.04, 8 vCPU, 15 GB): `/opt/livekit` (Caddy L4 + LiveKit 1.13.8, tanpa Redis karena satu node), service `livekit-docker`, `ufw` + Security Group membuka port di atas, `net.core.rmem_max/wmem_max=16777216`. Uji `lk load-test` dari Mac (1 publisher, 2 subscriber, 20 detik): 1,2 Mbps per subscriber, packet loss 0%.
| Jam | NTP aktif di kedua VPS (`timedatectl` → `System clock synchronized: yes`). Webhook ditolak bila selisih jam > 5 menit. |

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
- Redis: bawaan (lokal) boleh dipakai.
- Cara pasang: **VM / startup script** (bukan Kubernetes).

Generator mencetak **API key** dan **API secret** — simpan di pengelola sandi; keduanya dipakai aplikasi (§4) dan tidak boleh di-commit. Ia juga membuat folder `livekit.spkd.store/` berisi `init_script.sh`, `docker-compose.yaml`, `livekit.yaml`, `caddy.yaml`, `redis.conf`. Jalankan skrip pemasangnya:

```bash
cd livekit.spkd.store
sudo bash init_script.sh
```

Hasilnya (sesuai yang dipakai pemilik):

- folder **`/opt/livekit`**: `caddy.yaml`, `livekit.yaml`, `docker-compose.yaml`, `redis.conf`;
- unit systemd **`livekit-docker`** yang menjalankan `docker compose` di folder itu (start otomatis saat boot).

```bash
sudo systemctl status livekit-docker
sudo docker ps            # caddy, livekit, redis
curl -s https://livekit.spkd.store   # → OK
```

Isi `livekit.yaml` dari generator sudah tepat untuk produksi dan **tidak perlu diubah** kecuali menambah webhook: `rtc.use_external_ip: true` (alamat publik diumumkan ke peserta), `rtc.port_range_start/end: 50000/60000`, `rtc.tcp_port: 7881`, `turn.enabled: true` dengan `domain: turn.spkd.store`, `tls_port: 5349` (Caddy meneruskan `turn.spkd.store:443` ke sana lewat SNI, sehingga jaringan kantor/4G yang memblokir UDP tetap bisa masuk lewat 443) dan `udp_port: 3478`, `redis` lokal, `keys:` berisi pasangan kunci tadi.

## 3. Webhook kehadiran ke RuangKerja

Tambahkan blok ini di **`/opt/livekit/livekit.yaml`** (tingkat atas, sejajar `keys:`). `api_key` = **kunci yang sama** dengan di `keys:` (LiveKit menandatangani webhook dengan rahasia pasangannya; RuangKerja memverifikasinya dengan `LIVEKIT_API_SECRET`).

```yaml
webhook:
  api_key: <API_KEY>
  urls:
    - https://spkd.store/api/livekit/webhook
```

```bash
sudo systemctl restart livekit-docker
sudo docker logs -f livekit-livekit-1 2>&1 | grep -i webhook   # nama kontainer: lihat `docker ps`
```

Yang dicatat aplikasi: `participant_joined` / `participant_left` / `room_finished` → tabel `meeting_attendances` (detail rapat "N orang di ruang rapat", panel **Hadir di rapat video**, isian awal kehadiran notulen). `room_started` dan kejadian lain dijawab `200 {"status":"ignored"}`. Rute ini **tanpa sesi/CSRF**; keamanannya dari tanda tangan JWT (`Authorization`, klaim `sha256` = hash badan), umur token 5 menit, penolakan kejadian lebih tua dari 5 menit, dan id kejadian yang hanya diproses sekali. Batas laju 600/menit per IP.

Jawaban endpoint: `200` tercatat/diabaikan/duplikat · `401` tanda tangan salah (kunci/rahasia tidak cocok) · `404` aplikasi belum diisi `LIVEKIT_*` atau `FEATURE_MEETINGS=false` · `422` bukan JSON atau kejadian kedaluwarsa (cek jam).

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

Lalu deploy ulang / `php artisan optimize` (konfigurasi di-cache). Tidak ada perubahan lain:

- CSP `connect-src` otomatis menambah `wss://livekit.spkd.store` dan `https://livekit.spkd.store` dari `LIVEKIT_URL`; `Permissions-Policy` sudah mengizinkan mikrofon & berbagi layar untuk situs sendiri.
- `LIVEKIT_API_URL` dipakai server aplikasi untuk Room Service API (bisukan/keluarkan peserta oleh penyelenggara) lewat Caddy di 443.
- Selama `LIVEKIT_*` kosong, pilihan "Video RuangKerja" tidak muncul di formulir dan rapat video menampilkan catatan "belum disiapkan" (tanpa galat).

## 5. Uji

1. **Server saja** — dari laptop admin (CLI `lk`: `curl -sSL https://get.livekit.io/cli | bash`):

   ```bash
   lk token create --api-key <API_KEY> --api-secret <API_SECRET> \
     --join --room uji-koneksi --identity admin-uji --valid-for 1h
   ```

   Buka **https://livekit.io/connection-test**, isi URL `wss://livekit.spkd.store` dan token tadi → semua centang hijau: WebSocket, WebRTC (UDP), **TURN/UDP**, **TURN/TLS** (`turn.spkd.store:443`), publish audio/video. Ulangi dari jaringan seluler 4G dan Wi-Fi kantor.
2. **Aplikasi** — login sebagai penyelenggara, **Jadwalkan rapat** → Tempat rapat **Video RuangKerja** (bawaan) → undang satu orang. Detail rapat → **Gabung rapat video** → izinkan kamera/mikrofon → **Gabung sekarang**. Orang kedua bergabung dari perangkat lain (dalam jendela 15 menit sebelum mulai s.d. 2 jam sesudah selesai).
3. Detail rapat (orang ketiga atau tab lain) memperlihatkan "2 orang di ruang rapat" dalam ≤ 30 detik → **webhook jalan**. Bila tetap "Ruang rapat terbuka": lihat log LiveKit (`grep webhook`) dan log Laravel; `401` = kunci/rahasia beda, `422` = jam tidak sinkron.
4. Moderasi: penyelenggara membuka **Orang** → **Bisukan** peserta (mikrofonnya mati) → **Keluarkan** (peserta melihat "Penyelenggara mengeluarkan Anda dari rapat").
5. Berbagi layar dari Chrome desktop; chat; angkat tangan; putuskan Wi-Fi 10 detik → "Menyambungkan ulang…" lalu kembali.

## 6. Uji coba 1–2 minggu (catat)

Jeda suara (rasa), putus-sambung, CPU (`docker stats`, target < 60% untuk 20 orang), trafik keluar per jam (Biznet panel), kualitas di 4G, berapa peserta jatuh ke TURN/TLS (log LiveKit `turn`). Bandingkan dengan pertanyaan ke sales di §6a (FUP trafik, UDP tidak diblokir).

## 7. Operasional

- Perbarui LiveKit: ubah tag image di `/opt/livekit/docker-compose.yaml` → `sudo systemctl restart livekit-docker`. Baca catatan rilis dulu.
- Ganti kunci: tambah pasangan baru di `keys:` dan ubah `webhook.api_key`, isi `.env` aplikasi, deploy, baru hapus pasangan lama.
- Tidak ada data rapat di VPS rapat (chat tidak disimpan, tanpa rekaman). Kehadiran tersimpan di database aplikasi.
- Rekaman (Egress → object storage) dan transkrip = tahap berikutnya; wajib pemberitahuan "rapat direkam" dan retensi (UU PDP), lihat §6a.

## 8. Lokal

Lihat `docs/SETUP-LOKAL.md` › "Rapat video": LiveKit di `compose.yml` profil `video`, `herd proxy livekit … --secure` untuk `wss://livekit.test`.
