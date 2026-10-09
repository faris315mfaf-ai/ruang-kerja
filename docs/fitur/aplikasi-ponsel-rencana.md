# Rencana Pembangunan Aplikasi Ponsel (Android) — RuangKerja

> **Status:** Rencana (disiapkan 8 Okt 2026 oleh GLM/ZCode atas permintaan pemilik). Belum ada kode yang dikerjakan — dokumen ini adalah pintu masuk saat pemilik membuka §6.H.
> **Acuan:** [aplikasi-ponsel.md](aplikasi-ponsel.md) (spesifikasi hidup F3-1/F3-2), `docs/PLATFORM.md` (shell mobile-first), `docs/PRD.md` (§28 platform, §M/fase 3), `docs/SERAH-TERIMA-GLM.md` §6.H, `docs/DATABASE.md` §8.
> **Keputusan tunggal yang menahan semuanya:** pemilik membuka kembali fitur "aplikasi ponsel" yang ditahan 6 Okt 2026, dan memilih jalur M1–M3 di §2.

## 0. Ringkasan eksekutif

Aplikasi web RuangKerja **sudah mobile-first dan terpasang sebagai PWA** — 100% fungsional di ponsel lewat https://spkd.store (tab "Pasang aplikasi"). Yang belum ada hanyalah **wadah Android resmi** (APK di Play Store, ikon layar utama tanpa bilah peramban, push notification asli) dan **kemampuan perangkat asli** (biometrik masuk, integritas anti-GPS-palsu, check-in wajah, widget, offline antrean).

Rencana bertahap — setiap fase menghasilkan aplikasi yang bisa dipakai, tanpa menulis ulang aplikasi web:

| Fase | Isi | Durasi kerja | Prasyarat pemilik |
|---|---|---|---|
| **M0** Fondasi | Keputusan jalur, backend API (tabel `devices`/`face_templates`, `routes/api.php`), akun & rahasia | 3–5 hari kerja | keputusan §2, akun Play/Firebase (bisa belakangan) |
| **M1** TWA/Bubblewrap | APK resmi dari PWA yang sudah jalan | 1–2 hari | akun Play Console (US$25 sekali), nama paket, keystore |
| **M2** Capacitor inti | Push FCM, biometrik masuk, kamera wajah, sertifikat signing di CI | 1,5–2 minggu | Firebase (FCM), `assetlinks.json` aktif |
| **M3** Fitur asli | Integritas perangkat, perangkat saya, offline antrean, widget, aksi cepat — per fitur | 2–4 minggu total | Play Integrity API aktif, keputusan UU PDP §7 |
| **M4** Rilis | Track tertutup → produksi, kebijakan privasi publik, Data safety | 2–3 hari | kebijakan privasi di-host, review Google |

Total perkiraan: **4–7 minggu kerja efektif** setelah M0 selesai; M1 bisa rilis internal dalam seminggu pertama.

## 1. Kondisi saat ini — apa yang sudah siap

