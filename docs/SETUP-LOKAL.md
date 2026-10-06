# Setup Lokal (Windows) & Kerja dengan Claude Code

Panduan ini menyiapkan laptop Windows untuk membangun RuangKerja dengan Claude Code, sampai aplikasi bisa dibuka di **https://ruangkerja.test** dan Claude Code bisa mengecek tampilannya langsung di Chrome.

## 0. Gambaran

```
Windows
├── Laravel Herd ............ PHP 8.4 + Composer + Node 22 + nginx → https://ruangkerja.test
├── Docker Desktop (WSL 2) .. postgres:17 · redis:7 · mailpit   (compose.yml)
├── Claude Code (native) .... membaca AGENTS.md/CLAUDE.md/docs, menjalankan perintah lewat Git Bash
└── Chrome + ekstensi Claude  Claude Code membuka localhost, mengambil screenshot, membaca console
```

Kenapa begini:
- **Herd** membuat PHP di Windows tanpa repot, dan situs `.test` + HTTPS lokal langsung jalan.
- **Docker hanya untuk database & layanan.** Versi Postgres/Redis sama dengan server Biznet Gio.
- **Claude Code native (bukan WSL)** supaya integrasi Chrome bisa dipakai. Integrasi Chrome tidak didukung di WSL.
- **HTTPS lokal wajib.** Fitur GPS dan kamera (check-in) hanya diizinkan browser di *secure context*. `http://ruangkerja.test` akan diblokir, sedangkan `https://ruangkerja.test` boleh.

> Alternatif (opsional): seluruh stack di WSL 2 Ubuntu + Claude Code di dalam WSL. Lebih mirip server, tetapi integrasi Chrome tidak tersedia. Untuk cek UI, pakai Playwright. Tidak dibahas di sini.

## 1. Pasang sekali (±45 menit)

| # | Aplikasi | Cara | Cek |
|---|---|---|---|
| 1 | **Git for Windows** | https://git-scm.com/downloads/win (pilihan default). Memberi Git Bash untuk Claude Code | `git --version` |
| 2 | **Laravel Herd** (gratis) | https://herd.laravel.com/windows → buka Herd → *PHP*: pasang & jadikan default **8.4** → *Node*: pasang **22 LTS** | `php -v`, `composer -V`, `node -v` |
| 3 | **Docker Desktop** | https://www.docker.com/products/docker-desktop → aktifkan backend **WSL 2** → jalankan sampai status *Running* | `docker info` |
| 4 | **Google Chrome** + ekstensi **Claude** | Chrome Web Store: "Claude" (Anthropic), login dengan akun Claude yang sama | ikon Claude di toolbar |
| 5 | **Claude Code** | PowerShell: `irm https://claude.ai/install.ps1 | iex` → buka terminal baru → `claude` lalu login (butuh paket Pro/Max/Team/Enterprise) | `claude --version`, `claude doctor` |
| 6 | Editor (opsional) | VS Code / Cursor + ekstensi Claude Code, PHP Intelephense, Tailwind CSS IntelliSense | — |

Ekstensi PHP yang wajib aktif di Herd (Herd → PHP → *Open php.ini*): `pdo_pgsql`, `pgsql`, `intl`, `mbstring`, `zip`, `fileinfo`, `openssl`, `gd`. Restart Herd setelah mengubah.

Bila Claude Code tidak menemukan Git Bash, tambahkan di `%USERPROFILE%\.claude\settings.json`:
```json
{ "env": { "CLAUDE_CODE_GIT_BASH_PATH": "C:\\Program Files\\Git\\bin\\bash.exe" } }
```

## 2. Siapkan folder proyek

