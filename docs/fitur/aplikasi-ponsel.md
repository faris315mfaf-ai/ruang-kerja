# Aplikasi ponsel lanjutan (F3-1 · F3-2)

> **Status:** **Ditahan** (keputusan pemilik 6 Okt 2026): tidak dikerjakan sampai pemilik membuka lagi; layar pratinjau tetap bisa dicoba. Berlaku untuk login biometrik, integritas, offline, widget, check-in wajah, dan perangkat saya. Panduan pemakaian: [PANDUAN-PRATINJAU.md](PANDUAN-PRATINJAU.md). **Rencana pembangunan** (jalur TWA→Capacitor, fase M0–M4, checklist pemilik): [aplikasi-ponsel-rencana.md](aplikasi-ponsel-rencana.md).
>
> Pratinjau Fase 3 · dibangun Agen D · rute `/pratinjau/ponsel`, `/pratinjau/ponsel/{masuk,kunci,widget,integritas,offline,aksi-cepat}`, `/absensi/wajah`, `/pengaturan/perangkat` · data contoh, tidak menyimpan apa pun. Indeks: [README](README.md).

## 1. Tujuan & masalah

Fase 3 membawa RuangKerja ke **aplikasi React Native (Expo)** yang memakai desain mobile yang sama (PLATFORM.md §1). Pratinjau web ini adalah **spesifikasi hidup** untuk tim Expo:

| Fitur | Masalah | Solusi |
|---|---|---|
| **Masuk biometrik** | Masuk Google tiap kali lambat di lapangan. | Sidik jari / Face ID membuka sesi tersimpan; 3 kali gagal = dikunci, cadangan **Masuk dengan Google** (bukan kata sandi, sesuai PRD M1). |
| **Check-in wajah + liveness** | Titip absen lewat selfie foto orang lain (PRD §9 "Fake GPS di web"). | Pendaftaran wajah dengan **persetujuan biometrik berversi** (UU PDP), pemindaian kedip/toleh, ambang kemiripan 85%, maks 3 percobaan lalu kembali ke GPS + selfie. |
| **Integritas perangkat** | Fake GPS, root/jailbreak, aplikasi tidak resmi. | Pemeriksaan berurutan → penolakan **ramah** (peringatan, bukan sanksi) + langkah perbaikan + "Ajukan koreksi". |
| **Offline** | Sinyal hilang di gudang/lapangan. | Antrean perubahan lokal, kirim satu per satu saat terhubung, konflik ditampilkan dengan alasan. |
| **Layar kunci, widget, aksi cepat** | Tindakan rutin butuh membuka aplikasi. | Notifikasi beraksi (Setujui cuti dengan Face ID), widget absensi & tugas, FAB "Buat cepat". |
| **Perangkat saya** | Karyawan tidak tahu perangkat mana yang masih masuk. | Daftar perangkat, status integritas, sakelar masuk biometrik, Cabut, Hapus data wajah. |

## 2. Peran yang memakai

Semua karyawan pada ponselnya sendiri. HR hanya **meninjau** penanda integritas/wajah (tidak pernah membaca template wajah). Persona pratinjau: Dimas.

## 3. Layar

### Ringkasan · `/pratinjau/ponsel`

Kartu "Layar sistem" (masuk, kunci, widget) dan "Fitur aplikasi" (wajah, integritas, offline, aksi cepat, perangkat), panel Fondasi ponsel & Lima keadaan (MFondasi).

![Ringkasan aplikasi ponsel, desktop terang](img/aplikasi-ponsel/ringkasan-desktop.jpg)

![Ringkasan aplikasi ponsel, desktop Malam](img/aplikasi-ponsel/ringkasan-desktop-malam.jpg)

![Ringkasan aplikasi ponsel, ponsel](img/aplikasi-ponsel/ringkasan-ponsel.jpg)

### Layar sistem (masuk, kunci, widget)

Di desktop/tablet layar OS tampil di **PhoneStage**: penjelasan + panel Simulasi + Alur (langkah aktif disorot) + "Catatan untuk aplikasi Expo" di kiri, bingkai ponsel 390×844 lengket di kanan. Di ponsel layar dirender **tanpa shell** dengan strip kaca (Tutup pratinjau, judul, Simulasi).

