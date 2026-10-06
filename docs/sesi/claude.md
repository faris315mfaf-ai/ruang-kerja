# Sesi claude

**Terakhir diperbarui:** 6 Okt 2026 · Claude Code (integrator)

## Tugas berjalan
Integrator dua gelombang agen paralel. Rencana: `docs/PEMBAGIAN-TUGAS.md` + keputusan pemilik di bawah.

## Worktree / branch
`.claude/worktrees/project-overview-status-ebff38` · branch integrasi `claude/integrasi-f2` (dari `claude/shell-mobile` = `main` + Obrolan PR #3 + shell mobile-first) · https://ruangkerja-claude.test

## Sudah selesai di `claude/integrasi-f2`
- Shell ponsel mobile-first (`ad89015`), papan tugas (`ab19be2`), panduan pratinjau `/pratinjau/panduan` (merge `895d2e5`), skema laporan progres harian (`5b64553`).

## Agen (branch → status)
- Semua sudah digabung ke `claude/integrasi-f2`, termasuk `claude/tanggal` (DateInput "Hari, dd/mm/yyyy"), `claude/bug-ringan` (PR #4), dan `main` terbaru.
- Verifikasi terakhir: Pest 2.930, Vitest 644, Larastan/Pint/oxlint/tsc bersih, `npm run build` ok, ui-shots hr@/dio@ tanpa galat.

## Langkah berikutnya
1. PR #5 (`claude/integrasi-f2` → `main`) terbuka, mergeable. Setelah di-merge, tutup PR #3 dan #4 (isinya sudah tercakup).
2. Sudah diputus pemilik: `/manajemen` tanpa Kehadiran hari ini & KPI Tugas terlambat; retensi pelamar 30 hari; format isian tanggal; persona Reynandio (Dirut) & Faris (Project Leader).
3. Masih terbuka: chip "rapat 5 menit lagi" di MenuBar.

## Keputusan pemilik yang berlaku (6 Okt 2026)
- DITAHAN: login Google, Google Drive/Docs/Calendar/Meet, WhatsApp + provider, aplikasi ponsel (biometrik, integritas, offline, widget, wajah, perangkat), mesin fingerprint, fitur yang belum ada sama sekali.
- Login email + sandi untuk semua karyawan; Super Admin wajib 2FA; lupa sandi lewat persetujuan HR; HR bisa atur sandi.
- Staf (hanya peran anggota): saldo cuti disembunyikan, struktur organisasi tidak ada; cuti & lembur dikunci (SOP belum ada); pengajuan barang (atasan → Direksi).
- Laporan progres harian (Beranda) + pengumuman (banner dashboard, bisa ditutup, tetap di Inbox).
- Hiring: penyetuju akhir Faris & Dio (akun karyawan, bisa diatur), pewawancara = karyawan non-HR, Google Form via webhook Apps Script.
- Dashboard Direksi: monitoring harian/mingguan/per proyek + catatan tindakan + akses cepat workspace; metrik kehadiran/penyelesaian pindah ke modul Absensi; beban kerja ke `/manajemen`. Direksi + HR melihat semua workspace tim (baca saja).
- Catatan: tabel `note_shares` + Hocuspocus; dashboard jabatan melengkapi dashboard per peran.

## Butuh dari integrator / agen lain
- Chip "rapat 5 menit lagi" di MenuBar (agen Rapat). CI image `collab` + `npm --prefix collab ci` di `agen-mulai.sh` (agen Catatan). Tautan "Kinerja saya" dari Beranda (agen Otomasi).
