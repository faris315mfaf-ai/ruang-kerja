# Rilis aplikasi Android (AAB/APK bertanda tangan)

Panduan membangun rilis **RuangKerja Android** (`apps/mobile`, Expo SDK 57) secara lokal dengan **kunci upload** milik pemilik, lalu mengunggahnya ke Play Console (uji internal). Keputusan pemilik 13 Okt 2026: keystore upload dibuat lokal di `secrets/` (tidak di-commit), pemilik mencadangkan keystore + sandinya, unggah ke Play Console dilakukan pemilik. Akun & tooling: [`ANDROID-AKUN.md`](ANDROID-AKUN.md); sidik jari untuk App Links: [`ANDROID-IDENTITAS.md`](ANDROID-IDENTITAS.md); teks toko & Keamanan data: [`PLAY-LISTING.md`](PLAY-LISTING.md).

> **Aturan rahasia:** berkas ini tidak memuat sandi. Jangan menempel isi `keystore.properties` di dokumen, chat, issue, atau log CI.

## 1. Kunci upload

| Hal | Nilai |
|---|---|
| Berkas keystore | `secrets/android/ruangkerja-upload.jks` (PKCS12, RSA 4096, berlaku 10.000 hari s.d. 2054) |
| Alias | `ruangkerja-upload` |
| Pemilik sertifikat | `CN=RuangKerja, O=SPKD, C=ID` |
| SHA-256 sertifikat | `2A:FE:14:32:83:78:FA:B4:F1:35:3F:D3:82:2F:E6:17:58:36:2D:08:BF:97:2F:10:FD:32:00:2B:06:C8:2E:03` |
| Sandi | di `secrets/android/keystore.properties` (`storePassword` = `keyPassword`, 40 karakter acak) |

Folder `secrets/` di-ignore git (`.gitignore` baris `/secrets/`). Keystore dibuat sekali (13 Okt 2026) di worktree `ruang-kerja-bagian5`; salin folder `secrets/android/` apa adanya bila membangun dari checkout lain.

### Wajib: cadangkan sekarang

1. Simpan **dua berkas** `ruangkerja-upload.jks` dan `keystore.properties` di password manager organisasi (lampiran berkas) **dan** satu salinan offline (USB terenkripsi) — bukan di Google Drive bersama.
2. Kunci upload yang hilang **bisa** diganti lewat Play Console (Penandatanganan aplikasi › *Minta reset kunci upload*, butuh beberapa hari), tetapi selama itu tidak ada rilis. Jangan sampai terjadi.
3. Setelah aplikasi pertama diunggah dengan **Play App Signing** (bawaan), Google memegang kunci penandatanganan aplikasi; kunci ini hanya kunci *upload*.

### Membuat ulang (hanya bila belum pernah dipakai mengunggah)

```bash
KEYTOOL=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/keytool
export RK_KS_PASS='<sandi acak panjang>'   # jangan ketik di riwayat shell bersama
$KEYTOOL -genkeypair -keystore secrets/android/ruangkerja-upload.jks -storetype PKCS12 \
  -alias ruangkerja-upload -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=RuangKerja, O=SPKD, C=ID" -storepass:env RK_KS_PASS -keypass:env RK_KS_PASS
```

Lalu tulis `secrets/android/keystore.properties`:

```properties
storeFile=ruangkerja-upload.jks
storePassword=<sandi>
keyAlias=ruangkerja-upload
keyPassword=<sandi>
```

`storeFile` boleh relatif terhadap folder berkas properti atau absolut. Melihat sidik jari tanpa menampilkan sandi:

```bash
RK=$(grep '^storePassword=' secrets/android/keystore.properties | cut -d= -f2-) \
  $KEYTOOL -list -v -keystore secrets/android/ruangkerja-upload.jks -storepass:env RK | grep -E 'Owner|SHA256:'
```

## 2. Cara kerja tanda tangan

Plugin config `apps/mobile/plugins/withReleaseSigning.js` (terdaftar di `app.json`) menambah `signingConfigs.release` ke `android/app/build.gradle` saat `expo prebuild`. Gradle membaca berkas yang ditunjuk env **`RUANGKERJA_KEYSTORE_PROPERTIES`** (path absolut) **saat build**, jadi tidak ada sandi yang tertulis ke folder `android/` (yang memang tidak di-commit).

| Env | Hasil `assembleRelease` / `bundleRelease` |
|---|---|
| kosong | build jalan dengan **kunci debug** + peringatan `RuangKerja: … kunci DEBUG` (developer lain, CI, uji emulator). Tidak bisa diunggah ke Play |
| terisi, berkas lengkap | ditandatangani kunci upload |
| terisi, berkas/kunci hilang atau tidak lengkap | build **gagal** dengan pesan jelas (supaya tidak ada APK berkunci debug yang tak sengaja dirilis) |

