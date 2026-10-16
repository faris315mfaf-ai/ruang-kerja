# Push Android (Firebase Cloud Messaging)

Panduan untuk **pemilik** menyalakan notifikasi push di aplikasi Android RuangKerja (`apps/mobile`). Kode server dan aplikasi sudah siap; yang kurang hanya **proyek Firebase** milik Anda dan dua berkas rahasia. Tanpa langkah ini aplikasi tetap berjalan normal: notifikasi masuk Inbox dan email, dan layar *Pengaturan › Notifikasi › Notifikasi di ponsel ini* menampilkan "Push belum tersedia di aplikasi ini".

Kontrak payload & perilaku server: [`docs/sesi/ponsel-b2c-inbox.md`](../sesi/ponsel-b2c-inbox.md) §5 dan [`docs/sesi/ponsel-b8-push.md`](../sesi/ponsel-b8-push.md).

## Gambaran

| Berkas | Dipakai oleh | Disimpan di | Di-commit? |
|---|---|---|---|
| `google-services.json` | build aplikasi (Gradle) — mengaktifkan Firebase di APK/AAB | `secrets/android/google-services.json` (komputer pembangun) | **Tidak** (`/secrets/` di-ignore) |
| JSON *service account* | server Laravel — mengirim pesan lewat FCM HTTP v1 | di server, di luar git | **Tidak** |
| `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_JSON` | `.env` server | `.env` server | **Tidak** |

Aplikasi dan server **tidak** saling berbagi berkas itu. Jangan pernah menempelkan isinya ke chat, issue, atau commit.

## 1. Buat proyek Firebase

1. Buka <https://console.firebase.google.com> dengan akun Google perusahaan → **Tambahkan project** → nama mis. `ruangkerja` (Google Analytics boleh dimatikan).
2. Catat **Project ID** (Setelan project › Umum) — nilainya untuk `FCM_PROJECT_ID`.
3. Pastikan **Firebase Cloud Messaging API (V1)** aktif: Setelan project › **Cloud Messaging** › tab *Cloud Messaging API (V1)* harus berstatus *Diaktifkan*. API lama (Legacy/server key) **tidak dipakai** dan boleh dibiarkan mati.

## 2. Daftarkan aplikasi Android

Setelan project › Umum › **Tambahkan aplikasi** › ikon Android:

| Isian | Nilai |
|---|---|
| Nama paket Android | `store.spkd.ruangkerja` (harus persis sama dengan `android.package` di `apps/mobile/app.json`) |
| Nama panggilan | `RuangKerja` |
| Sertifikat penandatanganan SHA-1 / SHA-256 | lihat di bawah |

Sidik jari sertifikat (opsional untuk FCM, wajib bila kelak memakai fitur Firebase lain seperti Login Google atau App Check):

- **SHA-256 sertifikat upload** — sudah tercatat di tabel §1 [`ANDROID-RILIS.md`](ANDROID-RILIS.md); salin dari sana. SHA-1 diambil dengan `keytool -list -v -keystore secrets/android/ruangkerja-upload.jks -alias ruangkerja-upload` (baris `SHA1:`).
- **Sertifikat Play App Signing**: setelah aplikasi diunggah ke Play Console, salin SHA-1/SHA-256 dari Play Console › Penyiapan › Integritas aplikasi › *Penandatanganan aplikasi* dan tambahkan di Firebase (Setelan project › aplikasi Android › *Tambahkan sidik jari*).
- **Sertifikat debug** (hanya bila menjalankan *dev-client* di ponsel/emulator sendiri): `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`.

> Push FCM sendiri **tidak** memeriksa sidik jari sertifikat; token tetap diterbitkan tanpa sidik jari. Mengisinya sekarang menghindari pekerjaan ulang nanti.

## 3. Unduh `google-services.json` → simpan di `secrets/`

1. Langkah terakhir wizard (atau Setelan project › aplikasi › *google-services.json*) → **Unduh google-services.json**.
2. Simpan **tanpa mengubah isinya** di:

   ```
   <repo>/secrets/android/google-services.json
   ```

   (folder yang sama dengan `ruangkerja-upload.jks`; sudah di-ignore git). Alternatif: simpan di tempat lain dan set env `GOOGLE_SERVICES_JSON=/path/mutlak/google-services.json` saat membangun.