![Masuk biometrik dalam PhoneStage, desktop terang](img/aplikasi-ponsel/masuk-desktop.jpg)

![Masuk biometrik, desktop Malam](img/aplikasi-ponsel/masuk-desktop-malam.jpg)

![Masuk biometrik layar penuh, ponsel](img/aplikasi-ponsel/masuk-ponsel.jpg)

![Masuk berhasil, desktop](img/aplikasi-ponsel/masuk-berhasil-desktop.jpg)

![Masuk berhasil, ponsel](img/aplikasi-ponsel/masuk-berhasil-ponsel.jpg)

![Layar kunci dengan notifikasi beraksi, desktop](img/aplikasi-ponsel/kunci-desktop.jpg)

![Layar kunci, desktop Malam](img/aplikasi-ponsel/kunci-desktop-malam.jpg)

![Layar kunci, ponsel](img/aplikasi-ponsel/kunci-ponsel.jpg)

![Widget sedang (4×2) absensi & tugas, desktop](img/aplikasi-ponsel/widget-desktop.jpg)

![Widget, desktop Malam](img/aplikasi-ponsel/widget-desktop-malam.jpg)

![Widget, ponsel](img/aplikasi-ponsel/widget-ponsel.jpg)

### Check-in wajah · `/absensi/wajah`

Persetujuan biometrik v1.0 (dua pernyataan wajib dicentang) → pemindaian dengan oval + langkah Posisi wajah / Kedip / Toleh kiri → Wajah terdaftar → Check-in dengan wajah → hasil. Desktop: banner "Tersedia di aplikasi ponsel" + alur dalam bingkai ponsel.

![Persetujuan biometrik, desktop](img/aplikasi-ponsel/wajah-persetujuan-desktop.jpg)

![Persetujuan biometrik, desktop Malam](img/aplikasi-ponsel/wajah-persetujuan-desktop-malam.jpg)

![Persetujuan biometrik, ponsel](img/aplikasi-ponsel/wajah-persetujuan-ponsel.jpg)

![Langkah liveness saat pemindaian, desktop](img/aplikasi-ponsel/wajah-liveness-desktop.jpg)

![Langkah liveness, ponsel (ilustrasi bila kamera tidak tersedia)](img/aplikasi-ponsel/wajah-liveness-ponsel.jpg)

### Integritas · `/pratinjau/ponsel/integritas`

Skenario `?skenario=lokasi-palsu|root|tidak-resmi|aman`. Empat pemeriksaan berjalan berurutan, lalu penolakan ramah dengan "Cara memperbaiki" bernomor, Periksa ulang, Ajukan koreksi.

![Penolakan karena lokasi palsu, desktop](img/aplikasi-ponsel/integritas-desktop.jpg)

![Integritas, desktop Malam](img/aplikasi-ponsel/integritas-desktop-malam.jpg)

![Integritas, ponsel](img/aplikasi-ponsel/integritas-ponsel.jpg)

### Offline · `/pratinjau/ponsel/offline`

Banner "Tidak ada sinyal · 4 perubahan menunggu", daftar antrean, Coba kirim sekarang.

![Antrean offline, desktop](img/aplikasi-ponsel/offline-desktop.jpg)

![Antrean offline, desktop Malam](img/aplikasi-ponsel/offline-desktop-malam.jpg)

![Antrean offline, ponsel](img/aplikasi-ponsel/offline-ponsel.jpg)

![Sinkron berjalan dengan satu konflik, desktop](img/aplikasi-ponsel/offline-sinkron-desktop.jpg)

### Aksi cepat · `/pratinjau/ponsel/aksi-cepat`

Ponsel: FAB + → lembar "Buat cepat" (Check-in, Tugas baru, Ajukan cuti, Catatan, Jadwalkan rapat, Lapor kendala, Rekam catatan suara); tekan lama FAB → langsung Tugas baru. Desktop: panel Buat cepat di samping.

![Aksi cepat, desktop](img/aplikasi-ponsel/aksi-cepat-desktop.jpg)

![Aksi cepat, desktop Malam](img/aplikasi-ponsel/aksi-cepat-desktop-malam.jpg)

![Aksi cepat, ponsel](img/aplikasi-ponsel/aksi-cepat-ponsel.jpg)