| Area | Status | Bukti |
|---|---|---|
| Tata letak ponsel | ✅ Lengkap, 43 layar mockup mobile-first (keputusan 6 Okt 2026), semua halaman dua shell (`MobileLayout` < 768px: app bar + tab bawah, Absen di tengah) | `docs/PLATFORM.md` §1–2.1 |
| PWA | ✅ `manifest.webmanifest` (standalone, ikon 192/512), service worker: precache shell + `offline.html`, aset cache-first, navigasi network-first; terpasang di Android via "Pasang aplikasi" | `public/sw.js`, `public/manifest.webmanifest`, registrasi di `resources/js/app.tsx` |
| Spesifikasi fitur F3-1/F3-2 | ✅ Pratinjau lengkap dengan alur, keadaan kosong/galat, catatan Expo, 19 test logika (`biometricReducer`, antrean offline, `evaluateIntegrity`, `faceOutcome`) | `docs/fitur/aplikasi-ponsel.md`, `resources/js/features/mobile-app/` |
| Backend absensi | ✅ `attendance_logs.flags` (jsonb: `mock_location` dsb. sudah dirancang), `accuracy_m`/`distance_m`, selfie retensi, pengajuan koreksi `KOR` | `docs/DATABASE.md` §2 |
| Backend yang belum ada | ❌ Tabel `devices` + `face_templates` (baru §8 DATABASE.md, belum dimigrasi), `routes/api.php` (belum ada sama sekali), Sanctum (belum terpasang), FCM, Play Integrity | lihat §5 |
| Infrastruktur | ✅ spkd.store HTTPS (Caddy), Reverb 8081 (WebSocket notifikasi realtime sudah jalan di web), server LiveKit terpisah 103.125.181.244 | `docs/deploy/` |
| Branding | ⚠️ Masih token default (`--brand-*` belum diganti branding resmi SPKD) — ikon APK ikut branding ini | `docs/SERAH-TERIMA-GLM.md` §7.8 |

## 2. Keputusan jalur: TWA → Capacitor (rekomendasi)

PRD §28 menulis "Mobile React Native di Fase 3". Rekomendasi terbaru (serah terima 8 Okt): **TWA dulu, lalu Capacitor** — dengan alasan berikut; pemilik memutuskan:

| Kriteria | TWA/Bubblewrap | **Capacitor (rekomendasi)** | React Native/Expo (PRD) |
|---|---|---|---|
| Kode yang dipakai ulang | 100% (URL PWA) | **~100%** (build Vite yang sama dibungkus WebView + plugin asli) | 0% (UI ditulis ulang; hanya API/desain yang dipakai ulang) |
| Push notification | ❌ (hanya web push) | ✅ FCM asli | ✅ |
| Biometrik/kamera/lokasi asli | ❌ | ✅ plugin | ✅ |
| Widget layar utama, layar kunci beraksi | ❌ | ✅ (M3) | ✅ |
| Play Integrity (anti GPS palsu) | ❌ | ✅ | ✅ |
| Usaha | 1–2 hari | 1,5–2 minggu (M2) | 6–10 minggu (tulis ulang semua layar) |
| Risiko | Peramban custom-tab; "dihapus Chrome" di beberapa perangkat | WebView versi mengikuti System WebView | Dua basis kode selamanya; tim kecil |
| Kecocokan dengan pratinjau F3 | — | Desain & komponen React yang sama persis | Pratinjau = spesifikasi desain (tetap berguna) |

**Keputusan pemilik 9 Okt 2026:** **jalur (b) — Expo/React Native, UI native penuh** sesuai PRD §28. TWA dan Capacitor digugurkan (UI tidak boleh WebView). Konsekuensi yang disetujui: seluruh layar mobile-first (43) ditulis ulang di React Native; web (spkd.store) tetap jalan dan tetap dirawat; backend/API menjadi satu sumber yang dipakai keduanya. Estimasi total 8–12 minggu.

## 3. Peta fase terperinci

### M0 — Fondasi (mulai kapan saja, tanpa akun Play)

**Keputusan & administrasi**
1. Pemilik menetapkan jalur (§2) dan **nama paket**: usulan `store.spkd.ruangkerja` (sekali ditetapkan tidak bisa diubah di Play Store).
2. Pemilik membuat **akun Google Play Console** (US$25 sekali bayar), **proyek Firebase** (gratis, aktifkan FCM + (M3) Play Integrity), dan **keystore upload** (Play App Signing disarankan: kunci signing dipegang Google).
3. Kebijakan privasi publik di-host (mis. `https://spkd.store/privasi`) — wajib untuk Play Store; isi mengacu `docs/fitur/rapat-video-privasi.md` + data biometrik §6.