3. Konfigurasi Expo (`apps/mobile/app.config.js`) otomatis membaca berkas itu saat `expo prebuild`: bila ada, `android.googleServicesFile` diisi dan Gradle memasang plugin Google Services; bila tidak ada, build tetap sukses dengan push nonaktif (pesan `[RuangKerja] google-services.json tidak ditemukan` di log prebuild).
4. **Bangun ulang** aplikasi dengan prebuild bersih (`npx expo prebuild --platform android --clean`, lalu langkah build di [`ANDROID-RILIS.md`](ANDROID-RILIS.md)). Berkas Firebase hanya terbaca saat prebuild/gradle — memasangnya tidak mengubah APK yang sudah ada.

## 4. Buat *service account* untuk server

1. Firebase Console › Setelan project › tab **Akun layanan** (Service accounts) › **Buat kunci pribadi baru** → unduh JSON. (Atau di Google Cloud Console › IAM › Akun layanan › *firebase-adminsdk-…* › Kunci › Tambah kunci › JSON.)
2. Pastikan akun layanan itu punya peran **Firebase Cloud Messaging API Admin** (`roles/firebasecloudmessaging.admin`): Cloud Console › IAM › cari email akun layanan › Edit › tambahkan peran. Akun `firebase-adminsdk-…` bawaan biasanya sudah memiliki peran *Firebase Admin SDK Administrator Service Agent* yang cukup, tetapi bila FCM menjawab 403 tambahkan peran di atas.
3. Salin berkas JSON itu ke server **tanpa melewati git**, ke volume `storage` (sama seperti kunci Google Workspace, README › Google Cloud):

   ```bash
   docker compose -f compose.prod.yml cp fcm-service-account.json app:/app/storage/app/private/fcm-service-account.json
   ```

   Lalu amankan: pemiliknya user aplikasi, mode `600`. Hapus salinan di komputer Anda setelah dicadangkan di password manager.
4. Isi `.env` server (nilai sungguhan hanya di server — lihat `config/services.php` › `fcm` dan `app/Domain/Notifications/Services/FcmClient.php`):

   ```dotenv
   FCM_PROJECT_ID=<Project ID dari langkah 1>
   FCM_SERVICE_ACCOUNT_JSON=/app/storage/app/private/fcm-service-account.json
   ```

   `FCM_SERVICE_ACCOUNT_JSON` adalah **path berkas**, bukan isi JSON. Berkas wajib memuat `client_email`, `private_key`, dan (opsional) `token_uri`.
5. Berlakukan konfigurasi di **semua** kontainer PHP — pekerja antrean membawa konfigurasi lama sampai dimulai ulang:

   ```bash
   docker compose -f compose.prod.yml exec app php artisan config:cache
   docker compose -f compose.prod.yml exec queue php artisan config:cache
   docker compose -f compose.prod.yml exec app php artisan horizon:terminate
   ```

   Cek: `php artisan config:show services.fcm` menampilkan `project_id` terisi (path berkas boleh tampil; jangan buka isinya).

## 5. Menguji

1. Pasang build baru (yang dibangun **dengan** `google-services.json`) di ponsel, masuk, lalu berikan izin notifikasi (Android 13+: layar penjelasan muncul sekali setelah masuk, atau lewat Pengaturan › Notifikasi).
2. Buka **Pengaturan › Notifikasi › Notifikasi di ponsel ini**. Kartu status harus berbunyi **"Push aktif"** (token terdaftar di server). Banner "Pengiriman push … belum diaktifkan di server" tidak boleh muncul.
3. Ketuk **Kirim notifikasi uji ke ponsel ini**. Server mengirim notifikasi `system.test` lewat saluran *Pengumuman & briefing*; pesan snackbar berakhiran "(lewat server)". Untuk membuktikan jalur latar/mati: kunci layar atau tutup aplikasi (geser dari "Aplikasi terbaru"), lalu kirim uji dari web (Pengaturan › Notifikasi › Kirim notifikasi uji) — notifikasi tetap tiba, dan mengetuknya membuka lembar detail.
4. Dari server (tanpa UI), untuk satu pengguna:

   ```bash
   docker compose -f compose.prod.yml exec app php artisan tinker --execute='App\Models\User::where("email","<email>")->first()->notify(new App\Domain\Notifications\Notifications\TestNotification);'
   ```

   Kegagalan pengiriman dicatat di `storage/logs` sebagai `FCM: pengiriman push gagal.` / `FCM: gagal mengambil token akses OAuth.` (status HTTP saja, tanpa token perangkat).
