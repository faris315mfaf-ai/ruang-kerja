# Serah terima ke Claude Code — RuangKerja

**Dibuat:** Sabtu, 10 Okt 2026 malam · oleh ZCode (GLM) · untuk dilanjutkan di **Claude Code**.
**Branch acuan:** `glm/ponsel-api` (`2149b25`), worktree `/Users/godam/PROYEK/ruang-kerja-ponsel`.
**Status singkat:** aplikasi Android (Expo) **v2.1 fungsional** (6 fitur paritas), API v1 lengkap + live di produksi, **~28 commit belum push** (token `gh` pemilik kedaluwarsa), APK `RuangKerja-v2.1-fix.apk` di Desktop pemilik.

> Dokumen ini berdiri sendiri. Baca berurutan: (1) berkas ini (2) `AGENTS.md` (3) `docs/sesi/ponsel.md` (kontrak API + catatan aplikasi paling detail) (4) `docs/sesi/glm.md`. Aturan kode tetap `AGENTS.md`.

## 0. Cara memulai di Claude Code

1. Buka `/Users/godam/PROYEK/ruang-kerja-ponsel` (branch `glm/ponsel-api`).
2. Prompt pembuka:
   ```text
   Kamu melanjutkan proyek RuangKerja (Laravel 13 + Inertia + aplikasi Android Expo). Baca berurutan:
   1) docs/SERAH-TERIMA-CLAUDE.md  2) AGENTS.md  3) docs/sesi/ponsel.md  4) docs/sesi/glm.md
   Bahasa balasan Indonesia. Jangan baca .env. Jangan push/merge/deploy/sentuh server
   tanpa izin eksplisit pemilik di chat. Kerjakan dari §9 "Prioritas berikutnya".
   ```
3. Isi `docs/sesi/claude.md` (templat `docs/sesi/README.md`); jangan menulis di sesi agen lain.

## 1. Status per 10 Okt 2026 malam

