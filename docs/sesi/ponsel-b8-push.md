# Bagian 8 — Notifikasi push Android (FCM + expo-notifications)

Keputusan pemilik 14 Okt 2026: aplikasi Android menerima notifikasi push lengkap — tugas baru, rapat baru, chat baru, dan semua hal yang bisa dinotifikasi. Server sudah punya jalur FCM (kontrak payload: [`ponsel-b2c-inbox.md`](ponsel-b2c-inbox.md) §5); bagian ini menambah **sisi aplikasi** dan merapikan perilaku server. Langkah pemilik (proyek Firebase): [`docs/deploy/ANDROID-FCM.md`](../deploy/ANDROID-FCM.md).

## 1. Hasil periksa server — apa yang memicu push

| Permintaan pemilik | Jenis (`NotificationType`) | Kapan push dikirim |
|---|---|---|
| Tugas baru | `task.assigned` | setiap penugasan ke saya; saluran `rk_tugas` (HIGH) |
| Rapat baru | `meeting.invited` (+ `meeting.starting`, `minutes.finalized`) | undangan/jadwal berubah/dibatalkan; "mulai 15 menit lagi"; notulen final; saluran `rk_rapat` (HIGH) |
| Chat baru | `chat.message` | **hanya DM dan grup kecil** (bukan kanal workspace/publik/privat). Kanal biasa hanya memicu push lewat **@sebutan** (`mention`, saluran Tugas & sebutan). DM/grup yang dibisukan hanya memicu push untuk @sebutan. Keputusan pemilik 6 Okt 2026 (`PostMessage`), **tidak diubah** |
| Semua yang lain | 36 jenis `NotificationType` | lihat tabel saluran di `ponsel-b2c-inbox.md` §1 |

Catatan: `NotificationType` berisi **36** jenis (bukan 37); semuanya terpetakan ke tepat satu saluran Android (`AndroidChannel::forType`, dikunci tes).

Aturan umum (`BaseNotification::via`): push mengikuti kolom **In-app** baris preferensi (keputusan spec 10 §10 butir 6 — tidak ada kolom "Push" terpisah; di aplikasi kolomnya berlabel **"In-app & push"**); ditahan saat cuti (`pause_while_on_leave`); jam tenang menunda seperti email; hanya untuk pengguna yang punya ≥ 1 `devices.push_token`. Tes: `FcmPushTest › puts every notification type on the FCM channel…` melintasi seluruh `NotificationType`.

### Perubahan server (B8)
1. **Chat tanpa spam, tetap segar.** Inbox tetap satu baris "Pesan baru" per percakapan dan orang (keputusan lama). Sebelumnya pesan berikutnya selama baris itu belum dibaca **tidak mengirim apa pun** (push terbaca basi). Sekarang pesan berikutnya mengirim **push-only** (tanpa baris Inbox/toast/email) — `DirectMessageNotification` dengan `pendingInboxId` — paling sering **sekali per 10 detik per percakapan dan penerima**, dan menggantikan push sebelumnya di bilah notifikasi lewat `android.notification.tag = chat:{channel_id}`. Ketukan menandai baris Inbox yang sudah ada sebagai dibaca (`data.notification_id` = id baris itu).
2. **`data.group_key`** ditambahkan ke setiap push: id saluran, atau `chat:{channel_id}` untuk chat. Petunjuk pengelompokan untuk aplikasi; FCM v1 sendiri tidak punya kunci grup.
3. `BaseNotification` mendapat hook `pushOnly()`, `pushTag()`, `pushGroupKey()`, `pushInboxId()` (default netral; hanya chat yang menimpanya). `FcmChannel::message` memakainya.

Tes: `tests/Feature/Notifications/FcmPushTest.php` (+3), `tests/Feature/Chat/ChatActionsTest.php` (+1), `tests/Unit/Notifications/MobilePushParityTest.php` (3, baru).

## 2. Sisi aplikasi (`apps/mobile`)

