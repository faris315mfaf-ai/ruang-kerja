# Serah terima — RuangKerja Fase 1

Status per 6 Okt 2026. Semua sprint Fase 1 (0–10) dibangun di Mac mulai 5 Okt 2026 dengan banyak agen paralel, lalu digabung ke `main` lokal. **Belum di-push ke GitHub** (repo masih public).

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

Tiga putaran review independen (Sprint 0–1, 2/4/5, 3/6/7/8/9) sudah dijalankan dan semua temuannya diperbaiki dengan test regresi: `sprints/sprint-1/REVIEW-FIXES.md`, `sprints/REVIEW-FIXES-2-4-5.md`, `sprints/REVIEW-FIXES-3-9-{A,B}.md`.

## Kualitas saat serah terima

- Pest ±1.870 test hijau (paralel), Vitest ±270 test hijau.
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

## Keputusan yang menunggu pemilik

1. **Repo GitHub masih public.** Ubah ke private, baru push: `gh repo edit faris315mfaf-ai/ruang-kerja --visibility private --accept-visibility-change-consequences`, lalu `git push -u origin main`.
2. **Kredensial Google Cloud** (login OAuth, service account + domain-wide delegation, Shared Drive, Picker API key). Langkah: `sprints/sprint-1/LOGIN-SUMMARY.md` §7 dan `sprints/sprint-7/GOOGLE-API.md`. Setelah diisi: `php artisan ruangkerja:google-check --write`.
3. **Deploy ke VPS** (Biznet Gio): server, domain/DNS, bucket S3-compatible untuk selfie & backup, secret GitHub Actions. Langkah: `README.md` bagian Deploy.
4. **Rahasia produksi**: `ATTENDANCE_QR_SECRET` wajib diisi (bila kosong diturunkan dari APP_KEY), `SESSION_SECURE_COOKIE=true`, `TRUSTED_PROXIES` sesuai jaringan Caddy.
5. **Branding resmi SPKD**: ganti `--brand-*` di `resources/css/tokens.css`, `config/branding.php`, lalu `php scripts/generate-icons.php`.

## Yang belum diuji / keterbatasan

- Belum pernah dicoba dengan Google sungguhan (semua test memakai fake client), belum deploy ke VPS sungguhan (stack produksi & backup-restore sudah diuji di Docker lokal).
- Pindai QR dengan kamera fisik belum dicoba (sisi server ditutup test).
- WAL archiving Postgres belum ada (backup harian → potensi kehilangan ≤ 24 jam data).
- Fitur yang sengaja ditunda: ekspor PNG struktur organisasi, read receipts komentar, presence per kartu di board, folder Drive per tugas, UI pembatalan pengajuan yang sudah disetujui (fungsi backend ada).
- Browser bawaan Claude memblokir port non-standar (Vite 5173, Reverb 8081) dan service worker; verifikasi visual lokal memakai `npm run build`.

## Lingkungan pengembangan Mac

- Semua branch pembangunan (`feat/sprint-*`, `fix/*`) sudah digabung ke `main`; worktree paralel dan database per jalur sudah dibersihkan. Branch lama tetap ada sebagai jejak dan aman dihapus.
- Postgres dev memakai `max_locks_per_transaction=256` (`compose.yml`) dan suite test memakai `memory_limit=512M` (`phpunit.xml`) agar test paralel stabil.
