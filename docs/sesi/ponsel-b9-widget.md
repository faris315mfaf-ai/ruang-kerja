# Ponsel B9 — Widget layar utama Android

Mockup disetujui: `docs/mockups/android/screens/12-android-native/01-widget-checkin.html` dan `02-widget-tugas-rapat.html` (render: `node docs/mockups/android/_kit/render.mjs 12-android-native/01-widget`). Spesifikasi: `docs/mockups/android/spec/12-android-native.md` §4.3.
Pustaka: `react-native-android-widget@0.22.1` (config plugin + primitif `FlexWidget/TextWidget/SvgWidget`). Kode: `apps/mobile/src/widget/*`.

## Widget

| Nama (kelas) | Label | Ukuran | Isi | Setelan |
|---|---|---|---|---|
| `CheckIn` | Check-in | 2×1 (110×40 dp min, resize bebas) | status absen, jam masuk/pulang, tombol bulat | — |
| `TugasHariIni` | Tugas hari ini | 4×2 (250×110 min) | judul, segmen, selesai/total, baris tugas, "+n lagi" | `reconfigurable`: segmen Pribadi/Tim/Semua, tampilkan selesai, latar transparan |
| `RapatBerikutnya` | Rapat berikutnya | 4×1 (250×40 min) | rapat terdekat + Gabung/Detail | — |

`updatePeriodMillis` = 1.800.000 (30 menit, minimum Android). Pratinjau galeri: `assets/widget/*-preview.png` (dipotong dari mockup, latar transparan).

## Keadaan (logika murni `keadaan.ts`, uji `npm run test:widget`)

* **Check-in**: belum masuk (Mulai 08.00) · sudah masuk (Masuk 07.52 · Tepat waktu / Terlambat n mnt) · sudah pulang (Selesai 17.04 · Kerja 8 j 12 m) · libur/tanpa shift/tidak masuk (pengajuan) · menunggu sinyal (item `absensi.*` di antrean offline) · data lama (Terakhir 07.10) · sesi berakhir (Masuk dulu). Prioritas: sesi > antrean > data lama > keadaan hari.
* **Tugas**: normal (terlambat dulu, lalu terbuka, lalu selesai bila diizinkan) · semua selesai · kosong · data lama (baris redup + catatan "Belum diperbarui · terakhir …") · tanpa data (termasuk salinan lama dari HARI SEBELUMNYA, yang tidak boleh tampil sebagai tugas hari ini) · sesi berakhir. 4×2 (196 dp) memuat 3 baris (baris 44 dp), sisanya "+n lagi".
* **Rapat**: berlangsung (chip, Gabung) · berikutnya (relatif "2 jam lagi") · tidak ada rapat hari ini (+ rapat berikut) · data lama (Segarkan) · sesi berakhir · modul rapat mati (404). Tombol **Gabung** hanya untuk platform `video` di jendela gabung (15 mnt sebelum s.d. 2 jam sesudah mulai); selain itu **Detail**.

## Data (tanpa endpoint baru)

Task headless membaca token + uid dari SecureStore (`bacaTokenTersimpan`), memasangnya sebagai token sementara klien API (pola `latarKerja.ts`), memanggil dengan `senyap: true` (401/426/503 tidak mengeluarkan pengguna) dan `cache: false`:

* `GET /absensi/hari-ini` · `GET /tugas/hari-ini` (semua segmen sekali) · `GET /tugas?scope=ditugaskan&tenggat=overdue&selesai=tidak&urut=tenggat&per_page=6` (baris terlambat; pelengkap — gagal tidak mematikan widget) · `GET /rapat?rentang=hari-ini` (+ `akan-datang` hanya bila tak ada rapat tersisa).
* Antrean absen dibaca langsung dari tabel SQLite `antrean` (mesin antrean tidak jalan di proses tanpa UI).
* "Data lama": salinan respons terakhir yang berhasil dimuat WIDGET disimpan di tabel `meta` (`widget_snap:<uid>:<nama>`); bukan cache baca aplikasi (supaya tidak mengubah keadaan cache global dari proses headless, dan selamat dari `hapusCache` 401). Setelan per widget: `meta` `widget_setelan:<widgetId>`. Token tidak ditulis ke tempat baru. Keluar akun menghapus seluruh `meta` (setelan + salinan ikut hilang).
* 401 dari server → keadaan "Masuk dulu" (widget tidak mengeluarkan sesi aplikasi). Tanda `latar_ditolak` dari sinkron latar juga dihormati.
* Memo 15 dtk per permintaan: tiga widget yang diperbarui bersamaan berbagi satu panggilan.

## Interaksi (deep link `ruangkerja://`)

* Check-in: ketuk → `ruangkerja://absen` (tab Absen). Widget TIDAK mengirim absen (selfie + GPS tetap di layar Absen, geser untuk konfirmasi).
* Tugas: ketuk baris → `ruangkerja://tugas/{id}`; judul/area lain → `ruangkerja://tugas` (tab Tugas). Data lama / tanpa data → aksi klik kustom `SEGARKAN` (muat ulang tanpa membuka aplikasi). Sesi berakhir → `OPEN_APP`.
* Rapat: Gabung → `ruangkerja://rapat/{id}/video/pra-gabung?tanggal=`; Detail/badan kartu → `ruangkerja://rapat/{id}?tanggal=`; tanpa rapat → `ruangkerja://rapat`.
* Rute yang dituju sudah ada di expo-router; tidak ada perubahan routing/`_layout.tsx`.

## Penyegaran