5. Tanpa Firebase, **uji lokal** tetap tersedia: tombol "Uji notifikasi lokal (tanpa server)" menampilkan notifikasi dari ponsel sendiri (ditandai LOKAL) untuk memeriksa tampilan, saluran, dan ketukan.

## 6. Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| Layar ponsel: "Push belum tersedia di aplikasi ini" | Build dibuat tanpa `google-services.json`. Letakkan berkas (langkah 3), prebuild bersih, bangun ulang, pasang. |
| "Pendaftaran perangkat gagal" / token tidak masuk | Periksa koneksi; ketuk "Coba daftarkan lagi". Perangkat harus tercatat di *Pengaturan › Perangkat* (hanya perangkat hasil login lewat aplikasi). |
| Banner "push belum diaktifkan di server" | `FCM_PROJECT_ID` / `FCM_SERVICE_ACCOUNT_JSON` kosong, path salah, atau konfigurasi belum di-cache ulang/pekerja belum di-`horizon:terminate` (langkah 4). Log server: "FCM belum dikonfigurasi; push dilewati." |
| Log `FCM: pengiriman push gagal.` status 403 / `PERMISSION_DENIED` | Akun layanan belum berperan *Firebase Cloud Messaging API Admin*, atau FCM API (V1) belum diaktifkan di proyek. |
| Status 404 / `UNREGISTERED`, lalu push berhenti untuk satu ponsel | Token mati (aplikasi dicopot/data dihapus). Server menghapus token itu otomatis; buka aplikasi agar mendaftar ulang. |
| Status 403 `SENDER_ID_MISMATCH` | `google-services.json` dari proyek Firebase **berbeda** dengan `FCM_PROJECT_ID`. Pakai proyek yang sama di keduanya. |
| Notifikasi tiba tetapi tanpa bunyi / tidak muncul | Saluran dimatikan di Android: *Notifikasi di ponsel ini* menandainya "Dimatikan di Android"; ketuk saluran untuk membuka setelannya. Jam tenang (07.00–17.30 hari kerja) menunda push seperti email; Pengaturan › Notifikasi › Jam tenang. |
| Notifikasi telat/tidak datang di Xiaomi, Oppo, Vivo, Samsung, Huawei | Penghemat baterai vendor membunuh aplikasi di latar. Izinkan aplikasi "Tanpa batasan"/"Autostart", kunci di Aplikasi terbaru. FCM prioritas tinggi (saluran Perlu tindakan, Tugas, Obrolan, Rapat) lebih tahan; rujukan: dontkillmyapp.com. |
| Izin notifikasi tidak pernah ditanyakan (Android 13+) | Izin diminta setelah aplikasi membuat saluran; bila sudah ditolak dua kali, aktifkan manual di Setelan Android › Aplikasi › RuangKerja › Notifikasi. |
| Notifikasi dobel di bilah | Tidak seharusnya: saat aplikasi terbuka hanya snackbar yang tampil. Lapor dengan versi aplikasi dan jenis notifikasinya. |

## 7. Keamanan

- `google-services.json` bukan rahasia tingkat tinggi (kunci API Firebase dibatasi paket), tetapi tetap di luar git agar konfigurasi pemilik tidak bocor ke forks. Kunci *service account* **sangat sensitif**: siapa pun yang memilikinya dapat mengirim push atas nama aplikasi. Mode `600`, jangan di backup publik, putar (buat kunci baru, hapus yang lama) bila curiga bocor.
- Isi push memakai versi netral untuk pengajuan sakit dan pelamar hiring; saluran *Perlu tindakan*, *Obrolan*, *Pengajuan*, *Proyek*, dan *Keamanan* memakai visibilitas layar kunci "privat" (isi disembunyikan sampai ponsel dibuka).
- Token push dihapus server saat keluar dari aplikasi atau perangkat dicabut.