### Perangkat saya · `/pengaturan/perangkat`

Desktop: tabel perangkat (terakhir aktif, integritas, sakelar masuk biometrik, Cabut) + data wajah. Ponsel: kartu.

![Perangkat saya, desktop terang](img/aplikasi-ponsel/perangkat-desktop.jpg)

![Perangkat saya, desktop Malam](img/aplikasi-ponsel/perangkat-desktop-malam.jpg)

![Perangkat saya, ponsel](img/aplikasi-ponsel/perangkat-ponsel.jpg)

![Dialog konfirmasi cabut perangkat](img/aplikasi-ponsel/perangkat-cabut-desktop.jpg)

## 4. Alur langkah demi langkah

1. **Masuk biometrik.** Ketuk lingkaran sidik jari → "Memverifikasi…" → "Berhasil · membuka beranda" → Buka beranda. Simulasi "Tidak cocok" → 3 kali ketuk → "Biometrik dikunci sementara" → **Masuk dengan Google** → berhasil. Metode Face ID tersedia; `?keadaan=kosong` = belum diatur (hanya Google); `?keadaan=galat` = server tak terjangkau + Coba lagi.
2. **Layar kunci.** **Setujui** cuti Sari → Face ID… → Mengirim… → "Cuti Sari disetujui" + Urungkan. **Nanti** menunda pengingat. **Check-in sekarang** → buka kunci → `/absensi/wajah`. **Bersihkan** → kosong. `?keadaan=galat` → persetujuan gagal terkirim + Coba lagi.
3. **Widget.** Kecil 2×2 / Sedang 4×2 (`?skenario=sedang`). Ketuk Check-in → konfirmasi Face ID → "Masuk 07.52" → Check-out 17.00. Ketuk tugas → `/tugas`. `?keadaan=kosong` = hari libur; `?keadaan=galat` = "Belum diperbarui · terakhir 07.10".
4. **Check-in wajah.** Centang 2 pernyataan → **Setuju & daftarkan wajah** → **Mulai pemindaian** (kamera depan bila diizinkan, selain itu ilustrasi) → **Wajah terdaftar** → **Lanjut ke check-in** → **Check-in dengan wajah** → "Check-in berhasil 07.52 · Wajah cocok 98%". Simulasi: Gagal liveness, Tidak cocok (62% vs batas 85%, maks 3 percobaan → GPS + selfie), Sudah terdaftar, tidak ada jadwal, galat (tersimpan di perangkat → tautan antrean offline).
5. **Integritas.** `?skenario=lokasi-palsu` → pemeriksaan → penolakan → **Periksa ulang** → "Perangkat aman" → Lanjut check-in; atau **Ajukan koreksi** → alasan (min 10 karakter) → "Pengajuan koreksi terkirim KOR-2026-10-0007".
6. **Offline.** **Coba kirim sekarang** → Menyinkron → Terkirim satu per satu; OPS-41 konflik → Gagal + alasan → **Coba lagi** → "Semua tersinkron". Mengikuti event `online`/`offline` browser.
7. **Aksi cepat.** Tugas baru tanpa judul → "Tulis judulnya dulu." → isi → **Buat tugas** → muncul di "Baru dibuat".
8. **Perangkat.** **Cabut** → konfirmasi (Dialog desktop / BottomSheet ponsel) → hilang dari daftar. **Hapus data wajah** → konfirmasi → kosong + "Persetujuan biometrik v1.0 dicabut".

```mermaid
flowchart TD
    subgraph Wajah[Check-in wajah]
        C0{Sudah terdaftar?} -->|tidak| C1[Persetujuan biometrik v1.0]
        C1 -->|centang 2 + Setuju| C2[Pemindaian: posisi → kedip → toleh]
        C2 -->|liveness gagal| C2
        C2 -->|lolos| C3[Wajah terdaftar]
        C0 -->|ya| C4[Check-in dengan wajah]
        C3 --> C4
        C4 -->|cocok ≥ 85%| C5[Check-in berhasil]
        C4 -->|tidak cocok ×3| C6[Kembali ke GPS + selfie]
        C4 -->|server galat| C7[Simpan di antrean offline]
    end
    subgraph Integritas
        I1[Periksa: lokasi palsu, root, aplikasi resmi, jam] -->|aman| C0
        I1 -->|gagal| I2[Penolakan ramah + cara memperbaiki]
        I2 -->|Periksa ulang| I1
        I2 -->|Ajukan koreksi| I3[(Pengajuan KOR)]
    end
    subgraph Offline
        O1[Antrean lokal] -->|online| O2[Kirim satu per satu]
        O2 -->|409 konflik| O3[Gagal + alasan] -->|Coba lagi| O2
        O2 --> O4[Semua tersinkron]
    end
    C7 --> O1
```