| Area | Status |
|---|---|
| Produksi https://spkd.store | `f109bd68612f` (API v1 penuh + fitur 9–10 Okt); health OK; 81 migrasi Ran; backup pre-deploy ada |
| GitHub `main` | **TERTINGGAL** di `c8b0384` (PR #14) — `gh auth` pemilik invalid; **jangan rebuild server dari main** |
| Branch lokal utama | `glm/ponsel-api` (worktree `ruang-kerja-ponsel`) = produksi + perbaikan crash `2149b25` (JS-only, belum deploy); `glm/catatan-minimal` (worktree `ruang-kerja-glm`) sudah termuat di ponsel-api |
| APK | `~/Desktop/RuangKerja-v2.1-fix.apk` — **sudah diverifikasi tidak force-close** (emulator API 34 arm64, 2 cold start, layar Masuk tampil). v2 lama crash (lihat §7 Jebakan J-07) |
| WhatsApp grup manajemen | LIVE (grup DAILY REPORT SPKD; format 🟢 masuk/🔴 pulang; Evolution API self-host, nomor gateway +62 895-1830-1256) |
| Worktree lain | `ruang-kerja-codex` milik Codex — jangan disentuh |

## 2. Keputusan pemilik yang BERLAKU (kumpulan semua sesi)

1. **Android = Expo/React Native UI native penuh** (PRD §28); TWA & Capacitor digugurkan; Canvas tim (saran: tldraw+Yjs) **ditunda sampai Android stabil**.
2. **Absensi → grup WhatsApp**: rencana kerja wajib poin 1–8 sebelum check-in; tiap poin otomatis jadi tugas pribadi; pesan 🟢 masuk + 🔴 pulang (durasi); lokasi deskriptif; gateway Evolution API self-host, risiko ToS disadari.
3. **Aturan sunting tugas (9 Okt)**: tugas sendiri bisa diedit/dihapus sendiri; tugas titipan (dibuat orang lain) hanya pembuat/atasan (admin workspace / manajer langsung penerima); penerima tetap bisa mengerjakan (move/plan/comment).
4. **Beranda**: hanya "Tugas hari ini" segmen Pribadi·Tim·Semua (Ruang saya dilebur; laporan harian/KPI lama/pengajuan dihapus dari dashboard); tombol tengah ponsel **Absen ↔ Workspace** bergantian (workspace kembali 1 jam sebelum pulang).
5. **Briefing pagi/sore** (08–11 & 16–18 WIB): pencatat HR+Super Admin, bisa delegasi; simpan → Inbox semua karyawan berisi isi lengkap.
6. **Editor catatan minimalis**: atas hanya judul + 3 ikon (status/tab/mode catat); toolbar bawah auto-hide.
7. **R-06**: sandi akun Direksi/HR/Super Admin hanya diatur Super Admin; sandi bawaan tidak berlaku untuk peran itu.
8. **R-14**: Permissions-Policy mikrofon hanya dokumen rapat; STT dikte catatan = **riset selesai, keputusan Google-vs-self-host masih menunggu**.

## 3. Server produksi (tanpa rahasia)

- **Aplikasi** `ssh root@187.77.118.216`, `/opt/ruangkerja`, compose `deploy-remote.sh` (migrate+seed peran+Horizon). **Deploy TANPA GitHub** (§5.1: `git archive` → scp → tukar src → `build-images.sh` → deploy-remote). Lihat prosedur lengkap di `docs/SERAH-TERIMA-GLM.md` §5.1 (masih akurat).
- **Evolution API** (WhatsApp): kontainer `evolution` profil `whatsapp` di compose server; instance `ruangkerja` state open; env di `.env` server (`EVOLUTION_*`, `WHATSAPP_GROUP_JID`, `NOTIFICATIONS_WHATSAPP_ENABLED=true`). Runbook `docs/deploy/WHATSAPP.md` (pairing QR via tunnel; pairingCode 404→ periksa instance). **Jebakan `.env`:** `sed -i` mengganti inode → kontainer bind-mount masih baca file lama; tulis ulang in-place lalu **restart kontainer app+queue + config:cache keduanya**.
- **Rapat LiveKit** `103.125.181.244` (`docs/deploy/RAPAT-VIDEO.md`); notulen otomatis worker belum dipasang (menunggu rahasia pemilik).
- **SSH transfer besar sering terputus** → unggah arsip 32 MB **terpecah 2 MB/chunk + md5** (pola loop scp per chunk; lihat riwayat perintah di sesi glm bila perlu).

## 4. Kontrak API v1 (satu sumber kebenaran)

**Baca `docs/sesi/ponsel.md` dari bagian "Endpoint live" sampai akhir** — kontrak LENGKAP semua endpoint `/api/v1` (auth, perangkat, absensi, tugas+baca/tulis+komentar+papan, catatan REST+409, obrolan+tandai-dibaca+penulis, rapat+RSVP enum `yes|maybe|no`+notulen, kalender, inbox, workspace+anggota, pengajuan, briefing), termasuk limiter (`api-v1` 60/mnt, `api-login` 10/mnt IP, `check-in` 6/mnt) dan 404-saat-flag-mati (`features.chat|notes|meetings`). Test: `tests/Feature/Api/*` (±100 test; helper `masuk*/sebagaiToken*` + **wajib `app(Factory::class)->forgetGuards()` saat ganti token**).

Prinsip kontrak: **controller API tipis di atas Action/Policy/presenter web — tidak pernah logika ganda**. Perubahan perilaku = ubah web-nya, API ikut.

## 5. Aplikasi Android (`apps/mobile/`, Expo SDK 57)

Struktur & keputusan lengkap di `docs/sesi/ponsel.md` §"Aplikasi Expo". Pokok:
- Monorepo folder sendiri (bukan workspace manager); Expo SDK 57/RN 0.86/React 19.2; expo-router; TS strict; tema Arus dari `tokens.css`; semua teks Indonesia; tab: Beranda·Tugas·**Absen tengah**·Obrolan·Lainnya.
- **Build APK (WAJIB begini):**
  ```bash
  cd apps/mobile && npx expo prebuild -p android
  cd android
  export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home   # BUKAN JBR (JDK 25 memecah CMake AGP)
  export ANDROID_HOME=$HOME/Library/Android/sdk
  ./gradlew assembleRelease --no-daemon -q
  ```
  Hasil 108 MB (semua ABI). APK di-sign **debug key** (sesi sementara; keystore resmi menunggu pemilik).
- **Uji WAJIB sebelum serahkan APK** (pelajaran J-07): emulator AVD `rk-uji` (image `system-images;android-34;google_apis;arm64-v8a`, `ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools`):
  ```bash
  emulator -avd rk-uji -no-window -no-audio -gpu swiftshader_indirect &
  adb install -r …apk && adb logcat -c && adb shell am start -n store.spkd.ruangkerja/.MainActivity
  sleep 10 && adb logcat -d | grep -E "FATAL|ReactNativeJS: [EI],"   # harus kosong; pidof harus hidup
  ```
- Dev: `EXPO_PUBLIC_API_URL=https://ruangkerja-ponsel.test/api/v1 npx expo start` (worktree punya situs Herd sendiri); default produksi otomatis.
- Verifikasi rutin: `npx tsc --noEmit`, `npx eslint .`, `npx expo export -p android`. Belum ada harness test JS di aplikasi.

## 6. Verifikasi wajib (urut, sebelum lapor)

```bash
COMPOSER_PROCESS_TIMEOUT=0 composer test    # Pest ±3.364 paralel (jangan pipe ke tail — exit code tertutup)
composer lint                               # pint + phpstan level 8
cd apps/mobile && npx tsc --noEmit && npx eslint . && npx expo export -p android && rm -rf dist
# menyentuh UI web: npm run typecheck/lint/test/build + node scripts/ui-shots.mjs
# menyentuh aplikasi: build APK + uji emulator §5 (cold start & FATAL)
# deploy: ikut §3; config:cache di kontainer app DAN queue
```

## 7. Jebakan yang SUDAH terjadi (jangan diulang)

| ID | Jebakan | Penangkal |
|---|---|---|
| J-01 | `gh auth login` browser ≠ token CLI; push gagal "Device not configured" | pemilik jalankan `gh auth login` di Terminal; push pakai `-c credential.helper= -c 'credential.helper=!gh auth git-credential'` |
| J-02 | `sed -i` `.env` → inode baru; kontainer baca file lama (perubahan "tidak berlaku") | tulis ulang in-place (python/truncate) + restart kontainer + `config:clear && config:cache` di **app dan queue** |
| J-03 | JBR Android Studio = JDK 25 → CMake AGP fatal "restricted method" | build pakai openjdk@21 (§5) |
| J-04 | scp/rsync 32 MB ke server sering "lost connection" | pecah 2 MB per chunk + md5 verify |
| J-05 | `composer test 2>&1 \| tail` menelan exit code (terlihat hijau padahal merah) | redirect ke file; baca exit + baris `Tests:` |
| J-06 | Konstanta test duplikat lintas file → fatal saat Pest parallel satu proses | pola `if (! defined('X')) { define('X', …); }` |
| J-07 | **APK v2 force close**: `UnreadProvider` bersyarat → rute (tabs) dirender di luar provider → JS fatal di rilis | sudah diperbaiki `2149b25`; pelajaran: **setiap APK wajib lulus uji emulator §5**; provider konteks selalu bungkus navigator |
| J-08 | Guard sanctum cache user antar request dalam satu test | `app(Factory::class)->forgetGuards()` sebelum ganti token |
| J-09 | Sanction default `personal_access_tokens` bigint ≠ PK ULID proyek | migrasi sudah `ulidMorphs` (jangan regenerate bawaan) |
| J-10 | Nama rute/id kontainer Evolution: pairingCode 404 | instance harus `ruangkerja`; lihat runbook WHATSAPP.md §5 |

## 8. Yang menunggu pemilik (kalau ditanya "apa kurang?")

1. `gh auth login` → push `glm/ponsel-api` + PR + CI + merge (SHARDS: jalankan `vendor/bin/pest --parallel --update-shards` tanpa `--processes`; isi `docs/CHANGELOG.md`; bersihkan worktree glm+ponsel setelah merge, jangan sentuh codex).
2. Uji APK v2.1 di ponsel fisik pemilik (satu-satunya gerbang tersisa sebelum disebar).
3. Akun: Play Console/Expo EAS/Firebase + keystore resmi → isi `ANDROID_CERT_SHA256` (assetlinks aktif), push FCM, privasi final (`BRANDING_COMPANY_NAME`, kontak, Pasal 56 DeepSeek) — runbook `docs/deploy/ANDROID-AKUN.md`.
4. Rahasia yang menunggu pemilik: `EMPLOYEE_DEFAULT_PASSWORD` (reset massal), worker notulen (DNS `notulen.spkd.store` + 2 rahasia + `MINUTES_LLM_API_KEY`), kredensial Google (Drive/Docs), secret GitHub Actions.
5. Keputusan produk: STT dikte (Google vs self-host), fitur Tahap 4 aplikasi (biometrik/integritas/offline/wajah/widget), `FEATURE_CHAT` di produksi (nyala/belum? aplikasi menampilkan "belum diaktifkan" bila mati), iOS nanti, Sentry.

## 9. Prioritas berikutnya (kalau pemilik bilang "lanjut")

1. **P0** gh push + PR + merge + CHANGELOG + shards + bersih-bersih (setelah pemilik `gh auth login`).
2. **P1** Deploy `2149b25` (fix crash, JS-only: cukup build-images ulang? — TIDAK, APK embed JS: **tidak perlu deploy server**; cukup bagikan APK baru; server sudah `f109bd6`).
3. **P2** Uji lapangan ponsel fisik → perbaiki temuan → APK ramping (`abiFilters arm64-v8a` ±40 MB) + keystore release lokal.
4. **P3** Play internal testing + FCM + Tahap 4 fitur asli urut nilai (biometrik → perangkat → integritas → offline → wajah → widget).
5. **Paralel sesuai keputusan**: worker notulen, STT, Canvas (tldraw+Yjs), `FEATURE_CHAT` produksi.

## 10. Rujukan cepat

- Kontrak API + aplikasi: `docs/sesi/ponsel.md` (PALING lengkap) · sesi GLM lama: `docs/sesi/glm.md`.
- Rencana Android: `docs/fitur/aplikasi-ponsel-rencana.md` (Expo 6 tahap, status di §9).
- Fitur baru 9–10 Okt: `docs/fitur/absensi-whatsapp.md`, `catatan.md` (+`catatan-stt.md` riset), briefing di `docs/DATABASE.md` §6.
- Deploy: `docs/SERAH-TERIMA-GLM.md` §5 (server), `docs/deploy/WHATSAPP.md`, `ANDROID-AKUN.md`, `ANDROID-IDENTITAS.md`, `RAPAT-VIDEO.md`.
- Serah terima versi GLM (riwayat): `docs/SERAH-TERIMA-GLM.md`.
