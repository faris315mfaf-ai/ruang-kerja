# RuangKerja

Aplikasi kantor internal: **absensi, workspace, ruang kolaborasi, serta tracking & monitoring kerja berbasis output** dalam satu tempat. Terintegrasi dengan Google Workspace (login, Drive, Docs, Calendar).

> "RuangKerja" adalah nama kode. Ganti nama, logo, dan warna di `config/branding.php` dan `resources/css/tokens.css`.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Kebutuhan produk, fase, user story, metrik |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Skema tabel, ERD, query metrik |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arsitektur, struktur folder, integrasi Google, deploy |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Design system: warna, tipografi, komponen, glassmorphism |
| [`docs/PLATFORM.md`](docs/PLATFORM.md) | Pemisahan tampilan desktop & mobile: breakpoint, shell, matriks fitur |
| [`docs/SETUP-LOKAL.md`](docs/SETUP-LOKAL.md) | Setup Windows (Herd + Docker), localhost HTTPS, Claude Code + Chrome |
| [`docs/mockups/INDEX.md`](docs/mockups/INDEX.md) | 52 mockup layar (HTML + PNG) desktop & mobile, dipetakan ke sprint |
| [`docs/PROMPTS.md`](docs/PROMPTS.md) | Prompt per sprint untuk Claude Code / Z-AI |
| [`AGENTS.md`](AGENTS.md) · [`CLAUDE.md`](CLAUDE.md) | Aturan proyek untuk AI coding tool |

## Fitur

**Fase 1 (MVP)**
- Login Google Workspace (domain terbatas), peran: Super Admin, Direksi, HR, Kepala Divisi, Anggota
- Absensi web: GPS + geofence + selfie, QR dinamis, WFH/lapangan, koreksi manual, shift, hari libur
- Pengajuan cuti/izin/sakit/lembur/koreksi dengan alur persetujuan bertingkat dan saldo cuti
- Workspace pribadi, tim, divisi, dan proyek
- Task: Kanban, list, kalender, sub-task, checklist, label, prioritas, komentar, @mention, realtime
- File & dokumen dari Google Drive (Shared Drive) dan Google Docs/Sheets/Slides
- Notifikasi in-app & email, ringkasan harian
- Dashboard Saya, Kepala Divisi, HR, Direksi
- Ekspor rekap absensi (Excel/PDF)
- Command palette, pintasan keyboard, mode gelap

**Fase 2:** chat, catatan realtime (multi-cursor), Google Calendar + Meet, notifikasi WhatsApp.
**Fase 3:** aplikasi mobile React Native, face recognition, mesin fingerprint, OKR.

## Teknologi

| Lapisan | Pilihan |
|---|---|
| Backend | PHP 8.4, Laravel 13, PostgreSQL 17, Redis 7 |
| Frontend web | Inertia.js 2 + React 19 + TypeScript, Tailwind CSS 4, shadcn/ui (Radix), TanStack Table, dnd-kit, Tiptap |
| Realtime | Laravel Reverb (WebSocket) + Laravel Echo |
| Antrean & jadwal | Laravel Horizon (Redis), Scheduler |
| Penyimpanan | S3-compatible (Biznet Gio NEO Object Storage) untuk selfie & lampiran privat. Google Drive untuk file kerja |
| Paket kunci | laravel/socialite, spatie/laravel-permission, klien Drive v3 tipis berbasis HTTP (bukan google/apiclient, lihat GOOGLE-API.md), maatwebsite/excel, barryvdh/laravel-dompdf, laravel/pulse |
| Uji | Pest 4, Larastan level 8, Laravel Pint, ESLint + Prettier, Vitest |
| Infra | Docker Compose di VPS Biznet Gio, Caddy (HTTPS otomatis) |
| Fase 2 | Hocuspocus (Node) + Yjs untuk catatan realtime |
| Fase 3 | React Native (Expo) + Sanctum API |

## Memulai (pengembangan lokal)

**Windows (disarankan untuk tim ini):** ikuti [`docs/SETUP-LOKAL.md`](docs/SETUP-LOKAL.md): Laravel Herd + Docker Desktop + Claude Code + Chrome, aplikasi di `https://ruangkerja.test`.

Ringkasnya:

```powershell
# sekali
powershell -ExecutionPolicy Bypass -File .\scripts\cek-lingkungan.ps1
herd link ruangkerja          # jalankan di dalam folder proyek
herd secure ruangkerja
copy .env.example .env
docker compose up -d          # postgres, redis, mailpit
claude --chrome               # lalu: /cek-lokal  →  /sprint 0

# setiap hari (setelah Sprint 0)
docker compose up -d
composer run dev:win          # vite + reverb + queue:work + schedule:work
```

**Linux/macOS/CI:** `docker compose up -d`, `composer install`, `php artisan key:generate`, `php artisan migrate --seed`, `composer run dev` (aplikasi di `http://localhost:8000`).

Seeder membuat perusahaan contoh, divisi, karyawan, shift, lokasi kantor, proyek, dan tugas contoh.