## 3. Versi

`apps/mobile/app.json`: `expo.version` (nama versi, dikirim di header `X-App-Version` dan dibandingkan dengan `APP_MIN_VERSION` server → 426) dan `expo.android.versionCode` (bilangan bulat, **wajib naik** setiap unggahan ke Play). Rilis Bagian 5: **1.1.0 (versionCode 2)**. Naikkan keduanya di commit tersendiri sebelum membangun rilis berikutnya.

## 4. Membangun

Prasyarat: JDK 21 (`brew install openjdk@21`), Android SDK di `~/Library/Android/sdk`, Node dari nvm. `ANDROID_SDK_ROOT` harus **tidak** diisi (bentrok dengan `ANDROID_HOME`).

```bash
cd apps/mobile
export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | tail -1)/bin:$PATH"
unset ANDROID_SDK_ROOT
npx tsc --noEmit && npx eslint .
CI=1 npx expo prebuild --platform android --clean

cd android
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=$HOME/Library/Android/sdk \
RUANGKERJA_KEYSTORE_PROPERTIES="$(cd ../../.. && pwd)/secrets/android/keystore.properties" \
./gradlew bundleRelease assembleRelease --no-daemon
```

Hasil:

| Berkas | Untuk |
|---|---|
| `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab` | **Play Console** (Android App Bundle; Play membuat APK per perangkat) |
| `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` | pasang langsung (uji ponsel/tablet, distribusi internal di luar Play). APK universal ±180 MB karena memuat semua ABI + WebRTC |

Periksa tanda tangan sebelum dibagikan (hanya mencetak DN & sidik jari):

```bash
BT=$(ls -d ~/Library/Android/sdk/build-tools/* | tail -1)
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home PATH="$JAVA_HOME/bin:$PATH" \
  $BT/apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk | grep -E 'DN|SHA-256'
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  $JAVA_HOME/bin/jarsigner -verify android/app/build/outputs/bundle/release/app-release.aab   # "jar verified."
```

SHA-256 harus sama dengan tabel §1. Pasang APK di perangkat uji: `adb install -r app-release.apk` (APK debug/rilis lain dengan kunci berbeda harus di-uninstall dulu).

## 5. Unggah ke Play Console (uji internal)

1. Play Console › aplikasi **RuangKerja** (`store.spkd.ruangkerja`) › **Uji dan rilis › Pengujian › Pengujian internal** › *Buat rilis baru*.
2. Pada unggahan pertama Play menawarkan **Play App Signing** → terima (bawaan). Play mencatat sertifikat upload dari AAB pertama; unggahan berikutnya harus ditandatangani kunci yang sama.
3. Unggah `app-release.aab`, isi catatan rilis (Bahasa Indonesia), simpan, *Tinjau rilis* → *Mulai peluncuran ke pengujian internal*.
4. **Penguji**: tab Penguji → buat daftar email (maks. 100) → bagikan tautan *opt-in*. Penguji memasang dari Play Store dengan akun Google di daftar.
5. **App Links / assetlinks**: setelah Play App Signing aktif, salin SHA-256 **kunci penandatanganan aplikasi** (Penyiapan › Integritas aplikasi › Penandatanganan aplikasi) **dan** SHA-256 kunci upload (§1) ke `ANDROID_CERT_SHA256` server, dipisah koma ([`ANDROID-IDENTITAS.md`](ANDROID-IDENTITAS.md)). APK yang dipasang langsung memakai sertifikat upload; APK dari Play memakai sertifikat Play.
6. Sebelum jalur tertutup/produksi: lengkapi *Konten aplikasi* (kebijakan privasi, akses aplikasi — akun peninjau, iklan: tidak, Keamanan data, target audiens, deklarasi izin) memakai [`PLAY-LISTING.md`](PLAY-LISTING.md). Izin yang perlu deklarasi: **layanan latar depan `mediaProjection`** (berbagi layar di rapat video) — jelaskan "berbagi layar saat rapat video, dimulai pengguna"; lokasi hanya *saat aplikasi dipakai* (tanpa lokasi latar belakang).

## 6. Catatan

- Folder `android/` hasil prebuild tidak di-commit; jalankan `expo prebuild --clean` setiap `app.json`/plugin berubah.
- Aset ikon, splash, ikon notifikasi, dan draf gambar Play dibuat ulang dengan `cd apps/mobile && node scripts/aset.mjs` (butuh Playwright dari `npm install` di akar repo dan `sips` macOS). Draf toko ada di `apps/mobile/store/play/`.
- EAS Build tidak dipakai untuk rilis ini. Bila nanti pindah ke EAS, unggah keystore yang sama lewat `eas credentials` (*Upload keystore*) agar sertifikat upload tidak berubah.