| Berkas | Isi |
|---|---|
| `app.config.js` | membungkus `app.json`; `android.googleServicesFile` hanya bila `secrets/android/google-services.json` (atau env `GOOGLE_SERVICES_JSON`) ada; tanpa berkas build tetap sukses, push nonaktif |
| `app.json` | plugin `expo-notifications` (`icon` siluet putih, `color #0B7F86`, `defaultChannel rk_info`) **menggantikan** `plugins/withNotificationIcon.js` (dihapus; ikon per-densitas `assets/notification-icon-*dpi.png` tak dipakai lagi, plugin mengecilkan dari `notification-icon.png` 96 px) |
| `src/features/notifikasi/push/kanal.ts` | 10 saluran bawaan (salinan enum server; dikunci `MobilePushParityTest`), `gabungKanal`, `kanalDariServer` |
| `…/saluranAndroid.ts` | membuat grup "RuangKerja" + saluran (`setNotificationChannelAsync`: importance, visibilitas layar kunci PRIVATE/PUBLIC, getar, lencana); `bacaStatusSaluran`; `bukaSetelanSaluran` (intent `CHANNEL_NOTIFICATION_SETTINGS`) |
| `…/token.ts` | `getDevicePushTokenAsync` → `PUT /perangkat/{device}/push-token` (id perangkat = `is_current` di `GET /perangkat`); tangkap semua galat → status `firebase`/`izin`/`offline`/`server`; tanpa log token |
| `…/status.ts` | status push + `usePushStatus()` + permintaan daftar ulang |
| `…/data.ts` | murni: `bacaDataPush`, `targetDariPush`, `idInboxDariPush` (diuji `scripts/cek-push.mjs`) |
| `…/buka.ts` | ketuk → tandai dibaca (`POST /inbox/{id}/baca`) → `resolveTarget` (satu-satunya pemeta tujuan, juga dipakai Inbox & Cari) → `bukaTujuan`; kembali ke tab induk dulu (`router.dismissAll`) |
| `…/PushController.tsx` | dipasang sekali di `app/_layout.tsx`: saluran + token (saat masuk, aplikasi aktif, token berganti, izin diberikan), handler latar depan (tanpa banner sistem ganda → snackbar "Buka" + segarkan lencana; lokal tetap tampil), ketukan (cold start/latar/terbuka) ditahan sampai sesi + kunci biometrik + navigator siap (maks. 15 menit), lencana ikon = Inbox belum dibaca, bersih-bersih saat keluar, tawaran izin sekali setelah masuk |
| `…/lokal.ts`, `…/uji.ts` | notifikasi uji LOKAL + hook `useUjiNotifikasi` (server bila push aktif, selain itu lokal, jelas ditandai) |
| `app/pengaturan/notifikasi-ponsel.tsx` | kartu status push, status tiap saluran dari sistem, ketuk saluran → setelan sistem, tombol uji server + uji lokal |
| `app/pengaturan/notifikasi.tsx`, `MatriksNotifikasi.tsx` | kolom In-app berlabel "In-app & push"; teks jam tenang menyebut push; tombol uji memakai hook |
| `src/features/settings/izin.ts` | membuat saluran sebelum dialog izin (syarat Android 13+) dan mendaftarkan token setelah izin diberikan |

Dihapus: stub `src/features/inbox/push.ts` (`registerPush` yang tak dipakai).

### Alur
1. Masuk → `PushController` membuat saluran → bila izin diberikan: ambil token FCM → daftar ke server. Bila izin belum pernah ditanya: 2,5 dtk setelah siap, sekali per pemasangan, buka layar penjelasan `/pengaturan/notifikasi-izin` (bukan dialog sistem mentah); "Nanti saja" tidak diulang otomatis.
2. Push tiba, aplikasi **terbuka**: handler sistem diam; snackbar `judul — isi` + "Buka" (tidak tampil bila sudah di layar tujuannya); hitungan Inbox/obrolan disegarkan.
3. Push tiba, aplikasi **di latar/mati**: Android menampilkan notifikasi FCM langsung dengan saluran `data.android_channel` (ikon & warna dari manifest).
4. Ketuk: `data.target/id/anchor/params` → rute yang sama dengan ketukan baris Inbox; `target = inbox` (jenis tanpa layar) → lembar detail Inbox; modul yang belum ada → layar "Segera hadir/Tersedia di desktop". Belum masuk / terkunci: ditahan, dijalankan setelah masuk dan buka kunci.
5. Keluar akun: bilah notifikasi dibersihkan, lencana 0; token dihapus server (`AuthController::destroy`).

## 3. Yang sengaja tidak dikerjakan (tindak lanjut)
- **Aksi cepat bertombol** (spec `04-notifikasi-aksi-cepat`): notifikasi FCM bertipe `notification` ditampilkan sistem saat aplikasi di latar sehingga tidak bisa membawa tombol buatan aplikasi. Tombol "Buka" = ketukan biasa; "Check-in" = ketuk pengingat absensi membuka layar Absen (target `absensi`). Setujui/Tolak/Balas langsung dari notifikasi (butuh BiometricPrompt, alasan penolakan, API putusan) **tidak** dibangun; syaratnya pesan **data-only** + `@notifee/react-native` (juga untuk ringkasan grup bertajuk jumlah, MessagingStyle, `publicVersion`, mockup `03-notifikasi-bayangan`). Tanpa itu pengelompokan = bawaan Android (otomatis per saluran mulai ≥ 4 notifikasi) + collapse per percakapan chat.
- Jam tenang 21.00–06.00 versi spec 12 §4.2 belum ada; yang berlaku jam tenang server (07.00–17.30 hari kerja) milik email.
- Notifikasi ringkasan harian sebagai kartu push, push WhatsApp: di luar lingkup.

