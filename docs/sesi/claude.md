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

## Bagian 2 + 3 (13 Okt 2026) — selesai, digabung di `claude/android-bagian-2`
- Worktree: `../ruang-kerja-bagian2` (branch `claude/android-bagian-2`, berisi merge Bagian 3 `0cfdcad`) dan `../ruang-kerja-bagian3` (`claude/android-bagian-3`). Basis: `claude/android-bagian-1`. Belum di-push.
- Backend: B2-A absensi `b1c986a`, B2-B beranda/briefing/pengumuman/kinerja `5363323`, B2-C inbox/cari/notifikasi/FCM `86bd928`, B3-A1 tugas `403ed04`, B3-A2 workspace/otomasi `bf65902`, B3-B catatan `5e34b0c`, B3-C obrolan `4fc5b86`. Kontrak: `docs/sesi/ponsel-b2a…b3c-*.md`. Rute per paket di `routes/api/auth/*.php` (dimuat glob di routes/api.php, `b126575`).
- Aplikasi: Absensi, Beranda+dashboard Kadiv/HR+briefing+kinerja, Inbox/pengumuman/cari/buat cepat/pengaturan notifikasi, Tugas, Workspace+otomasi, Catatan (teks polos; berformat = baca-saja), Obrolan.
- Verifikasi gabungan: Pest 3.700/3.702 (2 gagal = anggaran query `/manajemen` & `/peran/direktur`, pra-ada sejak sebelum Bagian 1) · lint hijau · tsc/eslint app hijau · APK release + cold-start ×2 · **APK uji ke server lokal**: login staf & Kadiv, Beranda, Tugas, detail tugas titipan, Absen, Obrolan, Workspace board, Catatan, Inbox, Pengaturan, Lainnya, mode gelap — tampil benar; perbaikan dari verifikasi: kaca buram penuh di Android + label kantor (`d0e0f94`).
- Sisa kecil: sorotan fokus persegi pada tombol bundar saat navigasi keyboard; celah antara dock Absen dan tab bar menampilkan isi di belakang.
- Menunggu pemilik: Firebase (push), kredensial Google Drive (lampiran/dokumen), editor catatan berformat + templat notulensi di ponsel, cakupan `GET /orang` untuk staf (DM ke sembarang rekan), realtime obrolan (Bearer di /broadcasting/auth), deploy backend sebelum APK bisa dipakai di produksi.
- Berikutnya: Bagian 4 (Persetujuan & rapat) dari branch ini.

## Bagian 4 (13 Okt 2026) — selesai di `claude/android-bagian-4`
- Worktree `../ruang-kerja-bagian4` (branch `claude/android-bagian-4`, basis `c4487f9` = Bagian 1–3). Belum di-push.
- Keputusan pemilik (`05c9124`, `docs/fitur/aplikasi-ponsel-bagian.md`): video rapat LiveKit native; geser kanan = setujui setelah 6 detik tanpa "Urungkan", geser kiri = sheet Tolak; notulensi dari ponsel = templat paragraf polos (`StartQuickMinutes` `plain`, API `polos: true`, `43b464a`).
- Backend: B4-A pengajuan/persetujuan/delegasi/batal-disetujui `fc6d37b` (daftar = `GET /persetujuan/daftar`, karena `/persetujuan` = persetujuan privasi), B4-B rapat/notulen/tindak lanjut/video token/moderasi/notulen otomatis/jadwal manajemen `3e4a978`, B4-C laporan harian/riwayat/tim/monitoring `b612a92`. Kontrak `docs/sesi/ponsel-b4a…b4c-*.md`.
- Aplikasi: Laporan (`2faf71b`…`f9dc061`), Rapat+kalender+notulen (`198e06a`…`911efc7`), Video native (`30fbac1`…`bbe5e94`), Pengajuan (`0623744`…`b5c897c`), Persetujuan (`c49c24b`…`6e574aa`), integrasi (`ac565bc`, `d26da8a`).
- Paket baru: `@livekit/react-native`, `@livekit/react-native-webrtc`, `livekit-client`, `@livekit/react-native-expo-plugin`, `@config-plugins/react-native-webrtc`, `expo-image-picker`, `expo-document-picker`.
- Verifikasi: Pest 3.752/3.754 (2 gagal = anggaran query pra-ada) · lint hijau · tsc/eslint app hijau · APK uji ke server lokal (Kadiv): Beranda, tumpukan persetujuan + geser setujui + Urungkan (tidak ada POST, kartu kembali) + kirim otomatis 6 detik, detail persetujuan, pengajuan saya, agenda & detail rapat, form laporan — tampil benar.
- **Belum diverifikasi:** ruang video live (tanpa LiveKit lokal saat uji; layar menampilkan "belum disiapkan"); notulen otomatis end-to-end.
- Butuh izin pemilik: `expo-screen-orientation` (lanskap video), `expo-keep-awake`, layanan latar kamera/mikrofon; PiP Android belum ada. APK 173–181 MB → sarankan split ABI / AAB.
- Berikutnya: Bagian 5 (Manajemen & rilis) bila diminta; push/deploy menunggu izin.