Akun demo lokal (hanya `APP_ENV=local` + `DEMO_LOGIN_ENABLED=true`, login tanpa Google): `admin@demo.test`, `direksi@demo.test`, `hr@demo.test`, `kadiv@demo.test`, `anggota@demo.test` · sandi `password`.

| Alamat lokal | Isi |
|---|---|
| https://ruangkerja.test | Aplikasi |
| http://localhost:8025 | Mailpit |
| localhost:5432 / 6379 | Postgres / Redis |

### Variabel lingkungan penting

```dotenv
APP_TIMEZONE=UTC
OFFICE_TIMEZONE=Asia/Jakarta
APP_LOCALE=id

DB_CONNECTION=pgsql
REDIS_HOST=127.0.0.1
QUEUE_CONNECTION=redis
BROADCAST_CONNECTION=reverb

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=${APP_URL}/auth/google/callback
GOOGLE_ALLOWED_DOMAIN=perusahaan.co.id
GOOGLE_SERVICE_ACCOUNT_JSON=/run/secrets/google-sa.json
GOOGLE_IMPERSONATE_USER=admin-ruangkerja@perusahaan.co.id
GOOGLE_SHARED_DRIVE_ID=
GOOGLE_PICKER_API_KEY=

FILESYSTEM_PRIVATE_DISK=s3
AWS_ENDPOINT=https://<endpoint-object-storage-biznet>
AWS_BUCKET=ruangkerja-private
AWS_USE_PATH_STYLE_ENDPOINT=true

ATTENDANCE_QR_SECRET=
ATTENDANCE_SELFIE_RETENTION_MONTHS=12
```

## Menyiapkan Google Workspace

1. **Google Cloud Console** → buat proyek → aktifkan **Google Drive API**, **Google Picker API**, **Admin SDK API** (opsional), dan **Google Calendar API** (Fase 2).
2. **OAuth consent screen** → tipe **Internal** (hanya akun di domain Anda).
3. **OAuth Client ID** (Web) → redirect URI `https://<domain-app>/auth/google/callback` (login) **dan** `https://<domain-app>/google/connect/callback` (hubungkan Drive untuk Picker), JavaScript origin `https://<domain-app>`. Scope: `openid email profile` + `https://www.googleapis.com/auth/drive.file`. Buat juga **API key** untuk Google Picker → `GOOGLE_PICKER_API_KEY`.
4. **Service Account** → buat kunci JSON → simpan sebagai secret (jangan di-commit).
5. **Admin Console** → Security → API controls → **Domain-wide delegation** → tambahkan Client ID service account dengan scope `https://www.googleapis.com/auth/drive` (dan `calendar` di Fase 2).
6. Buat **Shared Drive** "RuangKerja", tambahkan akun impersonasi sebagai *Manager*, salin ID-nya ke `GOOGLE_SHARED_DRIVE_ID`.
7. Jalankan `php artisan ruangkerja:google-check --write` untuk menguji koneksi. Rincian: [`docs/sprints/sprint-7/GOOGLE-API.md`](docs/sprints/sprint-7/GOOGLE-API.md) §8.

## Perintah sehari-hari

```bash
composer run dev            # server + queue + reverb + vite
composer test               # Pest
composer lint               # Pint + Larastan
npm run lint && npm run typecheck
php artisan attendance:close-day --date=2026-10-03   # tutup hari secara manual
php artisan ruangkerja:google-check
```

## Deploy (VPS Biznet Gio)

Ringkasnya (detail di [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#deploy)):
1. VPS Ubuntu 24.04, minimal **4 vCPU / 8 GB RAM / 80 GB SSD**.
2. Pasang Docker, buat pengguna `deploy`, aktifkan firewall (22, 80, 443 saja).
3. `docker compose -f compose.prod.yml up -d` (app, queue, scheduler, reverb, postgres, redis, caddy).
4. Arahkan DNS ke IP VPS. Caddy menerbitkan sertifikat HTTPS otomatis.
5. Aktifkan backup harian Postgres ke object storage & uji pemulihan.

Deploy berikutnya lewat GitHub Actions: test → build image → push → `docker compose pull && up -d` → `php artisan migrate --force`.

## Struktur folder (ringkas)

```
app/
  Domain/            # logika bisnis per modul (Attendance, Requests, Workspaces, Tasks, Analytics, Google)
  Http/Controllers/  # tipis, memanggil Action di Domain
  Policies/
resources/js/
  pages/             # halaman Inertia
  components/ui/     # shadcn/ui
  features/          # komponen per modul
docs/
```

## Kontribusi

- Branch: `feat/…`, `fix/…`, `chore/…`. PR kecil, satu topik.
- Commit: Conventional Commits (`feat(attendance): …`).
- CI wajib hijau: Pint, Larastan, Pest, ESLint, typecheck.
- Setiap fitur baru wajib menyertakan Policy dan test fitur.

## Lisensi

Internal / proprietary. Tidak untuk didistribusikan.
