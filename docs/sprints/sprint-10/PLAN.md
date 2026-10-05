# Sprint 10 — Bagian A (platform/ops) · Rencana

Cabang `feat/sprint-10-ops`. Bagian A tidak bergantung pada modul domain (absensi, pengajuan, workspace, notifikasi) yang dibangun paralel. Bagian B (halaman "Data Saya", pemasangan `throttle:check-in` di route check-in, Lighthouse halaman Absensi, sapuan N+1 lintas modul) dikerjakan setelah integrasi.

## Langkah & file

| # | Langkah | File utama |
|---|---|---|
| 1 | Header keamanan + CSP (nonce) di level aplikasi, cookie sesi aman, rate limiter bernama | `app/Http/Middleware/SecurityHeaders.php`, `config/security.php`, `config/session.php`, `app/Providers/AppServiceProvider.php`, `app/Providers/FortifyServiceProvider.php`, `bootstrap/app.php`, `resources/views/app.blade.php`, `tests/Feature/Platform/{SecurityHeadersTest,RateLimiterTest,SessionCookieTest}.php` |
| 2 | Model strict mode di non-produksi (`Model::shouldBeStrict`) + perbaiki kode yang rusak | `AppServiceProvider` |
| 3 | Docker produksi: image FrankenPHP multi-stage, `compose.prod.yml`, Caddy edge, `.dockerignore`, `.env.production.example` | `Dockerfile`, `docker/app/*`, `docker/caddy/Caddyfile`, `compose.prod.yml` |
| 4 | Kontainer backup (pg_dump 02.00 WIB → S3 via rclone, retensi 30 hari) + restore | `docker/backup/*`, `scripts/backup.sh`, `scripts/restore.sh`, README §Backup |
| 5 | GitHub Actions deploy (GHCR → approval `production` → SSH) + job `build` di CI | `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `scripts/deploy-remote.sh` |
| 6 | Observabilitas: gate Horizon/Pulse = super_admin, Sentry opsional, `/health` JSON | `HorizonServiceProvider`, `AppServiceProvider`, `app/Support/Health/*`, `app/Http/Controllers/HealthController.php`, `config/sentry.php` |
| 7 | Playwright visual smoke (375/834/1440 × terang/gelap) | `playwright.config.ts`, `tests/e2e/*` |
| 8 | Checklist OWASP ASVS L1 | `docs/security/ASVS-L1.md` |
| 9 | README nyata (Windows & macOS, deploy VPS dari nol, backup/restore, troubleshooting) | `README.md` |

## Keputusan

- **Header keamanan di aplikasi, bukan hanya Caddy.** Bekerja di belakang proxy apa pun (Herd, Caddy, load balancer). Caddy tetap menambahkan header dasar dengan `?` (hanya bila belum ada) sehingga tidak menduplikasi CSP aplikasi.
- **CSP memakai nonce per request** (`Vite::useCspNonce()`), `script-src` tanpa `unsafe-inline`. `style-src` mengizinkan `'unsafe-inline'` karena Radix/sonner/progress Inertia menyuntik `<style>`; risiko injeksi gaya rendah dan didokumentasikan di ASVS.
- **Dashboard Horizon & Pulse memakai CSP longgar** (`unsafe-inline`/`unsafe-eval`, dibutuhkan Vue/Alpine bawaan paket). Hanya super_admin yang bisa membuka.
- **Rate limiter login**: 10/menit per IP (sesuai ARCHITECTURE §5) **ditambah** 5/menit per email+IP bawaan Fortify (melindungi akun individual dari tebak sandi). Semua limiter bernama didefinisikan di `AppServiceProvider`.
- **FrankenPHP (mode klasik, Debian)** dipilih dibanding php-fpm-alpine: satu proses melayani HTTP + file statis di `:8000` (ARCHITECTURE §6 `app:8000`) tanpa sidecar nginx atau volume `public/` bersama dengan Caddy; varian Debian dipakai karena musl (Alpine) lebih lambat untuk thread PHP ZTS yang dipakai FrankenPHP.
- **Variabel `VITE_*` dibakar saat build** (Echo membaca `import.meta.env`), jadi image produksi dibangun dengan build-arg `VITE_REVERB_*` dari GitHub `vars`.
- **Backup**: image sendiri (`postgres:17-alpine` + rclone + crond). Skrip inti di `scripts/` agar bisa dijalankan di host dan di kontainer.
- **Sentry**: paket dipasang, nonaktif selama `SENTRY_LARAVEL_DSN` kosong (SDK tidak mengirim apa pun tanpa DSN). PII tidak dikirim.

## Risiko

- `Model::shouldBeStrict()` aktif di non-produksi: modul lain yang memakai lazy loading akan gagal di test setelah merge — itu disengaja (menangkap N+1 lebih awal). Dicatat di SUMMARY.
- CSP bisa memblokir sumber baru (mis. endpoint object storage untuk selfie). Endpoint S3 diturunkan otomatis dari config `filesystems`; sumber lain ditambah lewat `config/security.php`.
- Uji deploy ke VPS sungguhan tidak bisa dilakukan dari mesin ini; divalidasi dengan `docker compose config`, build image, dan smoke test stack sementara.