**Backend (urut, tiap langkah test Pest + docs diperbarui di commit yang sama)**
1. Migrasi `devices` & `face_templates` sesuai `docs/DATABASE.md` §8 + kolom tambahan yang dicatat pratinjau (`name`, `os_version`, `app_version`, `biometric_login`); `attendance_consents.type=face` berversi; bisa di-rollback.
2. `DevicePolicy` (hanya pemilik perangkat; HR/Super Admin lihat metadata saja) & `FaceTemplatePolicy` (template **tidak pernah** dibaca siapa pun lewat API).
3. Actions: `RegisterDevice`, `RevokeDevice`, `ToggleBiometricLogin`, `GiveBiometricConsent`, `EnrollFaceTemplate`, `DeleteFaceTemplate` (transaksi: hapus template + `revoked_at` persetujuan + `audit_logs face_template.deleted`), `VerifyDeviceIntegrity`.
4. `routes/api.php` baru (`/api/v1/…`, prefix versi): pasang **Sanctum** (token per perangkat — sekaligus dipakai widget & sinkron latar) ATAU sesi cookie WebView (lihat §6); endpoint: perangkat, absensi check-in/check-out (`client_id` ULID idempoten), snapshot widget, Inbox feed, tugas Saya. Rute modul tetap di berkas miliknya; `routes/api.php` hanya `require`.
5. `CheckIn` method `face`: skor + liveness masuk `attendance_logs.flags`, ambang 85%, maks 3 percobaan/hari, integritas gagal **menandai** (tidak memblokir).
6. Notifikasi beraksi (approve/snooze) dengan token perangkat + kategori FCM.
7. Endpoint `/.well-known/assetlinks.json` (route Laravel, dibaca dari config; auto-check SHA-256 cert).

**Definisi selesai M0:** semua endpoint berjalan lewat test Pest (matriks Policy, idempotensi antrean, flag integritas), `docs/DATABASE.md` §8 sinkron, `php artisan migrate:rollback` bersih.

### M1 — TWA/Bubblewrap (APK dari PWA)

1. `npx @bubblewrap/cli init --manifest https://spkd.store/manifest.webmanifest` → proyek `android/` (atau Android Studio "New TWA").
2. Isi: nama paket (§M0), branding (warna `theme_color` manifest — samakan token), mode `display: standalone`, verifikasi origin via `assetlinks.json` (sudah tersedia dari M0) supaya tidak menampilkan bilah URL.
3. Build AAB → **internal testing** Play Console (buat aplikasi, isi Data safety minimum, unggah).
4. Definisi selesai: APK terpasang di ponsel uji, ikon layar utama, login & absen jalan penuh, URL bar tidak muncul, status bar mengikuti tema terang/malam.

### M2 — Capacitor inti (menggantikan TWA bila sudah stabil)

1. `apps/` baru di repo (atau folder `mobile/`): Capacitor 7 + **Server.url** ke spkd.store **atau** bundel build web lokal — keputusan teknis §6. Build web yang sama dipakai ulang (`npm run build` → `mobile/www`).
2. Plugin: `@capacitor/push-notifications` (FCM), `capacitor-plugin-biometric-auth` (masuk biometrik sesuai pratinjau), `@capacitor/camera` (check-in wajah), `@capacitor/geolocation` + `@capacitor-community/native-geolocation`? (cukup geolocation + mock-location flag), `@capacitor/app` (cold start / deep link), `@capacitor/status-bar`, splash.
3. Jembatan JS: modul `features/mobile/native.ts` — satu fasad (`native.isAvailable()`, `native.biometricUnlock()`, `native.pushRegister()`); web fallback = prilaku PWA sekarang (fitur pratinjau tetap di balik flag `FEATURE_MOBILE_APP` baru di `config/features.php`, mati di produksi sampai M4).
4. Push FCM: server kirim lewat notifikasi Laravel yang sudah ada (`via()` membaca preferensi) + kanal `fcm` baru saat `devices.push_token` ada; deep link ke rute terkait.
5. Signing di CI: keystore di GitHub Actions secret; job `mobile` build AAB.
6. Definisi selesai: notifikasi push diterima saat aplikasi dimatikan; masuk biometrik bekerja (3 gagal = kunci + fallback Google); kamera wajah hidup di WebView; uji di Android 10/13/15.