(a) OS tiap ≥ 30 menit (`WIDGET_UPDATE`); (b) `penyegar.ts` (didebounce 3 dtk): antrean offline berubah (`onAntrean`: diantre/sukses/konflik/dibuang), mutasi API sukses (hook baru `setPendengarMutasi` di `api/client.ts`: `absensi/check-*`, `tugas*`, `rapat*`), aplikasi masuk latar (maks 1×/menit); (c) `sesi.ts`: sesi mulai → muat ulang; sesi berakhir/keluar akun → semua widget digambar "Masuk dulu" tanpa memuat data. Pemicu juga aktif di sinkron latar (modul diimpor `penanganFitur.ts`).

## Berkas

`src/widget/`: `keadaan.ts` (murni), `palet.ts` (murni) + `tema.ts` (token → palet terang/malam), `ikon.ts` (SVG Lucide), `tampilan.tsx` (primitif widget, `"use no memo"`), `data.ts`, `setelan.ts`, `susun.tsx`, `segarkan.ts`, `penyegar.ts`, `penangan.ts` (task handler), `LayarSetelan.tsx` (activity konfigurasi), `daftar.ts` (didaftarkan dari `index.ts` setelah `./src/offline/latar`, `require` di try/catch + pemuatan malas). Layar `app/pengaturan/widget.tsx` + baris di Pengaturan › Preferensi (penjelasan + tombol "Tambahkan" via `requestPinWidget`). `app.json`: plugin `react-native-android-widget` (3 widget, font Figtree 400/500/600/700 disalin ke `assets/fonts`).

## Selisih terhadap mockup

* Tugas selesai tidak dicoret (TextWidget tidak punya garis-coret); ditandai ikon centang hijau + meta "selesai" + warna samar.
* Meta kanan baris tugas bukan jam ("17.00"): tugas hanya punya tanggal tenggat. Diisi prioritas (Urgent/Tinggi) › "dari absen" › "dari atasan" › nama status; terlambat "terlambat n hari".
* Keadaan sesi berakhir widget Tugas tidak menampilkan hitungan 3/7 (tidak diketahui tanpa sesi).
* Bayangan kartu dan bayangan tombol gradien tidak ada (primitif widget tanpa shadow).
* Check-in 2×2 "+ baris jadwal" dan 4×1 hanya berupa pengubahan ukuran biasa; overline "ABSEN" disembunyikan bila tinggi < 80 dp.
* "Latar transparan" = kartu 62% buram; kontras teks tidak otomatis menyesuaikan wallpaper.
* Gabung bukan lewat peramban (video native sudah ada): langsung ke pra-gabung.
* Tidak ada sakelar "Sembunyikan judul di widget" (tidak ada di mockup yang disetujui); lihat Risiko.

## Risiko / batas OS

* Judul tugas dan rapat tampil di layar utama (terlihat orang di sekitar; disetujui mockup). Tidak ada judul "sensitif" di API tugas/rapat (aturan `externalPayload` hanya untuk pengajuan sakit & hiring, yang tidak dipakai widget). Widget layar kunci hanya didukung tablet Android 14+.
* Interval OS minimum 30 menit; Doze/hemat daya/pembatas latar merek (Xiaomi, Oppo, Vivo, Samsung) dapat menunda. Tombol "Gabung" bisa terlambat muncul s.d. 30 menit (jendela 15 mnt sebelum mulai) — Detail tetap benar. Perbaikan lanjutan bila perlu: panggil `segarkanWidget` dari task latar 15 menit (`latar.ts`).
* Widget digambar sebagai bitmap + area klik overlay (pustaka): sejumlah peluncur memotong area klik bersarang — verifikasi di perangkat.
* Pustaka dibangun terhadap RN 0.83; diperiksa statis terhadap RN 0.86.3: semua kelas yang diimpor Java pustaka ada (`ReactModuleInfo` 7-arg deprecated masih ada, `ComputedBorderRadius()` ada, `BorderRadiusStyle` internal Kotlin tetapi publik di bytecode). Kompilasi Gradle BELUM dijalankan.
* `daftar.ts` memuat modul native lewat `require` + try/catch: dev client lama tanpa modul tidak crash.

## Uji

* `cd apps/mobile && npm run test:widget` (keadaan, waktu WIB, pemotongan baris, palet dari token, ikon, pemicu) · `npx tsc --noEmit` · `npx eslint .`.
* Pohon widget dibangun di Node (stub RN) untuk semua keadaan × terang/malam: tanpa galat, semua warna hex.
* Emulator (setelah build native — `npx expo prebuild` oleh koordinator):
  * Tambah widget: tekan lama layar utama › Widget › RuangKerja; atau `adb shell am start -a android.appwidget.action.APPWIDGET_PICK`; atau Pengaturan › Widget layar utama › Tambahkan.
  * Periksa terpasang/ukuran: `adb shell dumpsys appwidget | grep -A6 store.spkd.ruangkerja`.
  * Paksa pembaruan: `adb shell am broadcast -a android.appwidget.action.APPWIDGET_UPDATE -n store.spkd.ruangkerja/.widget.CheckIn` (juga `.widget.TugasHariIni`, `.widget.RapatBerikutnya`).
  * Offline: `adb shell cmd connectivity airplane-mode enable` lalu ketuk catatan "data lama" / absen offline di aplikasi → widget "Menunggu sinyal".
  * Tema: `adb shell cmd uimode night yes|no`. Deep link: `adb shell am start -a android.intent.action.VIEW -d "ruangkerja://tugas/ID"`.
  * Pembersihan: hapus widget (seret ke Hapus); `adb shell run-as store.spkd.ruangkerja rm -rf cache` tidak perlu — bitmap widget ada di cache aplikasi.
* Belum teruji (butuh build + perangkat): kompilasi native pustaka di RN 0.86, penggambaran sebenarnya (font Figtree, gradien, SVG), area klik bersarang, activity konfigurasi (provider tema di luar akar), `requestPinWidget`, headless task saat proses mati, Doze.
