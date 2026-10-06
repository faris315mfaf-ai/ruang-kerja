# AGENTS.md — Aturan proyek RuangKerja untuk AI coding tool

Berlaku untuk **Claude Code, Codex, Z-AI**, dan agent lain. Baca file ini sebelum mengubah kode apa pun. File ini satu-satunya sumber aturan; `CLAUDE.md` hanya menambah hal khusus Claude Code.

| Agen | Membaca | Skill proyek | Pengaturan |
|---|---|---|---|
| Codex | `AGENTS.md` | `.agents/skills/` (`$sprint`, `$cek-ui`, `$cek-lokal`, `$tinjau`) | `.codex/config.toml` (sandbox workspace-write + jaringan lokal; proyek harus *trusted*) |
| Claude Code | `CLAUDE.md` → `@AGENTS.md` | `.claude/skills/` (`/sprint`, `/cek-ui`, `/cek-lokal`, `/tinjau`) | `.claude/settings.json` |
| Z-AI / lainnya | `AGENTS.md` | — | — |

Skill proyek ditulis sekali di `.agents/skills/`, lalu `node scripts/sync-agent-skills.mjs` menyalinnya ke `.claude/skills/` (CI memeriksa keduanya sama). Jangan mengedit `.claude/skills/` langsung.

## Konteks

RuangKerja adalah aplikasi kantor **internal** (puluhan karyawan) untuk absensi, workspace, kolaborasi task, dan monitoring kerja **berbasis output**. Terintegrasi dengan Google Workspace. Sumber kebenaran:

