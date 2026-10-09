# Sesi ponsel

**Terakhir diperbarui:** 9 Okt 2026, 10.46 · ZCode (GLM)

## Tugas berjalan
**Tahap 0 aplikasi Android (Expo)** — fondasi identitas (nama paket + `assetlinks.json`), kebijakan privasi publik, dan fondasi perangkat (`devices`). Tugas #18 di `docs/PEMBAGIAN-TUGAS.md`; rencana induk `docs/fitur/aplikasi-ponsel-rencana.md`.

## Worktree / branch
`/Users/godam/PROYEK/ruang-kerja-ponsel` · `glm/ponsel-api` · https://ruangkerja-ponsel.test

## Sudah selesai
- `485d57b` klaim tugas di papan (`docs/PEMBAGIAN-TUGAS.md` baris 18)
- `12210cc` endpoint `assetlinks.json` + identitas paket — `config/branding.php` (`ANDROID_PACKAGE` default `store.spkd.ruangkerja`, `ANDROID_CERT_SHA256`), `routes/android.php`, test `tests/Feature/Android/AssetLinksTest.php`
- `1bf62f9` panduan identitas Android — keystore, cara ambil SHA-256, assetlinks (`docs/deploy/ANDROID-IDENTITAS.md`)
- `debb9a2` runbook akun & tooling Tahap 0 untuk pemilik (`docs/deploy/ANDROID-AKUN.md`: Play Console, Expo/EAS, Firebase/FCM, keystore, checklist)
- `807d8c6` taut silang runbook akun ↔ panduan identitas
- `4d2ce6f` fondasi devices — migrasi `devices` (rollback teruji), model + `DevicePlatform`, Actions `RegisterDevice`/`UpdateDevicePushToken`/`RevokeDevice` (advisory lock, maks 5 perangkat, audit `device.revoked`), `DevicePolicy` (hanya pemilik; HR & Super Admin sengaja tanpa akses), 11 test Pest; `docs/DATABASE.md` §8
- `bc1b1d2` halaman kebijakan privasi publik `/kebijakan-privasi` tanpa login (Blade mandiri tanpa shell Inertia; `/privasi` tetap halaman "Privasi & data saya" yang ter-autentikasi)

**Belum push** — menunggu perintah pemilik.

## Langkah berikutnya
1. **Tahap 1 — fondasi API v1:** pasang Sanctum (token per perangkat), `routes/api.php` dengan prefix `v1`, endpoint auth perangkat, absensi check-in/check-out (`client_id` ULID idempoten), Tugas Saya, Inbox feed (rencana §3 M0 backend butir 4–6, tabel §5 B4–B6).
2. Input pemilik yang menahan: SHA-256 sertifikat (`ANDROID_CERT_SHA256`), `BRANDING_COMPANY_NAME`, `PRIVACY_CONTACT`, dan keputusan final nama paket (default `store.spkd.ruangkerja` — sekali terbit di Play Store tidak bisa diubah).
3. Konten `/kebijakan-privasi` masih **draf**: menunggu persetujuan pemilik + pengisian `BRANDING_COMPANY_NAME` dan kontak.
4. Push + PR setelah izin pemilik.

## Keputusan pengguna yang berlaku
- **9 Okt:** jalur **Expo native penuh** — TWA/Bubblewrap dan Capacitor **digugurkan** (usulan TWA→Capacitor di rencana §2 tidak dipakai; PRD §28 memang sudah menulis React Native/Expo, jadi tidak perlu diubah).
- **9 Okt:** Android diprioritaskan di atas Canvas.
- Push/PR/deploy tetap menunggu perintah eksplisit pemilik.

## Butuh dari pemilik / integrator
- **Pemilik:** akun Play Console + Firebase + Expo/keystore (runbook `docs/deploy/ANDROID-AKUN.md`), SHA-256 sertifikat, nama paket final, `BRANDING_COMPANY_NAME`, `PRIVACY_CONTACT`.
- **Integrator:** isi `docs/CHANGELOG.md` saat merge.

## Verifikasi
- Sesi koding 9 Okt pagi (s.d. `bc1b1d2`): suite Pest **3.249 test lulus** (paralel), lint/typecheck bersih.
- Verifikasi ulang 9 Okt (agen dokumentasi): `composer lint` (Pint + Larastan), `npm run typecheck`, `npm run lint` **bersih**; test branch (`Android`, `Devices`, `Privacy`) **29 lulus**; total suite tetap **3.249 test**. Run paralel penuh di mesin yang sibuk memunculkan kegagalan sporadis `SQLSTATE[40P01]` (deadlock Postgres) saat setup DB per-proses — jumlahnya berubah-ubah antar run (17 lalu 37) dan selalu di tahap migrasi/drop tabel, jadi **bukan regresi branch**; jalankan ulang di mesin lebih sepi bila butuh suite penuh hijau.