Alur backend nanti (check-in wajah dari aplikasi Expo):

```mermaid
sequenceDiagram
    actor K as Karyawan
    participant A as Aplikasi Expo
    participant OS as Play Integrity / App Attest
    participant API as Laravel API (Sanctum)
    participant DB as PostgreSQL
    K->>A: Check-in dengan wajah
    A->>OS: minta token integritas
    A->>A: liveness + pencocokan on-device (template terenkripsi lokal)
    A->>API: POST /api/absensi/check-in (method=face, skor, liveness, token integritas, client_id ULID, client_time)
    API->>OS: verifikasi token di server
    API->>API: CheckIn (Action sama dengan web) + flag mock_location/rooted/unofficial_app
    API->>DB: attendance_logs (flags, is_suspicious) + attendance_days
    API-->>A: status (Tepat waktu / Terlambat) atau 409 + alasan
```

## 5. Penjelasan kode

| File | Peran |
|---|---|
| `pages/mobile-app/*.tsx` | 9 halaman. Layar OS (`biometric-login`, `lock-screen`, `widget`) memakai resolver `Page.layout` milik modul (`phoneOsLayout` di `phone-stage.tsx`): AppLayout biasa di desktop/tablet, tanpa shell di ponsel. `app.tsx` dan `layouts/` tidak diubah. |
| `features/mobile-app/types.ts` | `Device` (+ `IntegrityVerdict`), `FaceConsent`, `FaceTemplate`, `BiometricPolicy`, `ShiftToday`, `SyncItem`, `LockNotification`, `WidgetTask`, `QuickCreated`, `PreviewState`. |
| `features/mobile-app/fixtures.ts` | `NOW` (Sen 5 Okt 07.52 WIB), `PERSONA`, `SHIFT_TODAY`, `BIOMETRIC_POLICY`, `FACE_CONSENT`, `FACE_TEMPLATE`, perangkat, antrean, notifikasi layar kunci, tugas widget. |
| `features/mobile-app/logic.ts` (+ `logic.test.ts`, 19 test) | `biometricReducer` (kunci setelah 3 gagal), antrean (`summarizeQueue`, `nextToSync`, `markSyncing`, `completeAttempt`, `retryFailed`, `pauseSync`, `queueBanner`), `evaluateIntegrity`/`integrityBadge`, `livenessProgress`, `faceOutcome`, `canGiveConsent`, `summarizeTasks`, `sortDevices`, `validateQuickAdd`, `leaveDays`. |
| `use-preview-state.ts` | `usePreviewState()` dan `useScenario()` membaca `?keadaan=` & `?skenario=`; perubahan memakai `history.replaceState` (tanpa kunjungan Inertia) dan me-*remount* alur lewat `key`. |
| `phone-frame.tsx`, `phone-stage.tsx`, `app-screen.tsx` | Bingkai 390×844, panggung desktop (Simulasi + Alur + Catatan Expo), `AppScreen` varian `page` (bilah aksi di atas tab bar memakai `--tab-bar-height`) atau `frame` (di dalam bingkai). `MobileSimBar` = kontrol simulasi sebagai BottomSheet di ponsel. |
| `biometric-login-screen.tsx`, `lock-screen.tsx`, `widget-screen.tsx`, `face-viewport.tsx`, `face-check-in-flow.tsx`, `integrity-flow.tsx`, `offline-queue.tsx` (+ `use-sync-queue.ts`), `quick-add-panel.tsx`, `devices-view.tsx` (+ `use-devices.ts`), `confirm-action.tsx` | Layar & alur. Kamera memakai `useCamera` yang sudah ada dan hanya menyala selama pemindaian. |

