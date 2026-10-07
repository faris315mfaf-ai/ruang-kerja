# Serah terima — RuangKerja Fase 1

Status per 7 Okt 2026. Semua sprint Fase 1 (0–10) dibangun di Mac mulai 5 Okt 2026 dengan banyak agen paralel. Repo GitHub **private**; `main` sudah berisi PR #1–#7 (terakhir: integrasi Fase 2/3 #5, perbaikan seeder #6, deploy dua VPS #7) dan CI hijau.

## Status sprint

| Sprint | Isi | Ringkasan |
|---|---|---|
| 0 | Fondasi: Laravel 13 + Inertia 3 + React, shell desktop/mobile, token desain, tema, PWA, CI | `sprints/sprint-0/SUMMARY.md` |
| 1 | Organisasi, login Google, Super Admin wajib 2FA, Admin Karyawan + impor, Divisi/Tim/Jabatan, Struktur, Audit Log | `sprints/sprint-1/*SUMMARY.md`, `REVIEW-FIXES.md` |
| 2 | Absensi inti: jadwal/shift, check-in GPS + selfie, geofence, fraud, tutup hari, pengingat | `sprints/sprint-2/SUMMARY.md` |
| 3 | Kiosk QR dinamis, tinjauan HR, koreksi manual, rekap & ekspor Excel/PDF, retensi selfie | `sprints/sprint-3/SUMMARY.md` |
| 4 | Pengajuan (cuti, izin, sakit, lembur, koreksi, dinas) & persetujuan bertingkat, delegasi, saldo | `sprints/sprint-4/SUMMARY.md` |
| 5 | Workspace & Kanban, Tugas Saya, kalender, sinkron anggota divisi | `sprints/sprint-5/SUMMARY.md` |
| 6 | Detail tugas, komentar, mention, reaksi, realtime, saved views, pintasan | `sprints/sprint-6/SUMMARY.md` |
| 7 | Google Drive & Docs: folder per workspace, sinkron izin, tab File/Dokumen, lampiran tugas & komentar | `sprints/sprint-7/{SUMMARY,WIRING-SUMMARY,LAMPIRAN-SUMMARY,GOOGLE-API}.md` |
| 8 | Notifikasi, Inbox, command palette ⌘K, preferensi, ringkasan harian | `sprints/sprint-8/{SUMMARY,HOW-TO-NOTIFY}.md` |
| 9 | Dashboard Saya/Kepala Divisi/HR, portofolio proyek Direksi | `sprints/sprint-9/{SUMMARY,PORTFOLIO-SUMMARY}.md` |
| 10 | Keamanan (CSP, rate limit), Docker produksi, backup/restore, deploy, Data Saya, kinerja | `sprints/sprint-10/{SUMMARY,PRIVASI-SUMMARY}.md`, `security/ASVS-L1.md` |

## Sistem desain Arus (6 Okt 2026)

Seluruh UI sudah dimigrasikan ke sistem desain **Arus** (`docs/ruangkerja-design/`, `docs/DESIGN.md`, panduan `docs/design/ARUS-GUIDE.md`): fondasi + 8 jalur modul, lalu satu putaran review & pemolesan akhir (toolbar board di garis tab, breadcrumb selaras Dock/Rail, halaman galat Arus, perbaikan regresi migrasi, aksesibilitas KPI, penghapusan kode UI lama). Pemeriksaan visual Playwright atas semua rute §2 panduan (1440 terang/malam, 834, 390 terang/malam): tanpa galat konsol/halaman, tanpa HTTP 4xx/5xx tak terduga, tanpa gulir horizontal. Celah yang sengaja tersisa (Fase 2/3, panel tanpa data) ada di ARUS-GUIDE §5. Acuan hidup komponen: `/dev/komponen` (lokal).

Tiga putaran review independen (Sprint 0–1, 2/4/5, 3/6/7/8/9) sudah dijalankan dan semua temuannya diperbaiki dengan test regresi: `sprints/sprint-1/REVIEW-FIXES.md`, `sprints/REVIEW-FIXES-2-4-5.md`, `sprints/REVIEW-FIXES-3-9-{A,B}.md`.

## Pratinjau Fase 2 & 3 (6 Okt 2026)

Alur **frontend** semua modul Fase 2 dan 3 sudah bisa dicoba sebagai pratinjau dengan data contoh (tidak ada migrasi, Action, atau integrasi; tidak menyimpan apa pun). Dokumentasi bergambar per modul, peta alur, dan checklist pekerjaan backend: **`docs/fitur/README.md`** (juga di Admin › Dokumentasi, grup "Fitur & pratinjau").