### M3 — Fitur asli bertahap (urut nilai)

| Urut | Fitur | Catatan |
|---|---|---|
| 1 | **Perangkat saya** + daftar/cabut | paling murah, fondasi kepercayaan karyawan |
| 2 | **Integritas perangkat** (lokasi palsu, root, aplikasi resmi, jam) | Play Integrity API + `isMock` dari geolocation; penolakan ramah + `KOR` |
| 3 | **Offline antrean** | antrean `SyncItem` lokal (logika `features/mobile-app/logic.ts` dipakai ulang), kirim idempoten `client_id`, konflik 409 + alasan |
| 4 | **Check-in wajah** | pendaftaran dengan persetujuan berversi v1.0 (UU PDP §6), liveness on-device, template terenkripsi server, **HR tidak pernah melihat template** |
| 5 | **Widget 4×2/2×2** + aksi cepat FAB | endpoint snapshot dari M0; widget update periodik WorkManager |
| 6 | Layar kunci beraksi (approve/snooze) | kategori notifikasi + token perangkat |

### M4 — Rilis produksi

1. Track tertutup (karyawan SPKD) → terbuka. Data safety form: biometrik = "App functionality, Optional", lokasi = absensi, tidak dijual.
2. Kebijakan privasi publik ditautkan di listing & dalam aplikasi (Pengaturan).
3. Versi API `v1` dikunci; kebijakan penghentian versi lama (min 2 versi aktif).
4. Monitoring: Sentry (ops, butuh keputusan), crashlytics Firebase bila diinginkan.

## 4. Checklist prasyarat pemilik (isi sebelum M1)

- [ ] Keputusan jalur §2 (TWA→Capacitor vs Expo) + perbarui PRD §28 bila berubah
- [ ] Nama paket Android: `store.spkd.ruangkerja`? (final, tak bisa diubah)
- [ ] Akun Google Play Console (US$25) + akses developer diberikan
- [ ] Proyek Firebase: FCM aktif; (M3) Play Integrity aktif; `google-services.json` untuk aplikasi Android
- [ ] Keystore upload dibuat & disimpan (Play App Signing disarankan)
- [ ] Kebijakan privasi publik di-host (`/privasi`) — muat data biometrik
- [ ] Branding resmi SPKD (`--brand-*` + `php scripts/generate-icons.php`) — ikon APK mengikuti
- [ ] Keputusan UU PDP §7 dokumen ini (opt-in/opt-out biometrik, retensi)

## 5. Ringkasan pekerjaan backend (satu tabel, per feat)

| # | Item | Fase | Berkas | Test |
|---|---|---|---|---|
| B1 | Migrasi `devices`, `face_templates`, `attendance_consents.type` | M0 | `database/migrations/*`, `docs/DATABASE.md` §8 | rollback test |
| B2 | `DevicePolicy`, `FaceTemplatePolicy` | M0 | `app/Policies/` | matriks peran |
| B3 | 7 Actions perangkat & wajah | M0 | `app/Domain/Devices/`, `app/Domain/Attendance/` | per Action |
| B4 | `routes/api.php` + Sanctum + prefix `v1` | M0 | `routes/api.php`, `bootstrap/app.php` | rute+otorisasi |
| B5 | Check-in `method=face` + flag integritas | M0 | `app/Domain/Attendance/Actions/CheckIn.php` | alur fitur |
| B6 | `assetlinks.json` endpoint | M0 | `routes/web.php` | isi sesuai config |
| B7 | Kanal notifikasi `fcm` + aksi layar kunci | M2 | `app/Domain/Notifications/` | preferensi+token |
| B8 | Endpoint snapshot widget | M3 | `app/Domain/Devices/Queries/` | jumlah query |
| B9 | Flag `FEATURE_MOBILE_APP` + tile/pratinjau dipindah | M2 | `config/features.php`, `HandleInertiaRequests` | 404 saat mati |