- `docs/PRD.md`: apa yang dibangun dan fase-nya. **Jangan membangun fitur Fase 2/3 kecuali diminta.**
- `docs/DATABASE.md`: skema. Ikuti nama tabel/kolom persis. Jika perlu mengubah skema, perbarui dokumen ini dalam commit yang sama.
- `docs/ARCHITECTURE.md`: struktur folder, alur, otorisasi.
- `docs/DESIGN.md` + `resources/css/tokens.css`: tampilan.
- `docs/mockups/INDEX.md` + `docs/mockups/png/`: **mockup acuan setiap layar** (desktop & mobile). Lihat PNG-nya sebelum membangun layar.
- `docs/SETUP-LOKAL.md`: lingkungan lokal Windows (Herd di https://ruangkerja.test, Docker untuk Postgres/Redis/Mailpit). Horizon & pail tidak dipakai di Windows; di macOS keduanya jalan (lihat §10 Catatan macOS).
- `docs/PLATFORM.md`: **pemisahan tampilan desktop & mobile** (breakpoint, shell, matriks fitur). Setiap halaman wajib punya tata letak desktop DAN mobile.

## Stack (jangan diganti tanpa persetujuan)

PHP 8.4 · Laravel 13 · PostgreSQL 17 · Redis · Inertia.js 3 · React 19 + TypeScript (strict) · Tailwind CSS 4 · shadcn/ui · Lucide · Vite+ (oxlint + oxfmt, `vp check`) · Laravel Reverb · Horizon · Pest · Larastan · Pint.

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
- Glassmorphism (`.glass` / `.glass-strong`) hanya untuk menu bar, Dock, Rail, tab bar, command palette, popover, modal, sheet, toast. Sistem desain = **Arus** (`docs/DESIGN.md`, panduan agent modul `docs/design/ARUS-GUIDE.md`, contoh hidup `/dev/komponen`).
- Semua teks UI **Bahasa Indonesia** (lihat `docs/DESIGN.md` §8). Kode, nama variabel, dan komentar dalam bahasa Inggris.
- Format tanggal/jam/angka lewat helper `resources/js/lib/format.ts` (locale `id-ID`, zona `Asia/Jakarta`).
- Setiap halaman wajib menangani: loading (skeleton), kosong (empty state), galat, dan mode gelap.
- Setiap halaman dibangun untuk **dua shell**: `DesktopLayout` (≥ 1024px MenuBar + Dock; tablet 768–1023 memakai Rail 96px) dan `MobileLayout` (< 768px: app bar + tab bawah). Bila tata letak berbeda jauh, buat `*.desktop.tsx` dan `*.mobile.tsx` yang berbagi hook data yang sama. Ikuti matriks fitur di `docs/PLATFORM.md` §3; fitur yang dibatasi di mobile menampilkan versi baca-saja atau banner "Tersedia di desktop", bukan tata letak desktop yang terpotong.
- Aksesibilitas: label pada input, fokus terlihat, bisa dioperasikan keyboard.

**Uji**
- Setiap Action dan Policy punya test Pest. Alur kritis (check-in, tutup hari, approval, pindah task, sinkron anggota workspace, rumus metrik) wajib punya test fitur.
- Google API di-mock (`Http::fake()` / fake client). Jangan memanggil Google sungguhan di test.
- Waktu dikunci dengan `$this->travelTo()` untuk test absensi.

## Alur kerja agent

1. Baca dokumen terkait sebelum mulai. Untuk sprint/fitur baru, tunjukkan rencana singkat (file yang akan dibuat/diubah) ke pengguna **sebelum** menulis kode; tugas kecil boleh langsung dikerjakan.
2. Kerjakan dalam langkah kecil. Setelah tiap langkah jalankan:
   `composer test` · `composer lint` · `npm run typecheck` · `npm run lint` · `npm test`
3. Jangan menandai pekerjaan selesai jika ada test merah atau error tipe.
4. Jangan menambah paket baru tanpa menjelaskan alasannya di ringkasan akhir.
5. Akhiri setiap tugas dengan ringkasan: apa yang dibuat, cara mencoba manual, keputusan yang diambil, dan hal yang belum selesai.
6. Jika instruksi bertentangan dengan dokumen di `docs/`, **berhenti dan tanyakan**. Jangan menebak.
7. Jalankan test & lint sendiri; jangan meminta pengguna menjalankannya. Commit per langkah logis dengan format Conventional Commits (pesan berbahasa Indonesia). Jangan `git push`, `migrate:fresh`, atau `docker compose down` tanpa izin.
8. **Jangan membaca atau menampilkan isi `.env`** (juga `secrets/`). Cek konfigurasi lewat `php artisan about` / `php artisan config:show <kunci>`; minta pengguna mengisi rahasia sendiri.
9. Untuk memeriksa tampilan, pakai skill `cek-ui`: `node scripts/ui-shots.mjs <rute> --akun <email>` (screenshot 1440/390 terang & malam + laporan galat), lalu bandingkan dengan `docs/mockups/png/` dan `docs/ruangkerja-design/`. Agen dengan browser sendiri boleh memakainya untuk interaksi.

## Lingkungan lokal

- **macOS (mesin utama saat ini):** Laravel Herd menyajikan `https://ruangkerja.test`; layanan via `docker compose` (OrbStack/Docker Desktop) dengan port pengganti (`docs/SETUP-LOKAL.md` §10: Postgres 5434, Redis 6380, Mailpit UI 8026, Reverb 8081). Bila `php`/`composer`/`herd` tidak ditemukan di shell agen: `export PATH="$HOME/Library/Application Support/Herd/bin:$PATH"`. Proses dev: `composer run dev`; untuk sekadar melihat UI cukup `npm run build`.
- **Windows:** Herd + Git Bash, `composer run dev:win` (Horizon & pail tidak jalan).
- Jangan menjalankan `php artisan serve` kecuali untuk uji OAuth Google (`docs/SETUP-LOKAL.md` §6).
- Akun demo lokal (sandi `password`, hanya `APP_ENV=local` + `DEMO_LOGIN_ENABLED`): `admin@`, `direksi@`, `hr@`, `kadiv@`, `anggota@`, `programmer@demo.test`, `maya.lestari@demo.test`. Setelah masuk, pemilih akun demo di bagian atas shell berpindah antar persona.

## Serah terima antar agen (Claude Code ↔ Codex)

Pengguna bisa berpindah agen di tengah pekerjaan (mis. kuota habis). Agen berikutnya tidak melihat percakapan sebelumnya, jadi keadaan kerja harus ada di repo:

- **`docs/sesi/<agen>.md`** (`claude.md`, `codex.md`; hanya ditulis agen pemiliknya, templat di `docs/sesi/README.md`) memuat tugas yang sedang berjalan: tujuan, branch/worktree, langkah yang sudah selesai (dengan hash commit), langkah berikutnya, keputusan yang sudah diambil pengguna, perintah verifikasi, dan hal yang sengaja tidak disentuh. Perbarui setiap selesai satu langkah logis dan sebelum berhenti; kosongkan (kembalikan ke templat) bila tugas selesai.
- Commit sering. Pekerjaan setengah jadi di-commit sebagai `wip(<modul>): …` di branch fitur, bukan dibiarkan tak ter-commit, dan jangan memakai `git stash` untuk menitipkan pekerjaan antar agen.
- Agen yang melanjutkan: baca `docs/sesi/<agen>.md` milik agen sebelumnya, `git log --oneline -15`, dan `git status` dulu; jangan mengulang pekerjaan yang sudah di-commit.
- Hal yang hanya ada di memori/percakapan satu agen (preferensi pengguna, keputusan) dipindah ke dokumen di `docs/` atau `AGENTS.md`.

## Kerja paralel (Claude Code dan Codex bersamaan)

- **Satu agen = satu worktree + branch + lingkungan sendiri.** Siapkan dengan `bash scripts/agen-mulai.sh <agen> [branch]` (mis. `codex codex/f2-rapat` → `../ruang-kerja-codex`, https://ruangkerja-codex.test). Untuk worktree yang dibuat Claude Code sendiri (`.claude/worktrees/*`): `bash scripts/agen-mulai.sh claude --di-sini`. Skrip memberi database dev `ruangkerja_<agen>`, database test `ruangkerja_testing_<agen>` (berkas `.testing-db`, dibaca `tests/bootstrap.php`), prefiks Redis/cache sendiri, dan situs Herd sendiri. **Jangan menjalankan `composer test` di worktree tanpa `.testing-db`** bila agen lain juga sedang menjalankan test. Bersihkan: `bash scripts/agen-selesai.sh <agen> [--hapus-db]`.
- Checkout utama (`main`) hanya untuk integrasi. Jangan dua agen di satu folder.
- **Klaim tugas** di `docs/PEMBAGIAN-TUGAS.md` sebelum mulai; satu modul = satu agen dari backend sampai frontend dan test. Tulis hanya di "folder milik" modul itu, migrasinya sendiri (timestamp penuh, unik), test-nya, dan seksi tabelnya di `docs/DATABASE.md`. Rute modul di berkas sendiri `routes/<modul>.php` (satu baris `require` di `routes/web.php`).
- **Berkas bersama hanya diubah integrator:** `resources/js/components/**`, `resources/js/lib/**`, `resources/js/layouts/**`, `resources/js/types/global.d.ts`, `app/Http/Middleware/HandleInertiaRequests.php`, `bootstrap/app.php`, `composer.json`/`package.json` (paket baru), `docs/CHANGELOG.md`, `docs/HANDOFF.md`, `AGENTS.md`. Butuh perubahan di sana? Tulis di bagian "Butuh dari integrator" catatan sesi; komponen kecil yang dibutuhkan modul dibuat di folder fiturnya.
- Tanpa dev server bersamaan (port Vite/Reverb sama): lihat UI dengan `npm run build` + `node scripts/ui-shots.mjs` (`E2E_BASE_URL=https://ruangkerja-<agen>.test`).
- Sinkron: `git fetch && git rebase main` di branch agen setidaknya sekali sehari dan sebelum membuka PR; test harus hijau di worktree sendiri. Satu PR per tugas; integrator merge ke `main`.

## Gerak & animasi

Durasi & easing dari `docs/DESIGN.md` §7 (`duration-120` / `duration-180`, `ease-brand`); loop ikon/ambient boleh lebih lama tetapi frame awal = frame akhir. Animasikan hanya `transform`/`opacity` bila bisa; warna lewat token. Wajib menghormati `prefers-reduced-motion` (aturan global di `tokens.css`; loop berhenti di frame diam yang bermakna). Jangan menambah pustaka animasi baru tanpa alasan di ringkasan; utamakan CSS/`tw-animate-css`, Lottie hanya aset desainer yang dimuat lazy dan tidak di bundle awal halaman Absensi. Bila agen punya skill `animate`, `review-animations`, `apple-hig`, `mobile-native`, `break-ui`: pakai, tetapi bila sarannya bertentangan dengan `docs/`, dokumen proyek menang.

## Perintah

```bash
composer run dev      # macOS/Linux: server + horizon + reverb + vite
composer run dev:win  # Windows + Herd: vite + reverb + queue:work + schedule:work
composer test         # pest --parallel
composer lint         # pint --test && phpstan analyse
npm run typecheck     # tsc --noEmit
npm run lint          # vp check (oxlint + oxfmt)
npm test              # vitest (vp test)
node scripts/ui-shots.mjs /dashboard --akun kadiv@demo.test   # screenshot UI + galat
node scripts/sync-agent-skills.mjs                            # .agents/skills → .claude/skills
```

## Definition of Done

- [ ] Sesuai acceptance criteria di prompt sprint
- [ ] Policy + test otorisasi
- [ ] Test fitur hijau, lint & typecheck bersih
- [ ] UI terang & gelap dicek, teks Bahasa Indonesia
- [ ] Tampilan mobile (375px) dan desktop (1440px) sesuai mockup & `docs/PLATFORM.md`; tablet (834px) tidak rusak; input mobile 16px, target sentuh ≥ 44px
- [ ] Migrasi bisa di-rollback
- [ ] Dokumen `docs/` diperbarui bila ada perubahan skema/keputusan