| Modul | Sprint | Rute utama | Dokumen |
|---|---|---|---|
| Obrolan | F2-1 | `/obrolan` | `fitur/obrolan.md` |
| Catatan bersama | F2-2 | `/catatan` | `fitur/catatan.md` |
| Rapat, notulen & kalender | F2-3 | `/rapat`, `/kalender`, `/manajemen/jadwal` | `fitur/rapat-kalender.md` |
| Otomasi, WhatsApp, Kinerja saya | F2-4 | `/otomasi`, `/pengaturan/whatsapp`, `/kinerja` | `fitur/otomasi-whatsapp.md` |
| Aplikasi ponsel | F3-1 · F3-2 | `/pratinjau/ponsel`, `/absensi/wajah`, `/pengaturan/perangkat` | `fitur/aplikasi-ponsel.md` |
| OKR divisi | F3-3 | `/okr` | `fitur/okr.md` |
| Mesin fingerprint (ADMS) | F3-3 | `/admin/mesin-absensi` | `fitur/mesin-fingerprint.md` |
| Dashboard per peran SPKD | SPKD | `/peran/dirut` … | `fitur/dashboard-peran.md` |

**Cara mencoba:** flag `FEATURE_PROTOTYPE` (`config/features.php`) menyala otomatis di luar produksi dan **mati di produksi** (rute 404, ubin Dock/baris Menu tersembunyi). Buka https://ruangkerja-proto.test/pratinjau (worktree pratinjau) atau https://ruangkerja.test/pratinjau setelah digabung, masuk dengan `kadiv@demo.test` (sebagian besar modul), `direksi@demo.test` (`/manajemen/jadwal`, peran Dirut/Direktur) atau `hr@demo.test` (mesin absensi, peran HR). Setiap layar menerima `?keadaan=memuat|kosong|galat`.

**Kualitas:** Vitest per modul (logika murni), typecheck & lint bersih, smoke e2e `tests/e2e/prototype-smoke.spec.ts` (36 rute × 375/834/1440 × terang/malam; jalankan `--workers=2 --retries=1`). Laporan cek bug: `sprints/fase-2-3-prototipe/BUG-REPORT.md`. Bug Beranda anggota (`/dashboard` crash karena `live.focus`/`live.week` pindah ke prop `planner`) sudah diperbaiki: Beranda kini menampilkan **Ruang saya** (tugas baru, lajur Hari ini · Minggu ini · Nanti, catatan cepat, tandai selesai).

**Keputusan yang dibutuhkan sebelum backend Fase 2/3:** provider WhatsApp, tabel berbagi catatan (`note_shares`), tabel rapat & peserta di samping `calendar_events`, kolom tambahan `devices`, dan apakah dashboard per jabatan SPKD menggantikan atau melengkapi dashboard per peran akses (lihat checklist di tiap dokumen `fitur/`).

## Rilis gelombang 6 Okt 2026 (branch `claude/integrasi-f2`)

Langkah setelah deploy (selain `migrate` otomatis):
1. `php artisan db:seed --class=RoleSeeder --force` (HR mendapat `workspaces.view_all`) dan `--class=RequestSeeder` (jenis "Pengajuan barang" + alurnya; cuti & lembur terkunci lewat migrasi).
2. Karyawan login dengan sandi: HR mengatur sandi awal di Admin › Karyawan › "Atur kata sandi" (sandi sementara + wajib ganti), atau karyawan memakai **Lupa kata sandi** yang disetujui HR.
3. Flag per modul (default mati di produksi): `FEATURE_CHAT`, `FEATURE_NOTES` (+ layanan `collab`: `COMPOSE_PROFILES=collab`, `COLLAB_SECRET`, `COLLAB_URL`, `VITE_COLLAB_URL`, image dari `collab/Dockerfile` di CI), `FEATURE_MEETINGS`, `FEATURE_AUTOMATION`, `FEATURE_OKR`, `FEATURE_ROLE_DASHBOARDS`. Obrolan juga butuh `php artisan chat:sync-workspace-channels` sekali.
4. Hiring: HR membuat lowongan, menyalin URL + secret webhook ke skrip Apps Script Google Form (`docs/fitur/hiring.md`), memilih penyetuju akhir di `/hiring/pengaturan`.
5. Jadwal baru (scheduler): pengingat laporan harian 16.30, tugas berulang 07.00, aturan lewat tenggat 07.05, pengingat rapat tiap menit, tindak lanjut 07.05, check-in OKR Jumat 15.00, kedaluwarsa permintaan reset sandi tiap jam.

Catatan pengujian lokal: `composer test` sekarang ±2.900 test; di mesin sibuk bisa melewati batas 300 detik composer — jalankan `COMPOSER_PROCESS_TIMEOUT=0 composer test`. Rute Wayfinder (`resources/js/routes`) dibuat saat build/`php artisan wayfinder:generate --with-form`.

## Kualitas saat serah terima

- Pest ±2.940 test hijau (paralel), Vitest ±665 test hijau. Di CI, Pest dibagi 3 shard berimbang waktu (`tests/.pest/shards.json`; perbarui dengan `vendor/bin/pest --parallel --update-shards` setelah banyak test baru — tanpa `--processes`).
- Pint + Larastan level 8 tanpa ignore/baseline, `tsc --noEmit`, `vp check` bersih.
- Mode strict model aktif di luar produksi (tidak ada lazy loading); 40 halaman utama punya test jumlah query (anti N+1).
- Lighthouse halaman Absensi di ponsel: 98 (HTTPS + HTTP/2, mirip produksi).