## 6. Catatan arsitektur & keamanan

- **Autentikasi:** Capacitor WebView membagi sesi cookie dengan domain `spkd.store` bila memakai `Server.url` (paling sederhana, nol infra baru); **Sanctum token per perangkat** tetap dibuat untuk widget/sinkron latar/bisa dipakai Expo nanti. Kombinasi keduanya aman (sesi = pemakaian interaktif, token = latar; cabut perangkat mematikan keduanya).
- **Template wajah:** dienkripsi saat disimpan (kolom `template` bytea), tidak pernah dikirim ke klien setelah pendaftaran, pencocokan & liveness di perangkat; hanya skor & keputusan yang dikirim. Persetujuan berversi (`attendance_consents`), pencabutan = penghapusan (audit `face_template.deleted`).
- **Integritas menandai, bukan memblokir** (keputusan pratinjau): `flags` → `is_suspicious` untuk tinjauan HR + "Ajukan koreksi" (KOR). Play Integrity diverifikasi **di server**.
- **Offline:** antrean hanya aksi yang aman ditunda (check-in/out, komentar, ubah status); tindakan approval tetap butuh daring.
- **`client_id` ULID + `client_time`** di semua aksi antrean → idempoten; konflik (409) membawa alasan siap tampil.
- **UU PDP:** biometrik = data spesifik pribadi → persetujuan eksplisit berversi, hak hapus (satu ketuk di Perangkat saya), retensi template selama akun aktif + 30 hari, catat di kebijakan privasi publik. Default **opt-in** untuk wajah (berbeda dari notulen otomatis yang opt-out — keputusan §7).
- **Platform web tidak boleh mundur:** semua perubahan UI lewat fasad `features/mobile/native.ts` dengan fallback web; fitur tetap bisa dipakai dari PWA/browser kecuali yang memang asli (widget, layar kunci).

## 7. Mutu & verifikasi tiap fase

- Backend: Pest per Action/Policy/matriks + idempotensi; `PageQueryCountTest` untuk endpoint list baru.
- Aplikasi: `npm run typecheck/lint/test` tetap berlaku (kode aplikasi ikut repo); build AAB di CI; uji manual di Android nyata (10/13/15) untuk biometrik, push termatikan, kamera, widget.
- UI: pratinjau F3-1/F3-2 adalah acuan visual; `node scripts/ui-shots.mjs` untuk halaman web terdampak; cek terang/malam + `prefers-reduced-motion`.
- Rilis M1/M2/M3 masing-masing di `docs/CHANGELOG.md` (integrator).

## 8. Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| WebView in-app jalan lambat di ponsel kentang | UX | ukur dulu (Lighthouse Absensi ponsel sudah 98); bundle tetap dipecah (U-06 pola dinamis) |
| Review Google menolak (data safety biometrik) | tertunda M4 | form diisi hati-hati; track tertutup dulu; kebijakan privasi live sebelum submit |
| Play Integrity butuh akun organisasi/verifikasi | M3 tertunda | mulai pendaftaran di M0; cek syarat D-U-N-S bila akun organisasi |
| Kehilangan keystore | tidak bisa update | Play App Signing (kunci di Google) + cadangan upload key di password manager |
| Dua jalur (web + APK) terpisah perilakunya | bug ganda | satu fasad `native.ts`; fitur asli selalu `native.isAvailable()` dulu |
| Scope melebar ke iOS | waktu | rencana ini Android dulu; Capacitor membuat port iOS murah nanti, keputusan terpisah |

