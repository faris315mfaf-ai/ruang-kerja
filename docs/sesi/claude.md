# Sesi claude

**Terakhir diperbarui:** 12 Okt 2026 · Claude Code (integrator) — bug-hunt & perbaikan selesai di `glm/ponsel-api`

## Tugas berjalan
Tidak ada. Bug-hunt 4 agen (API v1, aplikasi Expo, backend web, frontend web) lalu 4 agen perbaikan, semua temuan terverifikasi dan diperbaiki.

## Worktree / branch
- `glm/ponsel-api` (`/Users/godam/PROYEK/ruang-kerja-ponsel`): semua pekerjaan 9–12 Okt. **Belum di-push** (menunggu izin pemilik). Produksi spkd.store masih `f109bd68612f` — perbaikan 12 Okt **belum ter-deploy**.

## Sudah selesai (12 Okt 2026)
- `9e35718` CI: `vp check` mengabaikan `apps/mobile`.
- `394b999` aplikasi: selfie selalu gagal (expo-file-system v57), GPS basi, badge inbox, briefing, catatan, obrolan, logout/401, keyboard, dll (22 temuan).
- `3eb484f` `3aff514` `df6b138` `a880a5f` backend: token API dicabut saat ganti sandi, middleware `EnsureApiAccountUsable` (403 `password_change_required`/`two_factor_required`), device push-token unik, batas perangkat, check-in tak lagi bergantung pembuatan tugas (job setelah commit), sidik perangkat dari token, throttle, tanggal rapat ketat.
- `a5c9831` `f979664` `b589835` `cc60bdc` tugas/briefing/catatan: aturan pemilik tugas (`TaskPolicy::work`), Tugas hari ini hanya milik penonton, briefing aman bersamaan, `latestBriefing` untuk semua, `NoteHtml` list benar, catatan berformat → `mobile_editable=false` + 409 `rich_note`.
- `580d3a2` `d6821cc` `e7f2f76` `120b309` frontend web: jalur simpan editor catatan (antrean, stash lokal, bfcache), toolbar, briefing, `can.work`, tab bar.
- Verifikasi: Pest 3.411 · Vitest 839 · pint/phpstan · tsc/vp web · tsc/eslint aplikasi hijau; APK release dibangun dan lulus 2× cold start emulator `rk-uji` (tanpa FATAL, layar Masuk tampil).

## Langkah berikutnya
1. Izin pemilik → push `glm/ponsel-api`, `vendor/bin/pest --parallel --update-shards`, PR, CI, merge, CHANGELOG.
2. Izin pemilik → deploy ke produksi (perbaikan backend 12 Okt belum live; memerlukan job queue `CreateWorkPlanTasksForDay`).
3. Uji APK baru di ponsel fisik (selfie, GPS, navigator `Stack.Protected`, layar blokir wajib-ganti-sandi).

## Keputusan pengguna yang berlaku
Lihat `docs/SERAH-TERIMA-CLAUDE.md` §2. Push, merge, dan deploy hanya setelah pengguna setuju eksplisit di chat.

## Belum diverifikasi / catatan
- Perilaku editor catatan (toolbar, handoff simpan) hanya teruji unit test, belum di browser.
- `config/sanctum.php` `expiration` masih `null` (keputusan produk: token tidak kedaluwarsa otomatis).

## Verifikasi
`COMPOSER_PROCESS_TIMEOUT=0 composer test` · `composer lint` · `npm run typecheck` · `npm run lint` · `npm test` · aplikasi: `npx tsc --noEmit` · `npx eslint .` · build APK + cold start emulator.

## Jangan disentuh tanpa izin
`.env`, `secrets/`, server VPS, pengaturan repo GitHub, worktree `ruang-kerja-codex`.

## Android — pembangunan dari mockup (13 Okt 2026)
Rencana 5 bagian: `docs/fitur/aplikasi-ponsel-bagian.md`. Mockup: `docs/mockups/android/` (INDEX.md, spec/PERTANYAAN-PEMILIK.md), kanvas Artifact https://claude.ai/artifact/RqRTnjQXebU8bRRoYhW1Mj.
- **Bagian 1 (Fondasi & akun) selesai di branch `claude/android-bagian-1`** (bercabang dari `glm/ponsel-api`; belum di-push): B1 `d0c3480` (auth/TOTP/lupa sandi/konfigurasi), B2 `f3fca2b` (privasi/perangkat), F1 `052032d` `05bf499` (fondasi UI + paket disetujui), S1a `3ecc5fe` `a487d97` `3bf8043` (alur masuk, kunci biometrik; paket `expo-local-authentication`), S1b `0687453` `f96ffe4` `e44b059` `3d9c81c` `ffd9e9b` (profil/pengaturan/privasi).
- Verifikasi: Pest 3.472/3.474 (2 gagal pra-ada, lihat bawah) · lint hijau · app tsc/eslint/expo export hijau · APK release dibangun · cold-start emulator ×2 tanpa FATAL, layar Masuk tampil benar.
- **Gagal pra-ada, bukan dari Bagian 1:** `PageQueryCountTest` — `/manajemen` 71 query (anggaran 69) dan `/peran/direktur` 66 (anggaran 65); gagal sama di `120b309` dan `3488a33` (sebelum Bagian 1) padahal run penuh 12 Okt hijau; sebab belum ditemukan (bukan N+1: tes pertumbuhan lolos).
- **Belum diverifikasi:** layar setelah masuk (tab bar kapsul, Beranda, Lainnya, Pengaturan) di emulator — butuh API terjangkau dari emulator (build uji dengan `EXPO_PUBLIC_API_URL` + cleartext).
- Bagian 2 dan 3 (paralel) berikutnya; Bagian 2 wajib membungkus dialog izin dengan `useAppLock().tahanKunci(...)`.