## 4. Cara uji
Prasyarat build native (`expo prebuild` + gradle) oleh pemilik; tanpa Firebase kartu status menampilkan "Push belum tersedia".

**Tanpa Firebase (emulator):**
1. Masuk → layar penjelasan izin → Aktifkan → izinkan. `adb shell dumpsys notification --noredact | grep -E "mId=rk_"` harus menampilkan 10 saluran; `adb shell dumpsys package store.spkd.ruangkerja | grep POST_NOTIFICATIONS` → `granted=true`.
2. Pengaturan › Notifikasi › Notifikasi di ponsel ini: kartu "Push belum tersedia di aplikasi ini"; ketuk **Uji notifikasi lokal** → notifikasi "Notifikasi uji (LOKAL)" tampil (saluran Pengumuman & briefing); ketuk → kembali ke layar ini.
3. Simulasi ketukan push (cold start) tanpa FCM — meniru intent peluncur dengan ekstra `data` FCM (aplikasi ditutup dulu, `adb shell am force-stop store.spkd.ruangkerja`):

   ```bash
   adb shell am start -n store.spkd.ruangkerja/.MainActivity \
     --es google.message_id sim-1 --el google.sent_time 1760000000000 \
     --es type task.commented --es target tugas --es id <ULID_TUGAS> --es anchor "" \
     --es params "{}" --es android_channel rk_tugas --es notification_id <UUID_INBOX_ATAU_KOSONG> --es group_key rk_tugas
   ```

   Ganti `target`/`id`/`anchor`/`params` dengan baris tabel `ponsel-b2c-inbox.md` §1 (mis. `--es target rapat --es id <ULID> --es params '{"tanggal":"2026-10-14"}'`, `--es target absensi --es id ""` → layar Absen, `--es target inbox --es id <UUID>` → detail Inbox). Setelah masuk dan buka kunci biometrik, layar tujuan terbuka. Nilai `google.message_id` harus berbeda tiap uji (aplikasi tidak membuka ketukan yang sama dua kali).
4. Mode latar/terbuka: `adb shell input keyevent HOME` lalu ketuk; tes tombol uji lokal dengan aplikasi terbuka (banner sistem tampil karena lokal).
5. Izin ditolak: `adb shell pm revoke store.spkd.ruangkerja android.permission.POST_NOTIFICATIONS` → status "Menunggu izin"; `pm grant` lalu kembali ke aplikasi → "Push belum tersedia" (tanpa Firebase) atau "Push aktif".
6. Saluran dimatikan: Setelan Android › Notifikasi › RuangKerja › matikan satu saluran → layar menandai "Dimatikan di Android" setelah kembali.
7. Lencana: `adb shell dumpsys notification | grep -i badge` / lihat ikon di peluncur yang mendukung (Pixel Launcher: titik, bukan angka).

**Dengan Firebase** (setelah [`ANDROID-FCM.md`](../deploy/ANDROID-FCM.md)):
1. Kartu status "Push aktif"; `GET /perangkat` menandai `has_push_token: true`.
2. Tombol **Kirim notifikasi uji ke ponsel ini** → snackbar "…(lewat server)"; notifikasi tiba dengan aplikasi terbuka (hanya snackbar), di latar, dan setelah `force-stop` (ketuk → detail Inbox).
3. Dari ponsel lain: tugaskan tugas ke akun uji (`rk_tugas`), undang ke rapat (`rk_rapat`), kirim DM dua kali beruntun (satu notifikasi `rk_obrolan` yang diperbarui, bukan dua; ketuk → percakapan), ajukan cuti dari akun lain (penyetuju: `rk_mendesak`, isi tersembunyi di layar kunci).
4. Kontrol server: `php artisan tinker` → `->notify(new App\Domain\Notifications\Notifications\TestNotification)`; log `FCM: …` bila gagal.

## 5. Belum teruji (butuh APK native + Firebase)
- Seluruh jalur FCM sungguhan (token, penerimaan latar/mati, `tag` menggantikan, ketuk cold start dengan ekstra FCM asli) — diuji hanya lewat `Http::fake` (server), unit murni (`cek-push.mjs`) dan simulasi intent.
- Pembuatan saluran & dialog izin di Android 13/14/15 fisik; perilaku vendor (MIUI/ColorOS/OneUI) dan Doze.
- Lencana ikon angka (tergantung peluncur), visibilitas layar kunci PRIVATE ("konten disembunyikan") per vendor.
- Build tanpa `google-services.json` tidak crash saat startup (secara kode: `getDevicePushTokenAsync` menolak janji, ditangkap) — perlu dipastikan di APK.
- `expo prebuild` dengan plugin `expo-notifications` menggantikan `withNotificationIcon` (konfigurasi diperiksa dengan `expo config --type prebuild`; hasil `AndroidManifest.xml`/drawable belum diinspeksi).