## 9. Tahapan eksekusi lengkap — jalur Expo (urut, siap dikerjakan)

Legenda: **[A]** dikerjakan agen (branch + PR + CI), **[P]** pemilik (akun, rahasia, keputusan). Stack: **Expo SDK (managed) + expo-router + TypeScript**, API Laravel (Sanctum, prefix `/api/v1`), tema diturunkan dari token Arus, semua teks Indonesia. Aplikasi di folder `apps/mobile` repo yang sama. Estimasi total **8–12 minggu**; APK uji internal hadir mulai minggu ke-2.

### Tahap 0 — Keputusan & akun (0,5–1 hari pemilik, paralel dengan Tahap 1)
| # | Pengerja | Isi |
|---|---|---|
| 0.1 | **[P]** | Nama paket final `store.spkd.ruangkerja` (tidak bisa diubah) · nama tampilan "RuangKerja" · branding resmi (--brand-* bila sudah) |
| 0.2 | **[P]** | Akun Expo (EAS Build free tier) · Play Console (US$25) · Firebase proyek + FCM · keystore dikelola EAS |
| 0.3 | **[P]** | Kebijakan privasi publik spkd.store/privasi (biometrik, lokasi, kamera) |
| 0.4 | [A] | Klaim papan `docs/PEMBAGIAN-TUGAS.md` "F3 aplikasi ponsel (Expo)"; cabang `glm/ponsel-api` |

### Tahap 1 — Fondasi backend API v1 (3–5 hari agen) — tanpa ini aplikasi native tidak punya sumber data
| # | Isi | Syarat keluar |
|---|---|---|
| 1.1 | Pasang **Sanctum** (token per perangkat) + `routes/api.php` prefix `v1` (rate limit khusus) | login token + revoke teruji |
| 1.2 | Endpoint auth: login email+sandi (Fortify guard token), profil saya, ganti sandi | test matriks + 2FA SA tetap web-only sementara |
| 1.3 | Endpoint absensi: status hari ini, check-in/check-out (multipart selfie+GPS+`work_plan[]`, client_id idempoten), riwayat | test alur + flags |
| 1.4 | Endpoint tugas: TugasHariIni (segmen), tugas saya (list+detail+ubah status), penugasan atasan→pribadi | test + Policy sama dengan web |
| 1.5 | Endpoint pendukung: inbox feed, daftar workspace (Pribadi/Tim/Proyek), pengajuan (list+buat), perangkat (daftar/cabut/push-token) | test |
| 1.6 | `docs/DATABASE.md` + `docs/ARCHITECTURE.md` diperbarui; kalibrasi PageQueryCountTest endpoint baru | lint+pest hijau |

### Tahap 2 — Fondasi aplikasi Expo (1 minggu agen)
| # | Isi | Syarat keluar |
|---|---|---|
| 2.1 | Scaffold `apps/mobile` (Expo SDK terbaru, expo-router, TypeScript strict), tema Arus (warna token → TS, terang/malam, font system), lingua id | app berjalan di Expo Go |
| 2.2 | Kerangka: API client (token SecureStore, refresh/revoke), pola layar (loading skeleton/kosong/galat), komponen dasar (Button, Card, Input, Chip, BottomSheet) setara Arus | styleguide internal layar |
| 2.3 | EAS Build (profile development + preview APK) + distribusi internal (link install / Play internal) | APK uji terpasang |
| 2.4 | CI: lint/tsc/test aplikasi + EAS build di GitHub Actions | build hijau dari CI |