Wallpaper OS tetap gelap di kedua tema, disusun dari token tetap (`preview-dark`, `fill-teal`, `accent-blue`, `fill-violet`, `brand-*`) lewat `color-mix` di style inline; tidak ada hex di `.tsx`.

## 6. Bentuk data → tabel DATABASE.md

| Tipe frontend | Tabel (`docs/DATABASE.md` §8) | Catatan |
|---|---|---|
| `Device` | `devices` (`user_id`, `platform`, `device_id_hash`, `push_token`, `integrity_verdict` jsonb, `last_seen_at`, `is_trusted`) | **Belum ada**: `name`, `os_version`, `app_version`, `biometric_login`; `is_current` diturunkan |
| `IntegrityVerdict` | `devices.integrity_verdict` `{checked_at, failed[], mock_app}` | |
| `FaceTemplate` | `face_templates` (`template` bytea terenkripsi, `model_version`, `consent_id`) | Template **tidak pernah** dikirim ke klien |
| `FaceConsent` | `attendance_consents` (`type = face`, `version`) | Versi kebijakan biometrik v1.0 |
| check-in wajah | `attendance_logs` (`method = face`, `flags` skor/liveness) | Flag baru: `mock_location`, `rooted`, `unofficial_app`, `integrity_unavailable` |
| `SyncItem` | tidak disimpan di server; tiap aksi membawa `client_id` ULID + `client_time` | Idempoten |
| koreksi dari integritas | `requests` jenis `KOR` | Sudah ada |

## 7. Pekerjaan backend tersisa

- [ ] Migrasi `devices` (+ kolom tambahan, perbarui DATABASE.md), `face_templates`; `attendance_consents.type = face` berversi.
- [ ] `DevicePolicy` & `FaceTemplatePolicy` (hanya pemilik; HR/Super Admin tidak bisa membaca template).
- [ ] Actions: `RegisterDevice`, `RevokeDevice` (cabut token Sanctum + push token), `ToggleBiometricLogin`, `GiveBiometricConsent`, `EnrollFaceTemplate`, `DeleteFaceTemplate` (hapus template + `revoked_at` persetujuan dalam transaksi + `audit_logs face_template.deleted`), `VerifyDeviceIntegrity` (Play Integrity / App Attest di server).
- [ ] `CheckIn` method `face`: skor & liveness di `attendance_logs.flags`, ambang 85%, maks 3 percobaan per hari; flag integritas **menandai**, tidak memblokir otomatis.
- [ ] `routes/api.php` (Sanctum) untuk Expo: absensi, Inbox, tugas; antrean offline idempoten (`client_id`), konflik status tugas = 409 dengan alasan.
- [ ] Aksi notifikasi layar kunci (approve/snooze dengan token perangkat), kategori aksi `expo-notifications`.
- [ ] Endpoint snapshot widget (absensi + tugas hari ini) + pembaruan.
- [ ] Test Pest: Policy, `DeleteFaceTemplate`, idempotensi antrean, flag integritas.

## 8. Keadaan kosong/galat & aksesibilitas

- Keadaan dipilih di panel Simulasi atau `?keadaan=kosong|galat`; skenario lewat `?skenario=`.
- Penolakan integritas memakai nada **warning** (bukan danger), bahasa sehari-hari, dan catatan bahwa kejadian hanya ditinjau HR.
- Kamera hanya aktif selama pemindaian; bila tidak tersedia (izin ditolak, headless) tampil ilustrasi + catatan.
- Semua target ≥ 44 px, langkah liveness diumumkan sebagai teks, bukan hanya animasi oval.

## 9. Batasan prototipe

- Kamera nyata hanya di HTTPS dengan izin kamera; liveness & skor kemiripan disimulasikan.
- `NotificationListener` tidak terpasang di layar OS saat lebar < 768.
- Toast sonner di ponsel bisa tertumpuk bilah aksi bawah (Toaster global).
- Tabel perangkat di tablet 834 bergulir horizontal di dalam kartunya (bug terbuka #5).
- "Daftarkan ulang" dan "Jadwalkan rapat" menautkan ke rute lain tanpa membawa konteks. `/pratinjau/ponsel` tidak punya keadaan kosong/galat (hanya navigasi).