## Menjalankan di lokal

Lihat `README.md` dan `docs/SETUP-LOKAL.md` (§10 macOS, termasuk Reverb lewat wss dengan sertifikat Herd).

```bash
docker compose up -d
composer run dev        # macOS/Linux (Horizon); Windows: composer run dev:win
```

Buka https://ruangkerja.test → "Masuk cepat (demo lokal)". Sandi semua akun demo: `password`.

| Akun | Peran | Cocok untuk mencoba |
|---|---|---|
| admin@demo.test | Super Admin | Audit log, organisasi, pengaturan |
| direksi@demo.test | Direksi | Portofolio proyek `/portofolio` |
| hr@demo.test | HR | Dashboard HR, Lokasi & shift, rekap & ekspor, Admin Karyawan |
| kadiv@demo.test | Kepala Divisi (Operasional) | Dashboard divisi, persetujuan, board `/w/PLQ` |
| anggota@demo.test | Anggota | Check-in di ponsel, pengajuan, Tugas Saya |
| programmer@demo.test | Anggota (Divisi Programming) | Tampilan staf programmer |
| maya.lestari@demo.test | Anggota (Pemasaran, Tim Digital) | Tampilan staf sosial media, branding & marketing |

Setelah masuk, **pemilih akun demo** di bagian atas (pil "Demo · …" di menu bar desktop, strip di atas konten tablet/ponsel) berpindah langsung antar lima persona: Staf programmer, Staf admin & HR, Staf sosial media/branding & marketing, Admin, Direksi & manajemen (`POST /demo/ganti-akun`, hanya `APP_ENV=local` + `DEMO_LOGIN_ENABLED`).

## Keputusan yang menunggu pemilik

1. **Kredensial Google Cloud** (login OAuth, service account + domain-wide delegation, Shared Drive, Picker API key). Langkah: `sprints/sprint-1/LOGIN-SUMMARY.md` §7 dan `sprints/sprint-7/GOOGLE-API.md`. Setelah diisi: `php artisan ruangkerja:google-check --write`.
2. **Deploy ke VPS** (dua VPS, `docs/deploy/DUA-VPS.md`; penyimpanan file = Biznet Gio NEO Object Storage): alamat kedua VPS, domain/DNS, email Let's Encrypt, kredensial object storage, dan secret GitHub Actions. Sampai secret diisi, job Deploy di `main` gagal di langkah SSH ("Upload compose stack files", exit 255) — itu yang diharapkan.
3. **Rahasia produksi**: `ATTENDANCE_QR_SECRET` wajib diisi (bila kosong diturunkan dari APP_KEY), `SESSION_SECURE_COOKIE=true`, `TRUSTED_PROXIES` sesuai jaringan Caddy.
4. **Branding resmi SPKD**: ganti `--brand-*` di `resources/css/tokens.css`, `config/branding.php`, lalu `php scripts/generate-icons.php`.

## Yang belum diuji / keterbatasan

- Belum pernah dicoba dengan Google sungguhan (semua test memakai fake client), belum deploy ke VPS sungguhan (stack produksi & backup-restore sudah diuji di Docker lokal).
- Pindai QR dengan kamera fisik belum dicoba (sisi server ditutup test).
- WAL archiving + PITR (pgBackRest, `deploy/PITR.md`) sudah ada: RPO ±1 menit, jendela ±4 minggu, diuji ujung-ke-ujung di Docker lokal (`scripts/pitr-uji.sh`, SeaweedFS HTTPS). **Belum diuji ke Biznet NEO sungguhan**; nyalakan dengan `PITR_ENABLED=true` setelah bucket backup jalan dan cadangkan `PITR_CIPHER_PASS`.
- Fitur yang sengaja ditunda: folder Drive per tugas (bagian dari integrasi Google yang ditahan pemilik).
- Browser bawaan Claude memblokir port non-standar (Vite 5173, Reverb 8081) dan service worker; verifikasi visual lokal memakai `npm run build`.

## Lingkungan pengembangan Mac

- Semua branch pembangunan (`feat/sprint-*`, `fix/*`) sudah digabung ke `main`; worktree paralel dan database per jalur sudah dibersihkan. Branch lama tetap ada sebagai jejak dan aman dihapus.
- Postgres dev memakai `max_locks_per_transaction=256` (`compose.yml`) dan suite test memakai `memory_limit=512M` (`phpunit.xml`) agar test paralel stabil.

## Obrolan (F2-1, tugas #1)

Backend + frontend nyata di branch `claude/f2-obrolan` (detail: `docs/fitur/obrolan.md` §7). Di balik `FEATURE_CHAT` (default nyala di lokal, **mati di produksi**). Saat dirilis: deploy → `php artisan migrate` (otomatis lewat `deploy-remote.sh`) → **sekali** `docker compose exec app php artisan chat:sync-workspace-channels` → set `FEATURE_CHAT=true` di `.env` server → `docker compose up -d --force-recreate`. Akun demo: Obrolan berisi data `ChatDemoSeeder` (kadiv@ punya pesan belum dibaca).