### Tahap 3 — Alur inti karyawan (2–3 minggu agen) — nilai pertama yang dipakai harian
| # | Layar/alur | Syarat keluar |
|---|---|---|
| 3.1 | Login (email+sandi; galat Indonesia; sesi aman) + splash | login→beranda |
| 3.2 | **Beranda**: sapaan+tanggal, kartu status absensi, **Tugas hari ini (Pribadi·Tim·Semua)**, briefing terakhir, navigasi tab (Beranda·Tugas·**Absen**·Obrolan·Lainnya — tombol tengah kontekstual seperti web) | layar utama lengkap |
| 3.3 | **Absensi penuh**: cek lokasi GPS+geofence, kamera selfie, form rencana kerja poin (+/hapus), check-in/out, riwayat | check-in nyata sukses |
| 3.4 | **Tugas**: daftar saya+detail+ubah status; tugas hasil absen tampil; penugasan atasan (buat ke bawahan) | aturan sunting ditegakkan |
| 3.5 | **Pengajuan** (list+buat cuti/izin/lembur) + **Inbox** (feed) | alur pengajuan jalan |
| 3.6 | **Push FCM** (expo-notifications): absensi diterima/tugas ditugaskan/briefing; deep link ke layar | push saat app dimatikan |
| 3.7 | Uji internal gelombang 1: 5–10 karyawan pakai harian; kumpulkan temuan | checklist lulus |

### Tahap 4 — Fitur asli & lanjutan (2–3 minggu agen, urut nilai)
| Urut | Fitur | Syarat keluar |
|---|---|---|
| 4.1 | **Masuk biometrik** (expo-local-authentication; 3 gagal=kunci, fallback Google) | alur F3-1 nyata |
| 4.2 | **Perangkat saya**: daftar/cabut perangkat+push token (backend `devices`) | kelola perangkat jalan |
| 4.3 | **Integritas perangkat**: Play Integrity verifikasi server; penolakan ramah + Ajukan koreksi (KOR); flags | mock GPS tertandai |
| 4.4 | **Offline antrean**: MMKV/SQLite queue, kirim idempoten `client_id`, konflik 409 + alasan | absen offline tersinkron |
| 4.5 | **Check-in wajah**: persetujuan berversi (UU PDP), liveness on-device, template terenkripsi server, **opt-in** | check-in wajah jalan |
| 4.6 | **Widget absensi/tugas** (expo-widget/nilai asli) + aksi cepat FAB | widget update otomatis |
| 4.7 | Realtime (opsional): obrolan & presence via Reverb (pusher-react-native) atau tunda ke fase berikut | — |

### Tahap 5 — QA & rilis produksi (1 minggu + review Google 1–7 hari)
1. [A] Regresi penuh (unit + e2e Maestro/Detox minimal alur inti), uji perangkat nyata Android 10/13/15, kuota & baterai.
2. [P] Listing Play (screenshot, deskripsi, Data safety biometrik/lokasi) → kirim review.
3. [P] Production track bertahap 10% → 50% → 100%.
4. [A] Monitoring galat (Sentry bila disetujui §10.5), kanal umpan balik, backlog iterasi.

### Aturan main antar tahap
- Satu PR per butir [A]; CI hijau; tidak ada rahasia di repo/chat (EAS secrets/server env diisi [P]).
- API v1 adalah kontrak: versi diubah hanya dengan rencana kompatibilitas (web & app memakai sama).
- Setiap endpoint baru: Policy + test (AGENTS.md); layar aplikasi wajib keadaan loading/kosong/galat + Bahasa Indonesia.
- Web spkd.store tidak berhenti dikembangkan; layar yang sudah ada di web TIDAK dihapus, aplikasi mengejar paritas bertahap (43 layar mockup = peta).

## 10. Keputusan menunggu pemilik (ringkas)

1. ~~Jalur~~ **Diputuskan 9 Okt 2026: Expo/React Native UI native penuh** (PRD §28 tetap).
2. Nama paket final (`store.spkd.ruangkerja`?).
3. Biometrik wajah **opt-in** (rekomendasi) vs opt-out.
4. Retensi template wajah (usulan: aktif + 30 hari).
5. Sentry/crashlytics dipakai atau tidak.
6. iOS ikut atau Android dulu (rekomendasi: Android dulu).
