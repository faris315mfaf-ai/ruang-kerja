# AGENTS.md — Aturan proyek RuangKerja untuk AI coding tool

Berlaku untuk Claude Code, Z-AI, dan agent lain. Baca file ini sebelum mengubah kode apa pun.

## Konteks

RuangKerja adalah aplikasi kantor **internal** (puluhan karyawan) untuk absensi, workspace, kolaborasi task, dan monitoring kerja **berbasis output**. Terintegrasi dengan Google Workspace. Sumber kebenaran:

- `docs/PRD.md`: apa yang dibangun dan fase-nya. **Jangan membangun fitur Fase 2/3 kecuali diminta.**
- `docs/DATABASE.md`: skema. Ikuti nama tabel/kolom persis. Jika perlu mengubah skema, perbarui dokumen ini dalam commit yang sama.
- `docs/ARCHITECTURE.md`: struktur folder, alur, otorisasi.
- `docs/DESIGN.md` + `resources/css/tokens.css`: tampilan.
- `docs/mockups/INDEX.md` + `docs/mockups/png/`: **mockup acuan setiap layar** (desktop & mobile). Lihat PNG-nya sebelum membangun layar.
- `docs/SETUP-LOKAL.md`: lingkungan lokal Windows (Herd di https://ruangkerja.test, Docker untuk Postgres/Redis/Mailpit). Horizon & pail tidak dipakai di Windows.
- `docs/PLATFORM.md`: **pemisahan tampilan desktop & mobile** (breakpoint, shell, matriks fitur). Setiap halaman wajib punya tata letak desktop DAN mobile.

## Stack (jangan diganti tanpa persetujuan)

PHP 8.4 · Laravel 13 · PostgreSQL 17 · Redis · Inertia.js 2 · React 19 + TypeScript (strict) · Tailwind CSS 4 · shadcn/ui · Lucide · Laravel Reverb · Horizon · Pest · Larastan · Pint.

## Aturan kode

**Backend**
- Logika bisnis di `app/Domain/<Modul>/Actions/*` (satu kelas, satu metode publik `handle()`/`__invoke()`). Controller tipis: FormRequest → `$this->authorize()`/Policy → Action → respons Inertia.
- Setiap model punya Policy. **Tidak ada endpoint tanpa otorisasi.** Data list selalu melewati scope visibilitas (`visibleTo($user)`).
- PK ULID (`HasUlids`). Waktu disimpan UTC. Konversi ke `config('app.office_timezone')` hanya saat tampil/menghitung `work_date`.
- Enum = PHP backed enum di `app/Domain/<Modul>/Enums`. Label Indonesia lewat metode `label()`.
- Operasi multi-tabel di dalam `DB::transaction()`. Penomoran (task, pengajuan) memakai row lock.
- Panggilan Google API **selalu** di job antrean dengan retry/backoff, tidak pernah di request HTTP sinkron, kecuali membuat dokumen baru (boleh sinkron dengan timeout 10 detik).
- Kirim notifikasi lewat kelas Notification Laravel + `via()` membaca `notification_preferences`.
- Aksi sensitif (koreksi absensi, keputusan approval, lihat selfie, ubah peran) ditulis ke `audit_logs`.
- Jangan pernah log token, selfie, NIK, atau isi `.env`.

**Frontend**
- Halaman di `resources/js/pages`, komponen per modul di `resources/js/features/<modul>`.
- Gunakan komponen shadcn/ui yang sudah ada sebelum membuat baru. Warna **hanya** dari token CSS (`var(--primary)`, kelas Tailwind yang dipetakan ke token). Tidak ada hex hard-coded di komponen.
- Glassmorphism (`.glass`) hanya untuk sidebar, topbar, command palette, popover, modal, toast.
- Semua teks UI **Bahasa Indonesia** (lihat `docs/DESIGN.md` §8). Kode, nama variabel, dan komentar dalam bahasa Inggris.
- Format tanggal/jam/angka lewat helper `resources/js/lib/format.ts` (locale `id-ID`, zona `Asia/Jakarta`).
- Setiap halaman wajib menangani: loading (skeleton), kosong (empty state), galat, dan mode gelap.
- Setiap halaman dibangun untuk **dua shell**: `DesktopLayout` (≥ 1024px, tablet 768–1023 memakai rail) dan `MobileLayout` (< 768px: app bar + tab bawah). Bila tata letak berbeda jauh, buat `*.desktop.tsx` dan `*.mobile.tsx` yang berbagi hook data yang sama. Ikuti matriks fitur di `docs/PLATFORM.md` §3; fitur yang dibatasi di mobile menampilkan versi baca-saja atau banner "Tersedia di desktop", bukan tata letak desktop yang terpotong.
- Aksesibilitas: label pada input, fokus terlihat, bisa dioperasikan keyboard.

**Uji**
- Setiap Action dan Policy punya test Pest. Alur kritis (check-in, tutup hari, approval, pindah task, sinkron anggota workspace, rumus metrik) wajib punya test fitur.
- Google API di-mock (`Http::fake()` / fake client). Jangan memanggil Google sungguhan di test.
- Waktu dikunci dengan `$this->travelTo()` untuk test absensi.

## Alur kerja agent

1. Baca dokumen terkait sebelum mulai. Ringkas rencana singkat (file yang akan dibuat/diubah) lalu kerjakan.
2. Kerjakan dalam langkah kecil. Setelah tiap langkah jalankan:
   `composer test` · `composer lint` · `npm run typecheck` · `npm run lint`
3. Jangan menandai pekerjaan selesai jika ada test merah atau error tipe.
4. Jangan menambah paket baru tanpa menjelaskan alasannya di ringkasan akhir.
5. Akhiri setiap tugas dengan ringkasan: apa yang dibuat, cara mencoba manual, keputusan yang diambil, dan hal yang belum selesai.
6. Jika instruksi bertentangan dengan dokumen di `docs/`, **berhenti dan tanyakan**. Jangan menebak.

## Perintah

```bash
composer run dev:win  # Windows + Herd: vite + reverb + queue:work + schedule:work
composer run dev      # Linux/CI: server + horizon + reverb + vite
composer test         # pest --parallel
composer lint         # pint --test && phpstan analyse
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
```

## Definition of Done

- [ ] Sesuai acceptance criteria di prompt sprint
- [ ] Policy + test otorisasi
- [ ] Test fitur hijau, lint & typecheck bersih
- [ ] UI terang & gelap dicek, teks Bahasa Indonesia
- [ ] Tampilan mobile (375px) dan desktop (1440px) sesuai mockup & `docs/PLATFORM.md`; tablet (834px) tidak rusak; input mobile 16px, target sentuh ≥ 44px
- [ ] Migrasi bisa di-rollback
- [ ] Dokumen `docs/` diperbarui bila ada perubahan skema/keputusan