1. Letakkan proyek di folder lokal, mis. **`C:\Users\Admin\ruang-kerja`** (atau di `C:\Users\<nama>\Herd\` yang otomatis disajikan Herd). Folder di luar `Herd\` disajikan lewat `herd link` (langkah 4). **Jangan** di OneDrive/Google Drive (watcher file & lock bermasalah).
2. Ekstrak isi kit ini ke folder tersebut (sudah berisi `AGENTS.md`, `CLAUDE.md`, `.claude/`, `docs/`, `compose.yml`, `.env.example`, `scripts/`).
   Bila kit disalin langsung oleh asisten Claude (bukan dari zip), folder `.claude/` belum ada dan isinya ada di `claude-setup/`. Jalankan sekali: `powershell -ExecutionPolicy Bypass -File .\scripts\pasang-claude.ps1`. Skrip ini memindahkan isinya ke `.claude/`.
3. PowerShell di folder proyek:
   ```powershell
   git init -b main
   git add .
   git commit -m "chore: dokumen & konfigurasi awal RuangKerja"
   powershell -ExecutionPolicy Bypass -File .\scripts\cek-lingkungan.ps1
   ```
   Bereskan semua baris berstatus **PERLU** sebelum lanjut.
4. Daftarkan situs ke Herd dan aktifkan HTTPS lokal. Folder di luar `Herd\` (mis. `C:\Users\Admin\ruang-kerja`) cukup di-*link* dengan nama `ruangkerja`:
   ```powershell
   herd link ruangkerja      # jalankan DI DALAM folder proyek → https://ruangkerja.test
   herd secure ruangkerja
   ```
5. Siapkan `.env` dan nyalakan layanan:
   ```powershell
   copy .env.example .env
   docker compose up -d
   docker compose ps     # postgres, redis, mailpit harus "healthy"/"running"
   ```
   Database `ruangkerja` dan `ruangkerja_testing` dibuat otomatis.

## 3. Mulai dengan Claude Code

```powershell
cd C:\Users\Admin\ruang-kerja
claude --chrome
```

Pertama kali:
1. Claude Code menanyakan apakah Anda **mempercayai folder** ini. Jawab ya, supaya `.claude/settings.json` (izin perintah) dan skill proyek aktif.
2. Jalankan `/status` untuk memastikan *Setting sources* memuat file proyek. Jalankan `/chrome` untuk memastikan *Status: Enabled* dan *Extension: Installed*. Pilih **Enabled by default** bila ingin selalu terhubung.
3. Jalankan **`/cek-lokal`**.
4. Jalankan **`/sprint 0`**. Claude Code membuat kerangka Laravel 13 + React di repo ini tanpa menimpa dokumen, memasang paket, migrasi, seeder demo, lalu membuka `https://ruangkerja.test` di Chrome untuk mengecek tampilan.

Perintah khusus yang tersedia (folder `.claude/skills/`):

| Perintah | Fungsi |
|---|---|
| `/sprint <n>` | Menjalankan sprint ke-n dari `docs/PROMPTS.md`: rencana → bangun desktop & mobile → test → cek UI → ringkasan |
| `/cek-ui <rute/layar>` | Membuka halaman di localhost (1440 & 390 px, terang & gelap), membandingkan dengan mockup di `docs/mockups/`, lalu memperbaiki |
| `/cek-lokal` | Memeriksa Herd, PHP, Docker, `.env`, migrasi, Reverb, antrean, email |
| `/tinjau [base]` | Review perubahan branch terhadap `main` (hanya laporan) |

Izin perintah (`.claude/settings.json`): test, lint, `php artisan`, `npm run`, git lokal, dan `docker compose up/ps/logs` berjalan tanpa bertanya. `git push`, `composer require`, `npm install`, `migrate:fresh`, dan `docker compose down` selalu ditanyakan dulu. Isi `.env` tidak boleh dibaca Claude Code.

## 4. Menjalankan aplikasi setiap hari

```powershell
docker compose up -d        # layanan
composer run dev:win        # Vite + Reverb + queue:work + schedule:work (dibuat di Sprint 0)
```

| Alamat | Isi |
|---|---|
| https://ruangkerja.test | Aplikasi (disajikan Herd) |
| https://ruangkerja.test/login | Pilih akun demo: `admin@`, `direksi@`, `hr@`, `kadiv@`, `anggota@demo.test` · sandi `password` |
| http://localhost:8025 | Mailpit (email keluar) |
| wss://ruangkerja.test:8080 | Reverb (realtime, memakai sertifikat Herd) |
| localhost:5432 / 6379 | Postgres / Redis (pakai TablePlus, DBeaver, dll.) |

Catatan Windows: **Horizon tidak berjalan di Windows** (butuh ekstensi `pcntl`). Di lokal antrean diproses `php artisan queue:work`. Di server Linux tetap memakai Horizon. `php artisan pail` juga tidak tersedia di Windows. Pakai `storage/logs/laravel.log` atau Laravel Herd → Dumps/Logs.

## 5. Menguji tampilan mobile, GPS, dan kamera

- **Di laptop:** Chrome DevTools → *Toggle device toolbar* (390×844). Lokasi palsu: DevTools → ⋮ → More tools → **Sensors** → *Location*. Kamera memakai webcam laptop.
- **Di HP sungguhan** (disarankan untuk check-in):
  1. `npm run build` (aset statis, supaya tidak bergantung Vite dev server).
  2. Buat tunnel HTTPS publik sementara:
     - `herd share`, atau
     - `cloudflared tunnel --url https://ruangkerja.test --http-host-header ruangkerja.test --no-tls-verify`.
  3. Buka URL tunnel di HP. Matikan tunnel setelah selesai karena data lokal ikut terbuka.
- Untuk Reverb di HP via tunnel, realtime boleh dimatikan sementara (aplikasi jatuh ke polling 30 detik).

## 6. Login Google di lokal

Google OAuth **tidak menerima** redirect ke domain `.test`. Kecuali `localhost`, alamat redirect harus memakai TLD publik. Pilihan:
- **Sehari-hari:** pakai login demo (`DEMO_LOGIN_ENABLED=true`, hanya `APP_ENV=local`).
- **Saat menguji integrasi Google (Sprint 1 & 7):** jalankan `php artisan serve --port=8000`, set `APP_URL=http://localhost:8000`, lalu daftarkan redirect `http://localhost:8000/auth/google/callback` di Google Cloud Console. Kembalikan `APP_URL` setelah selesai.
- Simpan file service account di `secrets/google-sa.json` (folder sudah di-ignore git) dan isi `GOOGLE_SERVICE_ACCOUNT_JSON` dengan path lengkapnya.

## 7. Memakai Z-AI berdampingan

- Bila Z-AI dipakai lewat agent yang membaca repo (CLI/IDE), ia membaca `AGENTS.md`. Jalankan pada **branch terpisah** dari Claude Code, misalnya `feat/sprint-3-kiosk` vs `feat/sprint-4-approval`, supaya tidak saling menimpa.
- Bila lewat chat web, pakai *Prompt 0* di `docs/PROMPTS.md` dan tempel hasilnya lewat Claude Code / editor.
- Jalankan `/tinjau` di Claude Code untuk hasil kerja Z-AI sebelum merge.

## 8. Masalah umum

| Gejala | Penyebab & solusi |
|---|---|
| `could not find driver` | Ekstensi `pdo_pgsql` belum aktif di php.ini Herd → aktifkan, restart Herd |
| `Connection refused` ke 5432/6379 | Docker Desktop belum jalan → buka Docker Desktop, `docker compose up -d` |
| Port 5432 sudah dipakai | Ada PostgreSQL Windows terpasang → hentikan servisnya, atau set `DB_FORWARD_PORT=5433` dan `DB_PORT=5433` |
| `ruangkerja.test` tidak terbuka | Folder bukan di `C:\Users\<nama>\Herd\` → pindahkan, atau `herd link ruangkerja` dari dalam folder |
| GPS/kamera ditolak di browser | Akses lewat `http://` → jalankan `herd secure ruangkerja`, pakai `https://` |
| Aset Vite gagal dimuat di https (mixed content) | Pastikan `laravel-vite-plugin` terbaru (deteksi sertifikat Herd otomatis). Bila perlu, set `detectTls: 'ruangkerja.test'` di `vite.config.ts` |
| Realtime tidak jalan | Reverb belum dijalankan (`composer run dev:win`) atau port 8080 dipakai aplikasi lain |
| Claude Code tidak bisa membuka Chrome | `/chrome` → *Reconnect extension*. Pastikan login Claude Code via `/login` (bukan API key). Restart Chrome sekali setelah pemasangan pertama |
| Skrip `.sh` gagal karena `\r` | Akhir baris CRLF → repo memakai `.gitattributes` (LF). Jalankan `git add --renormalize .` |
| Claude Code minta izin terus untuk perintah yang sama | Folder belum di-*trust* → keluar, masuk lagi, pilih trust. Cek `/status` |

## 9. Checklist siap mulai

- [ ] `scripts\cek-lingkungan.ps1` semua OK
- [ ] `herd secure ruangkerja` sudah dijalankan
- [ ] `docker compose ps` → 3 layanan sehat
- [ ] `claude --chrome` → `/chrome` Enabled, `/status` memuat `.claude/settings.json`
- [ ] `/cek-lokal` tanpa temuan kritis
- [ ] `/sprint 0` selesai → https://ruangkerja.test menampilkan layout terang/gelap, desktop & mobile

## 10. Catatan macOS

Alur sama dengan Windows; bedanya:

| Komponen | macOS |
|---|---|
| PHP 8.4 + nginx | **Laravel Herd for macOS**. Di dalam folder proyek: `herd link ruangkerja && herd secure ruangkerja` → https://ruangkerja.test |
| Docker | **OrbStack** (ringan) atau Docker Desktop. Perintahnya tetap `docker compose up -d` |
| Node 22 | lewat **nvm**: `nvm install 22 && nvm use 22` |
| `.env` | `cp .env.example .env` (bukan `copy`). Skrip `scripts/*.ps1` khusus Windows, lewati saja |

**Port bentrok.** Di Mac pengembang, port 5432/6379/1025/8025/8080 sudah dipakai aplikasi lain, jadi `.env` lokal memakai port pengganti (sisi Docker ikut lewat variabel `*_FORWARD_PORT` di `compose.yml`):

```dotenv
DB_PORT=5434
DB_FORWARD_PORT=5434
REDIS_PORT=6380
REDIS_FORWARD_PORT=6380
MAIL_PORT=1026
MAIL_FORWARD_PORT=1026
MAILPIT_UI_PORT=8026
REVERB_PORT=8081
REVERB_SERVER_PORT=8081
```

Dengan nilai ini Mailpit ada di http://localhost:8026 dan Reverb di wss://ruangkerja.test:8081. Bila port default di Mac Anda kosong, nilai bawaan `.env.example` bisa dipakai apa adanya. Setelah mengubah port, jalankan `docker compose up -d` lagi dan `php artisan config:clear`.

**Menjalankan aplikasi.** Horizon (butuh `pcntl`) dan `php artisan pail` **berjalan di macOS**, jadi `composer run dev` (server + horizon + reverb + vite) bisa dipakai. `composer run dev:win` (vite + reverb + queue:work + schedule:work) juga jalan di Mac bila ingin setara dengan Windows. Aplikasi tetap dibuka lewat https://ruangkerja.test (Herd).

### Reverb lewat HTTPS (Windows & macOS)

Aplikasi disajikan di `https://ruangkerja.test`, dan browser selalu memaksa `wss://` dari halaman HTTPS. Karena itu Reverb lokal harus memakai TLS:

- `.env`: `REVERB_HOST=ruangkerja.test` dan `REVERB_SCHEME=https` (nilai bawaan `.env.example`).
- Pastikan situs sudah di-*secure* (`herd secure ruangkerja`). `php artisan reverb:start` lalu menampilkan "Starting secure server … (ruangkerja.test)" karena memakai sertifikat Herd otomatis.
- Setelah mengubah nilai `REVERB_*`, jalankan `php artisan config:clear` dan build ulang aset (`npm run build`) atau restart `npm run dev`, karena nilai `VITE_REVERB_*` dibaca saat build.
- Cek cepat tanpa browser: `curl --http1.1 -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" "https://ruangkerja.test:8081/app/<REVERB_APP_KEY>?protocol=7"` harus menjawab `101`.

## 11. Bergantian dengan Codex

Repo ini siap dikerjakan Claude Code dan Codex bergantian (mis. saat kuota salah satu habis). Aturan bersama ada di `AGENTS.md` (dibaca Codex langsung; Claude Code lewat `CLAUDE.md`).

1. Sekali saja: jalankan `codex` di folder proyek (checkout utama, mis. `/Users/godam/PROYEK/ruang-kerja`) dan pilih **trust** agar `.codex/config.toml` proyek dipakai (sandbox `workspace-write` + jaringan lokal untuk Postgres/Redis/Herd). Skill proyek tersedia sebagai `$sprint`, `$cek-ui`, `$cek-lokal`, `$tinjau` (dari `.agents/skills/`).
2. Sebelum berpindah, minta agen yang sedang dipakai: "perbarui docs/SESI-AKTIF.md lalu commit". Pekerjaan setengah jadi di-commit sebagai `wip(...)`.
3. Di agen berikutnya, buka sesi di folder/branch yang sama lalu tulis: "Lanjutkan pekerjaan dari docs/SESI-AKTIF.md."
4. Pekerjaan di worktree `.claude/worktrees/*` milik sesi Claude Code; Codex sebaiknya bekerja di checkout utama atau worktree-nya sendiri. Merge ke `main` sebelum berpindah bila memungkinkan.
5. Cek tampilan tanpa Chrome: `node scripts/ui-shots.mjs /rute --akun kadiv@demo.test` (screenshot 1440/390 terang & malam di `storage/app/ui-shots/`).
6. Skill proyek diedit di `.agents/skills/` saja, lalu `node scripts/sync-agent-skills.mjs`.

