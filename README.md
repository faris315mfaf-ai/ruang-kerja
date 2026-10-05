# RuangKerja

Aplikasi kantor internal: **absensi, pengajuan & persetujuan, workspace, kolaborasi tugas, serta monitoring kerja berbasis output** dalam satu tempat. Terintegrasi dengan Google Workspace (login, Drive, Docs).

> "RuangKerja" adalah nama kode. Ganti nama, logo, dan warna di `config/branding.php` dan `resources/css/tokens.css`.

## Daftar isi

1. [Dokumentasi](#dokumentasi) · 2. [Teknologi](#teknologi) · 3. [Pengembangan lokal](#pengembangan-lokal) · [Google Workspace](#menyiapkan-google-workspace) · 4. [Perintah sehari-hari](#perintah-sehari-hari) · 5. [Uji](#uji) · 6. [Deploy ke VPS (dari nol)](#deploy-ke-vps-biznet-gio-dari-nol) · 7. [Deploy berikutnya & rollback](#deploy-berikutnya--rollback) · 8. [Backup & pemulihan](#backup--pemulihan) · 9. [Observabilitas & keamanan](#observabilitas--keamanan) · [Privasi](#privasi-uu-pdp) · [Kinerja](#kinerja) · 10. [Troubleshooting](#troubleshooting) · [Skill desain & animasi](#skill-claude-code-untuk-desain--animasi)

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | Serah terima Fase 1: status sprint, akun demo, keputusan yang menunggu pemilik |
| [`docs/CRITICAL.md`](docs/CRITICAL.md) | **Hal kritis**: invariant yang tidak boleh rusak, area keamanan, rahasia, backup, checklist go-live |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Riwayat perubahan per sprint (format Keep a Changelog) |
| [`docs/PRD.md`](docs/PRD.md) | Kebutuhan produk, fase, user story, metrik |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Skema tabel, ERD, query metrik |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arsitektur, struktur folder, integrasi Google, deploy |
| [`docs/DESIGN.md`](docs/DESIGN.md) · [`docs/PLATFORM.md`](docs/PLATFORM.md) | Design system; pemisahan tampilan desktop & mobile |
| [`docs/SETUP-LOKAL.md`](docs/SETUP-LOKAL.md) | Setup lokal lengkap (Windows + catatan macOS), Claude Code + Chrome |
| [`docs/security/ASVS-L1.md`](docs/security/ASVS-L1.md) | Checklist OWASP ASVS L1 + temuan |
| [`docs/mockups/INDEX.md`](docs/mockups/INDEX.md) | Mockup layar desktop & mobile |
| [`docs/PROMPTS.md`](docs/PROMPTS.md) · [`docs/sprints/`](docs/sprints/) | Prompt & ringkasan per sprint |
| [`AGENTS.md`](AGENTS.md) · [`CLAUDE.md`](CLAUDE.md) | Aturan proyek untuk AI coding tool |

Super Admin juga bisa membaca dokumen-dokumen ini di aplikasi: **Admin › Dokumentasi** (`/admin/dokumentasi`). Daftarnya diatur di `config/docs.php`.

## Teknologi

| Lapisan | Pilihan |
|---|---|
| Backend | PHP 8.4, Laravel 13, PostgreSQL 17, Redis 7, Fortify (sandi + 2FA khusus Super Admin), Socialite (login Google), spatie/laravel-permission, maatwebsite/excel |
| Google | Klien Drive v3 tipis berbasis HTTP (bukan google/apiclient, lihat `docs/sprints/sprint-7/GOOGLE-API.md`) |
| Frontend | Inertia.js 3 + React 19 + TypeScript (strict), Tailwind CSS 4, shadcn/ui, TanStack Table, dnd-kit, Wayfinder |
| Realtime / antrean | Laravel Reverb + Echo · Horizon (Redis) · Scheduler |
| Penyimpanan | S3-compatible (Biznet Gio NEO Object Storage) untuk file privat & backup; Google Drive untuk file kerja |
| Kualitas | Pest 4, Larastan level 8, Pint, Vite+ (`vp`: oxlint + oxfmt + Vitest), Playwright (uji visual) |
| Produksi | Docker Compose: Caddy (HTTPS otomatis) + FrankenPHP, Horizon, Scheduler, Reverb, Postgres, Redis, backup (pg_dump + rclone) |
| Observabilitas | Laravel Pulse, Horizon, Sentry (opsional), `/up` & `/health` |

## Pengembangan lokal

Aplikasi PHP dijalankan **Laravel Herd** di https://ruangkerja.test (HTTPS wajib: GPS & kamera hanya jalan di *secure context*). Postgres, Redis, dan Mailpit berjalan di Docker (`compose.yml`). Panduan lengkap: [`docs/SETUP-LOKAL.md`](docs/SETUP-LOKAL.md).

### Windows

Prasyarat: Git for Windows, Laravel Herd (PHP 8.4 + Node 22), Docker Desktop (WSL 2).

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\cek-lingkungan.ps1
herd link ruangkerja; herd secure ruangkerja      # di dalam folder proyek
copy .env.example .env
docker compose up -d                              # postgres, redis, mailpit
composer install
php artisan key:generate
php artisan migrate --seed
npm install
php artisan wayfinder:generate --with-form
composer run dev:win                              # vite + reverb + queue:work + schedule:work
```

### macOS

Prasyarat: Laravel Herd for macOS, OrbStack atau Docker Desktop, Node 22 (nvm).

```bash
herd link ruangkerja && herd secure ruangkerja
cp .env.example .env               # bila port 5432/6379/... sudah dipakai: lihat SETUP-LOKAL §10
docker compose up -d
composer install && php artisan key:generate
php artisan migrate --seed
npm install && php artisan wayfinder:generate --with-form
composer run dev                    # server + horizon + reverb + vite
```

Buka https://ruangkerja.test. **Akun demo** (hanya `APP_ENV=local` + `DEMO_LOGIN_ENABLED=true`, tombol "Masuk cepat" di halaman login): `admin@`, `direksi@`, `hr@`, `kadiv@`, `anggota@demo.test` · sandi `password`.

| Alamat lokal (bawaan) | Isi |
|---|---|
| https://ruangkerja.test | Aplikasi |
| https://ruangkerja.test/horizon · /pulse | Dashboard antrean & kinerja (super_admin; Horizon terbuka untuk semua di `local`) |
| http://localhost:8025 | Mailpit |
| localhost:5432 / 6379 | Postgres / Redis |

## Menyiapkan Google Workspace

1. **Google Cloud Console** → buat proyek → aktifkan **Google Drive API**, **Google Picker API**, **Admin SDK API** (opsional), dan **Google Calendar API** (Fase 2).
2. **OAuth consent screen** → tipe **Internal** (hanya akun di domain Anda).
3. **OAuth Client ID** (Web) → redirect URI `https://<domain-app>/auth/google/callback` (login) **dan** `https://<domain-app>/google/connect/callback` (hubungkan Drive untuk Picker), JavaScript origin `https://<domain-app>`. Scope: `openid email profile` + `https://www.googleapis.com/auth/drive.file`. Buat juga **API key** untuk Google Picker → `GOOGLE_PICKER_API_KEY`.
4. **Service Account** → buat kunci JSON → simpan sebagai secret (jangan di-commit). Di server produksi taruh di volume `storage` (mis. `docker compose -f compose.prod.yml cp google-sa.json app:/app/storage/app/private/google-sa.json`) dan isi `GOOGLE_SERVICE_ACCOUNT_JSON=/app/storage/app/private/google-sa.json`.
5. **Admin Console** → Security → API controls → **Domain-wide delegation** → tambahkan Client ID service account dengan scope `https://www.googleapis.com/auth/drive` (dan `calendar` di Fase 2).
6. Buat **Shared Drive** "RuangKerja", tambahkan akun impersonasi sebagai *Manager*, salin ID-nya ke `GOOGLE_SHARED_DRIVE_ID`.
7. Jalankan `php artisan ruangkerja:google-check --write` untuk menguji koneksi. Rincian: [`docs/sprints/sprint-7/GOOGLE-API.md`](docs/sprints/sprint-7/GOOGLE-API.md) §8.

## Perintah sehari-hari

```bash
composer run dev            # macOS/Linux: server + horizon + reverb + vite
composer run dev:win        # Windows: vite + reverb + queue:work + schedule:work
composer test               # Pest (paralel)
composer lint               # Pint + Larastan level 8   (perbaiki format: composer lint:fix)
npm run typecheck           # tsc --noEmit
npm run lint                # vp check (oxlint + oxfmt)  (perbaiki: npm run lint:fix)
npm test                    # Vitest
npm run test:e2e            # uji visual Playwright (lihat tests/e2e/README.md)
php artisan migrate:fresh --seed                 # reset database lokal + data demo
php artisan wayfinder:generate --with-form       # setelah menambah route/controller
php artisan ruangkerja:google-check --write      # uji koneksi Google (service account, Shared Drive)
```

## Uji

- `composer test`, `composer lint`, `npm run typecheck`, `npm run lint`, `npm test` wajib hijau sebelum merge (CI: `.github/workflows/ci.yml`, juga membangun image Docker dan memvalidasi `compose.prod.yml`).
- Uji visual Playwright **tidak** termasuk `npm test`: 375/834/1440 px × terang/gelap untuk `/dashboard` & `/menu`. Sekali per mesin: `npx playwright install chromium`, lalu `npm run test:e2e:baseline` dan `npm run test:e2e`. Detail: [`tests/e2e/README.md`](tests/e2e/README.md).

## Deploy ke VPS (Biznet Gio) dari nol

Topologi (`compose.prod.yml`, ARCHITECTURE §6): `caddy` (80/443, TLS otomatis) → `app` (FrankenPHP :8000) dan `reverb` (:8080, path `/app` & `/apps`); `queue` (Horizon), `scheduler`, `postgres:17`, `redis:7`, `backup`. Hanya Caddy yang membuka port.

### 1. Siapkan server (sekali)

VPS Ubuntu 24.04, minimal **4 vCPU / 8 GB RAM / 80 GB SSD**. Arahkan DNS `A` domain aplikasi (mis. `absensi.perusahaan.co.id`) ke IP VPS.

```bash
# sebagai root
adduser --disabled-password --gecos "" deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh
curl -fsSL https://get.docker.com | sh            # Docker Engine + compose plugin
usermod -aG docker deploy
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw --force enable
mkdir -p /opt/ruangkerja/docker/caddy && chown -R deploy:deploy /opt/ruangkerja
timedatectl set-timezone UTC
```

> Docker menulis aturan iptables sendiri; karena hanya Caddy yang mem-publish port, Postgres/Redis tetap tertutup dari luar.

### 2. Siapkan object storage

Di Biznet Gio NEO Object Storage buat **dua bucket**: `ruangkerja-private` (selfie/lampiran aplikasi) dan `ruangkerja-backup` (dump database), masing-masing dengan access key sendiri. Catat endpoint S3-nya.

### 3. Siapkan GitHub

1. *Settings → Environments → New environment* `production` → **Required reviewers** (approval manual). Tambahkan environment secrets:
   - `DEPLOY_SSH_KEY`: private key ed25519 khusus deploy (public key-nya di `/home/deploy/.ssh/authorized_keys`).
   - `DEPLOY_KNOWN_HOSTS`: hasil `ssh-keyscan -p 22 <ip-vps>`.
2. *Settings → Secrets and variables → Actions → Variables*: `APP_DOMAIN`, `REVERB_APP_KEY` (sama dengan `.env` server), `DEPLOY_HOST`, `DEPLOY_USER` (`deploy`), opsional `DEPLOY_PORT`, `DEPLOY_PATH` (`/opt/ruangkerja`), `APP_NAME`.
3. Image dipush ke GHCR (`ghcr.io/<org>/ruangkerja` dan `ruangkerja-backup`). Workflow deploy login ke GHCR di server memakai token job yang berumur pendek, jadi package boleh tetap privat.

### 4. Isi `.env` produksi di server

```bash
# di laptop: salin template & berkas stack
scp .env.production.example compose.prod.yml deploy@<ip-vps>:/opt/ruangkerja/
scp docker/caddy/Caddyfile deploy@<ip-vps>:/opt/ruangkerja/docker/caddy/
# di server
cd /opt/ruangkerja && cp .env.production.example .env && chmod 600 .env && nano .env
```

Isi setiap `<...>`: `APP_IMAGE`/`BACKUP_IMAGE` (huruf kecil), `APP_DOMAIN`, `ACME_EMAIL`, `APP_URL`, sandi acak (`openssl rand -hex 24`) untuk `DB_PASSWORD`, `REDIS_PASSWORD`, `REVERB_APP_SECRET`, `ATTENDANCE_QR_SECRET`, kredensial `AWS_*` dan `BACKUP_S3_*`, SMTP, Google. `APP_KEY` dibuat setelah image tersedia (langkah 5). Nilai berisi spasi wajib diberi tanda kutip ganda.

### 5. Deploy pertama

1. Push ke `main` (atau *Actions → Deploy → Run workflow*). Workflow menunggu CI hijau, membangun & mem-push image, lalu **menunggu approval** di environment `production`.
2. Sebelum menyetujui, buat `APP_KEY` di server lalu tempel ke `.env`:
   ```bash
   docker login ghcr.io                 # bila package privat: pakai PAT read:packages, sekali saja
   docker run --rm --entrypoint php ghcr.io/<org>/ruangkerja:latest artisan key:generate --show
   ```
3. Setujui deploy. `scripts/deploy-remote.sh` menjalankan: pin `APP_TAG` → `docker compose pull` → `up -d --wait` → `php artisan migrate --force` → `php artisan db:seed --force` (peran & izin) → `php artisan horizon:terminate`. Workflow lalu memanggil `https://<domain>/health`.
4. Buat Super Admin pertama, lalu login dengan sandi di `https://<domain>/login`; aplikasi mewajibkan penyiapan 2FA (TOTP) sebelum fitur lain bisa dipakai, lalu ganti sandi sementara:
   ```bash
   cd /opt/ruangkerja
   docker compose -f compose.prod.yml exec app php artisan ruangkerja:create-super-admin it@perusahaan.co.id --name="Admin Sistem" --company="PT Perusahaan" --generate-password
   ```
5. Verifikasi: `curl -s https://<domain>/health` → `{"status":"ok",...}`; `https://<domain>/horizon` (super_admin); uji restore pertama (bagian 8).

Deploy manual tanpa GitHub (mis. staging): di server, `DEPLOY_PATH=/opt/ruangkerja APP_TAG=<tag> bash deploy-remote.sh` (salin `scripts/deploy-remote.sh` ke server).

## Deploy berikutnya & rollback

- Setiap push ke `main` yang CI-nya hijau → build image (tag = SHA commit + `latest`) → approval → deploy. Riwayat tag ada di `/opt/ruangkerja/.deploy-history`.
- **Rollback** ke versi sebelumnya (migrasi dibuat kompatibel ke belakang):
  ```bash
  cd /opt/ruangkerja && DEPLOY_PATH=$PWD APP_TAG=<sha-sebelumnya> bash deploy-remote.sh
  ```
- Setelah mengubah `.env` di server: `docker compose -f compose.prod.yml up -d --force-recreate` (config di-cache saat kontainer start).
- Perintah berguna: `docker compose -f compose.prod.yml ps`, `... logs -f app queue`, `... exec app php artisan tinker`, `... exec app php artisan down`/`up`.

## Backup & pemulihan

- Kontainer `backup` menjalankan `scripts/backup.sh` setiap hari **02.00 WIB** (`BACKUP_SCHEDULE`): `pg_dump` format custom → cek `pg_restore --list` → unggah ke `BACKUP_S3_BUCKET/BACKUP_S3_PREFIX` lewat rclone → hapus dump remote > **30 hari** (`BACKUP_RETENTION_DAYS`) dan lokal > 7 hari. `BACKUP_HEARTBEAT_URL` (opsional, mis. healthchecks.io) dipanggil saat sukses dan `/fail` saat gagal.
- Backup manual: `docker compose -f compose.prod.yml exec backup backup.sh`
- Daftar dump: `docker compose -f compose.prod.yml exec backup rclone lsl backup:<bucket>/postgres`

### Uji pemulihan bulanan (wajib, PRD §8)

Dijalankan di server produksi (atau staging) ke database sementara; database aktif tidak disentuh:

```bash
cd /opt/ruangkerja
docker compose -f compose.prod.yml exec backup \
  restore.sh --latest --target ruangkerja_restore_test --create --compare ruangkerja --drop-after
```

Skrip mengunduh dump terbaru, memulihkannya, memverifikasi jumlah tabel sama dengan isi arsip, menampilkan jumlah baris `migrations` & `users`, membandingkan jumlah baris per tabel dengan database aktif (selisih wajar hanya pada tabel yang ditulis setelah backup, mis. `pulse_*`, `sessions`), lalu menghapus database sementara. Catat hasilnya (tanggal, nama dump, "restore verified") di log operasional.

### Pemulihan saat bencana

```bash
cd /opt/ruangkerja
docker compose -f compose.prod.yml stop app queue scheduler reverb
docker compose -f compose.prod.yml exec backup restore.sh --latest --yes        # atau --remote <nama-file.dump>
docker compose -f compose.prod.yml start app queue scheduler reverb
```

Server baru dari nol: ikuti bagian 6 langkah 1–5 (tanpa membuat Super Admin), lalu jalankan perintah di atas.

## Observabilitas & keamanan

- `GET /up` (bawaan Laravel) dan `GET /health` (JSON: status Postgres & Redis + versi, 503 bila ada yang mati, tanpa sesi/cookie) untuk uptime monitor.
- `/horizon` dan `/pulse` hanya untuk **super_admin**.
- Sentry: isi `SENTRY_LARAVEL_DSN` (dan `SENTRY_TRACES_SAMPLE_RATE` bila perlu). Kosong = nonaktif. PII tidak dikirim.
- Header keamanan & CSP dipasang aplikasi (`app/Http/Middleware/SecurityHeaders.php`, `config/security.php`); Caddy hanya menambah header dasar yang belum ada. Darurat: `CSP_REPORT_ONLY=true` atau `CSP_ENABLED=false`.
- CSP `img-src` mengizinkan `tile.openstreetmap.org` (peta lokasi kantor & layar gagal check-in).
- Rate limiter bernama (`AppServiceProvider`): `login` (10/menit/IP + 5/menit/email+IP), `check-in` (6/menit/user, pasang `throttle:check-in` di route check-in/out), `api` (120/menit).
- Checklist keamanan: [`docs/security/ASVS-L1.md`](docs/security/ASVS-L1.md).

## Privasi (UU PDP)

- Karyawan melihat & mengunduh (Excel/PDF) seluruh datanya di **Menu → Privasi & data saya** (`/privasi`): profil (NIK tersamar), persetujuan lokasi & selfie beserta versinya, absensi & log, pengajuan, dan keputusan persetujuan. Setiap unduhan tercatat di audit log (`privacy.data_exported`).
- Mencabut persetujuan menonaktifkan check-in GPS + selfie dan memberi tahu HR di Inbox (`attendance.consent_revoked`).
- Kebijakan privasi publik di `/kebijakan-privasi`. Teksnya Markdown di `resources/markdown/privacy-policy.md` (placeholder `{{perusahaan}}`, `{{retensi_selfie_bulan}}`, `{{kontak}}`, dst.). Setelah mengubah teks, naikkan `PRIVACY_POLICY_VERSION` (+ `PRIVACY_POLICY_DATE`) di `.env`, lalu `php artisan config:cache`: semua karyawan diminta menyetujui ulang sebelum check-in GPS + selfie berikutnya.

## Kinerja

- Uji regresi jumlah query untuk setiap halaman utama: `tests/Feature/Performance/PageQueryCountTest.php` (gagal bila jumlah query bertambah seiring data = N+1, atau melewati anggaran). `QUERY_COUNTS=1 php artisan test --filter=PageQueryCount` mencetak angkanya.
- Lighthouse halaman Absensi di ponsel: `scripts/lighthouse-absensi.sh` (langkah lengkap di kepala skrip: build produksi, `php artisan serve`, proxy HTTPS/HTTP2 + gzip `scripts/lighthouse-proxy.mjs`, login demo).

## Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| Lokal: `could not find driver` | Aktifkan `pdo_pgsql` di php.ini Herd, restart Herd |
| Lokal: `Connection refused` 5432/6379 | Docker belum jalan → `docker compose up -d` |
| Lokal: `LazyLoadingViolationException` / `MissingAttributeException` | Mode strict model di non-produksi: tambahkan `with()`/`load()` (N+1) atau pilih kolom yang dipakai |
| Lokal: script/style diblokir CSP di console | Sumber baru belum diizinkan → tambahkan di `config/security.php` (`csp.sources`) |
| Lokal: halaman tanpa gaya setelah `npm run dev` dihentikan | Hapus `public/hot` atau jalankan `npm run build` |
| Server: kontainer `app` restart terus, log "environment file is invalid" | Nilai `.env` berisi spasi tanpa tanda kutip → perbaiki, `up -d --force-recreate` |
| Server: Caddy gagal menerbitkan sertifikat | DNS belum mengarah ke VPS atau port 80/443 tertutup; cek `docker compose -f compose.prod.yml logs caddy` |
| Server: realtime tidak jalan | `logs reverb`; pastikan `REVERB_ALLOWED_ORIGINS` = domain, `VITE_REVERB_HOST` = domain, dan variabel GitHub `REVERB_APP_KEY` = `REVERB_APP_KEY` server (key dibakar saat build) |
| Server: `/health` 503 | Lihat `checks`: `database` → `logs postgres`; `redis` → `logs redis`, cek `REDIS_PASSWORD` |
| Server: job tidak diproses | `exec queue php artisan horizon:status`, buka `/horizon`, `logs queue` |
| Server: backup tidak jalan | `logs backup` (jadwal & rclone), uji manual `exec backup backup.sh` |

## Skill Claude Code untuk desain & animasi

Opsional, dipasang global per komputer (tidak di-commit ke repo). Aturan pemakaiannya di `CLAUDE.md`.

```bash
npx skills add LottieFiles/motion-design-skill -a claude-code -g
npx skills add emilkowalski/skills -a claude-code -g   # pilih: animate, review-animations, improve-animations, find-animation-opportunities, animation-vocabulary, apple-design, mobile-native, break-ui
```

Skill Apple HIG dari `dickwu/apple-design-skill` memakai nama `apple-design` yang **bentrok** dengan skill milik emilkowalski, jadi pasang manual dengan nama `apple-hig`:

```bash
git clone --depth 1 https://github.com/dickwu/apple-design-skill.git ~/.claude/skills/apple-hig
sed -i.bak '2s/^name: apple-design$/name: apple-hig/' ~/.claude/skills/apple-hig/SKILL.md && rm ~/.claude/skills/apple-hig/SKILL.md.bak
```

Di Windows (Git Bash) folder skill ada di `%USERPROFILE%\.claude\skills`. Buka sesi Claude Code baru setelah memasang.

## Kontribusi

- Branch `feat/…`, `fix/…`, `chore/…`; PR kecil, satu topik; Conventional Commits.
- CI wajib hijau. Setiap fitur baru menyertakan Policy, test fitur, tampilan desktop & mobile.

## Lisensi

Internal / proprietary. Tidak untuk didistribusikan.
