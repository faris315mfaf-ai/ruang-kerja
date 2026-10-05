# Sprint 10 — Bagian A (platform/ops) · Ringkasan

Cabang `feat/sprint-10-ops` (sudah di-merge dengan `main` per 2026-10-05: Sprint 1 login/karyawan/struktur, Sprint 7 Google A, Sprint 8 notifikasi). Bagian B (halaman "Data Saya", pemasangan `throttle:check-in` di route absensi, Lighthouse halaman Absensi, sapuan N+1 lintas modul) dikerjakan setelah integrasi modul domain.

## Acceptance criteria (bagian A)

| # | Kriteria | Status |
|---|---|---|
| 1 | Header keamanan + CSP (Google, Reverb, Vite hanya lokal), HSTS produksi, nosniff, Referrer-Policy, `frame-ancestors 'none'`, `Permissions-Policy: geolocation=(self), camera=(self)` | ✓ `SecurityHeaders` global + `config/security.php`; diuji (`SecurityHeadersTest`, 14 kasus) dan diverifikasi di stack Docker + Chromium (tanpa pelanggaran CSP, WebSocket Reverb tersambung) |
| 1 | Cookie sesi Secure/HttpOnly/SameSite=Lax di produksi | ✓ `config/session.php` (Secure bawaan saat `APP_ENV=production`), `SessionCookieTest` |
| 1 | Rate limiter `login` 10/menit/IP, `check-in` 6/menit/user, `api` 120/menit | ✓ `AppServiceProvider` (+ 5/menit per email+IP untuk login); `RateLimiterTest`. **Agent absensi: pasang `->middleware('throttle:check-in')` di route check-in/check-out.** |
| 2 | `preventLazyLoading`, `preventSilentlyDiscardingAttributes`, `preventAccessingMissingAttributes` di non-produksi | ✓ `Model::shouldBeStrict(! production)`; yang rusak diperbaiki: default atribut nullable `User`, test audit yang mass-assign `remember_token`, N+1 di `AuditLogController` |
| 3 | Dockerfile multi-stage, compose.prod.yml (caddy, app, queue, scheduler, reverb, postgres:17, redis:7, backup), Caddyfile (TLS, `/app` `/apps`, header), `.dockerignore`, `.env.production.example` | ✓ `docker compose -f compose.prod.yml config` valid; `docker build -t ruangkerja:test .` sukses; smoke test stack sementara (proyek `rk-smoke`, port 127.0.0.1:18080/18443) → migrate, seed, Super Admin, login + paksa 2FA, `/health` ok, WebSocket 101 + origin asing ditolak; stack dibongkar (`down -v`) |
| 4 | Backup pg_dump 02.00 WIB ke S3 (rclone), retensi 30 hari, `scripts/restore.sh`, dokumentasi uji pemulihan bulanan | ✓ Diuji ke Postgres dev 127.0.0.1:5434 dengan image backup: dump → unggah (remote rclone lokal) → retensi menghapus dump 2020 → restore ke `ruangkerja_restore_test` → 24/24 tabel, jumlah baris identik dengan `ruangkerja_ops` → DB dihapus. Penjaga: tolak timpa DB aktif tanpa `--yes`, validasi nama DB. Jadwal supercronic 02.00 WIB diverifikasi (TZ WIB). |
| 5 | GitHub Actions deploy: build → GHCR → approval `production` → SSH (`pull && up -d`, `migrate --force`, `horizon:terminate`) | ✓ `.github/workflows/deploy.yml` + `scripts/deploy-remote.sh` (diuji ke stack smoke); job `build` di `ci.yml` (image + validasi compose + shellcheck). `actionlint` & `shellcheck` bersih. |
| 6 | Horizon & Pulse hanya super_admin, Sentry opsional, `/health` JSON | ✓ Gate di `HorizonServiceProvider`/`AppServiceProvider` (`DashboardAccessTest` 5 peran × 2 dashboard); `sentry/sentry-laravel` nonaktif tanpa DSN (`SentryTest`); `/health` tanpa sesi/cookie, 503 bila DB/Redis mati (`HealthCheckTest`) |
| 7 | Playwright 375/834/1440 × terang/gelap, login demo, `/dashboard` & `/menu`, `npm run test:e2e` (bukan `npm test`) | ✓ `playwright.config.ts`, `tests/e2e/*`; 13/13 lulus ke server worktree lokal (http://127.0.0.1:8791). Browser & screenshot acuan tidak di-commit. |
| 8 | Checklist OWASP ASVS L1 + perbaikan temuan tinggi | ✓ `docs/security/ASVS-L1.md` — temuan tinggi F1 (channel privat User bisa didengar user lain karena `(int)` ULID) diperbaiki; tidak ada temuan tinggi terbuka |
| 9 | README nyata | ✓ Setup Windows & macOS, perintah harian, Google Workspace, deploy VPS dari nol, rollback, backup/restore + drill bulanan, observabilitas, troubleshooting |
| — | Acceptance sprint "deploy bersih ke VPS staging dari nol" & "restore dari backup terverifikasi" | ◐ Disimulasikan lokal (stack produksi lengkap di Docker + restore terverifikasi). Uji di VPS Biznet Gio sungguhan butuh server, DNS, bucket, dan secret GitHub — belum bisa dari mesin ini. |

## Cara mencoba manual

1. `composer test` → folder `tests/Feature/Platform` (header, limiter, sesi, dashboard, health, Sentry, channel, strict mode).
2. https://ruangkerja.test (setelah merge): DevTools → Network → dokumen → header `Content-Security-Policy` berisi `nonce-…`; Console tanpa pelanggaran CSP.
3. `admin@demo.test` → `/horizon` dan `/pulse` terbuka; `anggota@demo.test` → 403 untuk `/pulse` (Horizon terbuka untuk semua hanya di `APP_ENV=local`).
4. `curl -s https://ruangkerja.test/health` → `{"status":"ok","checks":{"database":…,"redis":…}}`.
5. Stack produksi lokal: ikuti README §Deploy dengan proyek/port sementara (lihat "Catatan uji" di bawah).
6. `npx playwright install chromium && npm run test:e2e:baseline && npm run test:e2e`.

## Keputusan

- **Header di aplikasi, Caddy hanya fallback (`?header`)** — berlaku di balik proxy apa pun dan CSP nonce tidak terduplikasi.
- **CSP**: `script-src 'self' 'nonce-…'` + apis.google.com/accounts.google.com; `style-src 'unsafe-inline'` (Radix/sonner/progress Inertia); `img-src` + `*.googleusercontent.com`, Drive/Docs, origin object storage (dari `AWS_URL`/`AWS_ENDPOINT`); `connect-src` + googleapis + Reverb untuk browser (`VITE_REVERB_*`); `frame-src` accounts/docs/drive; `form-action` + accounts.google.com (redirect OAuth). Dashboard Horizon/Pulse memakai CSP longgar (paketnya butuh `unsafe-eval`). Sakelar darurat `CSP_REPORT_ONLY` / `CSP_ENABLED`.
- **Limiter `login` satu sumber**: dipindah ke `AppServiceProvider` (Sprint 1 login juga mendefinisikannya di `FortifyServiceProvider`; saat merge versi Fortify dihapus, kunci `ip|…` disamakan sehingga test login tetap valid). `two-factor` & `google-login` tetap di `FortifyServiceProvider`.
- **FrankenPHP (mode klasik, Debian) dipilih dibanding php-fpm-alpine**: satu proses melayani HTTP + file statis di `:8000` sesuai `app:8000` di ARCHITECTURE §6, tanpa sidecar nginx / volume `public` bersama untuk Caddy; Debian karena PHP ZTS di musl lebih lambat. Ukuran image ±970 MB (didominasi image dasar).
- **Satu image untuk app/queue/scheduler/reverb**; entrypoint menjalankan `php artisan optimize`; view terkompilasi di `/tmp/views` per kontainer (bukan di volume `storage` bersama); kode milik root, proses user `app` (uid 1000).
- **`.env` di-mount read-only** ke `/app/.env` dan sekaligus dipakai interpolasi Compose; nilai berspasi wajib dikutip (ditemukan saat smoke test).
- **`VITE_REVERB_*` dibakar saat build** (Echo membaca `import.meta.env`) → build-arg dari GitHub `vars`.
- **Redis bersandi** dan **`REVERB_ALLOWED_ORIGINS`** (baru, `config/reverb.php`) di produksi.
- **Backup**: image `postgres:17-alpine` + rclone + supercronic (jadwal dengan env, non-root); bucket & kredensial terpisah dari bucket aplikasi; retensi remote 30 hari, lokal 7 hari; heartbeat opsional.
- **Deploy**: dipicu setelah workflow CI hijau di `main` (`workflow_run`) atau manual; login GHCR di server dengan token job berumur pendek lalu logout; `deploy-remote.sh` juga menjalankan `db:seed --force` (di produksi hanya `RoleSeeder`, idempoten) agar matriks izin tersinkron; `up -d --wait` menggagalkan deploy bila kontainer tidak sehat; riwayat tag di `.deploy-history` untuk rollback.
- **`ruangkerja:create-super-admin`** (baru, `CreateSuperAdmin` action + test): satu-satunya cara membuat Super Admin pertama di instalasi baru (sandi acak sekali tampil; TOTP lalu dipaksa oleh Sprint 1 login).
- **Sentry dipasang tetapi nonaktif bawaan**: PRD §8 meminta alert error; SDK tidak mengirim apa pun tanpa DSN, `send_default_pii=false`, `release` = `APP_VERSION`.
- **Playwright**: screenshot acuan per mesin (tidak di-commit, bergantung OS/font/data); galat WebSocket (Reverb mati) dan 429 polling diabaikan sebagai derau lingkungan.

## Paket baru

| Paket | Alasan |
|---|---|
| `sentry/sentry-laravel` ^4.28 (composer) | Integrasi error tracking opsional (PRD §8, prompt Sprint 10 #7). Nonaktif tanpa `SENTRY_LARAVEL_DSN`. |
| `@playwright/test` ^1.63 (npm, dev) | Infrastruktur uji visual (tugas #7). Hanya `npm run test:e2e`. |

## Catatan untuk lead / agent lain

- **Strict mode model** aktif di local/testing: kode modul yang lazy-load relasi dalam koleksi atau mengakses atribut yang tidak di-select akan melempar exception di test. Sudah hijau untuk semua yang ada di `main` (866 test). Agent absensi/pengajuan/workspace perlu menjalankan test setelah merge cabang ini.
- **Route check-in** wajib memakai `throttle:check-in` (Sprint 10 bagian B memverifikasi).
- Pengamatan modul notifikasi (bukan diubah di sini): limiter `notification-feed` 10/menit per user; smoke test (12 muatan halaman/menit dengan satu akun) memicu 429 di `/inbox/feed`, dan saat Super Admin dipaksa menyiapkan 2FA, `/inbox/feed` mengembalikan 403 di console. Pertimbangkan batas lebih longgar / jangan polling saat 2FA tertunda.
- `docker image prune -f` di `deploy-remote.sh` ikut berjalan saat uji lokal → image *dangling* (tanpa tag) di Docker mesin ini ikut terhapus (tidak ada kontainer/volume lain yang disentuh).

## Catatan uji (lokal)

- Stack produksi: `compose.prod.yml` + override port `127.0.0.1:18080/18443`, proyek `rk-smoke`, `.env` dari `.env.production.example` (APP_DOMAIN=localhost) di folder sementara; `deploy-remote.sh` dijalankan dengan `COMPOSE_FILE`/`COMPOSE_PROJECT_NAME`/`DEPLOY_PULL=0`; dibongkar dengan `down -v`.
- Backup/restore: image `ruangkerja-backup:test`, `RCLONE_CONFIG_BACKUP_TYPE=local` sebagai pengganti S3.

## Sisa pekerjaan

- Uji deploy dari nol di VPS staging Biznet Gio + uji restore di sana (butuh infrastruktur).
- WAL archiving (PRD §8 menyebut `pg_dump` harian **+ WAL archiving**) belum dibuat — saat ini RPO 24 jam. Opsi: `wal-g`/pgBackRest ke bucket backup.
- Verifikasi Google Picker sungguhan di bawah CSP (domain sudah diizinkan; bila ada sumber Google lain, pakai `CSP_REPORT_ONLY=true` sementara dan tambah di `config/security.php`).
- Temuan ASVS F8 (enumerasi email di lupa sandi) — rendah, terbuka.
- Bagian B: Data Saya, `throttle:check-in`, Lighthouse Absensi, sapuan N+1 lintas modul.
