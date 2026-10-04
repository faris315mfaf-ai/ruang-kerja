# Sprint 0 — Fondasi proyek (Mac)

Dibangun ulang di Mac pada 5 Okt 2026. Kode Sprint 0–4 dari laptop Windows tidak pernah sampai ke GitHub, jadi pemilik produk memutuskan mulai lagi dari Sprint 0.

## Acceptance criteria

| Kriteria | Status |
|---|---|
| `docker compose up -d` + `composer run dev`/`dev:win` → https://ruangkerja.test tampil benar terang & gelap, desktop (sidebar & rail) dan 390px (app bar + tab bawah), console tanpa error | ✓ (dicek dengan build produksi di 1440, 375; terang & gelap) |
| `composer test`, `composer lint`, `npm run typecheck`, `npm run lint` hijau | ✓ Pest 97 test · Pint · Larastan level 8 · tsc · `vp check` · Vitest 38 test |
| Tidak ada warna hex hard-coded di komponen | ✓ (hanya di `tokens.css`, `app.css`, blade root, manifest/ikon) |
| Dokumen & konfigurasi repo utuh | ✓ (`docs/`, `.claude/`, AGENTS.md, CLAUDE.md, compose.yml tidak ditimpa; formatter mengecualikan `docs/`, `.claude/`, `*.md`) |

## Yang dibuat

- Kerangka Laravel 13.34 dari `laravel/react-starter-kit` (dev-main): Inertia 3, Fortify, Wayfinder, Vite+.
- PostgreSQL (dev `ruangkerja`, test `ruangkerja_testing`) + Redis (predis) untuk cache, session, queue. PK `users` ULID + kolom `theme`.
- Paket: Reverb, Horizon, Pulse, Socialite, spatie/laravel-permission (morph key ULID), Pest 4, Larastan level 8, @tanstack/react-table, @dnd-kit, cmdk, date-fns, @fontsource, @laravel/echo-react.
- Token desain (`resources/css/tokens.css`) dipetakan ke Tailwind 4 `@theme` dan variabel shadcn/ui. Font self-host. Latar gelap dua cahaya radial.
- Shell: `AppLayout` → `DesktopLayout` (sidebar glass 240px ↔ rail 56px, rail otomatis 768–1023px, topbar glass dengan breadcrumb, ⌘K, Check-in, lonceng) atau `MobileLayout` (app bar 56px, tab bawah glass Beranda · Absen · Tugas · Inbox · Menu, sembunyi saat keyboard terbuka). `useBreakpoint()` aman SSR.
- Komponen mobile: `AppBar`, `TabBar`, `BottomSheet`, `SwipeableRow`, `Fab`, `ChipScroller`. Komponen bersama: `EmptyState`, `BrandMark`, `UserAvatar`, `ThemeSegmented`.
- Halaman: `/dashboard` (empty state), `/menu` (MMenu), placeholder untuk modul berikutnya (`routes/web.php` `$upcoming`).
- Tema system/terang/gelap: cookie + `users.theme` (`PATCH /settings/theme`).
- Login demo lokal: tombol per akun di halaman login (hanya `APP_ENV=local` + `DEMO_LOGIN_ENABLED=true`). Registrasi publik nonaktif.
- `lib/format.ts` (id-ID, Asia/Jakarta) + Vitest, `config/branding.php`, `config('app.office_timezone')`, struktur `app/Domain/*`.
- PWA: manifest, ikon (dibuat ulang dengan `php scripts/generate-icons.php`), `offline.html`, service worker (hanya aset statis, didaftarkan di produksi).
- CI: `.github/workflows/ci.yml` (lint + test dengan Postgres & Redis).
- Seluruh UI bawaan starter kit diterjemahkan ke Bahasa Indonesia; `lang/id/*` untuk pesan validasi & auth.

## Cara mencoba

1. `docker compose up -d`
2. `composer run dev` (Mac/Linux) atau `composer run dev:win`
3. Buka https://ruangkerja.test → pilih akun di "Masuk cepat (demo lokal)", mis. **Dimas Pratama (Kepala Divisi)**. Sandi semua akun demo: `password`.
4. Ubah lebar jendela: ≥ 1024 sidebar penuh, 768–1023 rail, < 768 tampilan ponsel. Ganti tema di menu profil (kiri bawah) atau tab Menu.

## Keputusan

- **Inertia 3 + Vite+** (starter kit resmi Laravel 13), bukan Inertia 2 + ESLint. `npm run lint` = `vp check` (oxlint + oxfmt). Disetujui pemilik produk.
- `routes/web.php` memakai placeholder untuk menu yang modulnya belum ada; tiap sprint mengganti entrinya.
- Port Reverb dibaca dari `REVERB_SERVER_PORT` (bukan `--port=8080` tetap) agar bisa 8081 di Mac.
- Vite memakai sertifikat Herd `ruangkerja.test` (`detectTls`).
- Berkas terbitan paket (config Horizon/Pulse, migrasi Pulse) dikecualikan dari Larastan.
- Token baru `--on-brand` dan `--on-danger` untuk teks di atas gradien/merah (kontras gelap).

## Sisa / catatan

- Ekstensi Claude di Chrome belum dipasang (dipakai `/cek-ui`).
- Bundle `createLucideIcon` ~376 kB; dicek ulang di Sprint 10 (pengerasan).
- Repo GitHub masih public; belum di-push.
