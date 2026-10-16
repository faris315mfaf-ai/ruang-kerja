# Identitas aplikasi Android (paket & assetlinks)

Aplikasi ponsel Android (Expo, keputusan pemilik 9 Okt) mengklaim domain RuangKerja lewat **Digital Asset Links**: server mempublikasikan `/.well-known/assetlinks.json`, lalu Android mencocokkannya dengan nama paket dan sidik jari sertifikat aplikasi agar tautan `https://…` terbuka di aplikasi (App Links), bukan browser. Identitas ada di `config/branding.php` (endpoint: `routes/android.php`, test: `tests/Feature/Android/AssetLinksTest.php`):

| Kunci | Env | Default | Isi |
|---|---|---|---|
| `branding.android.package` | `ANDROID_PACKAGE` | `store.spkd.ruangkerja` | Nama paket aplikasi (sementara, sampai dikonfirmasi final). Harus sama dengan `android.package` di config Expo `apps/mobile` nanti. |
| `branding.android.cert_sha256` | `ANDROID_CERT_SHA256` | kosong | Sidik jari SHA-256 sertifikat penandatanganan. Boleh lebih dari satu, pisah dengan koma (rotasi sertifikat). |

Bila `ANDROID_CERT_SHA256` kosong, endpoint membalas `[]` (HTTP 200) — bukan 404, agar lokal/dev tetap tenang.

## 1. Membuat keystore rilis

```bash
keytool -genkeypair -v \
  -keystore ruangkerja-release.keystore \
  -alias ruangkerja \
  -keyalg RSA -keysize 4096 -validity 10000
```

Simpan keystore dan sandinya di password manager — **jangan pernah di-commit**. Kehilangan keystore berarti rilis ulang dengan sertifikat baru. Bila memakai **Play App Signing** (bawaan Play Console) atau `eas credentials` (Expo), sertifikat rilis dikelola Google/EAS: lewati langkah ini dan ambil sidik jari dari Play Console › Rilis › **Penandatanganan aplikasi**, atau dari output `eas credentials`.

## 2. Mengambil SHA-256

```bash
keytool -list -v -keystore ruangkerja-release.keystore -alias ruangkerja
```

Cari baris `SHA256:` — 32 pasang heksadesimal dipisah `:` (contoh `AA:BB:…:99`). Salin apa adanya, tanpa prefix `SHA256:`.

Untuk build **debug** (uji di ponsel sendiri), pakai keystore debug bawaan Android:

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android
```

## 3. Mengisi di server

Di `.env` server (isi sungguhan tidak pernah masuk repo):

```dotenv
ANDROID_PACKAGE=store.spkd.ruangkerja
ANDROID_CERT_SHA256=AA:BB:CC:…:99
```

Lalu berlakukan cache konfigurasi (produksi memakai `config:cache`):

```bash
php artisan config:cache
```

Selesai — endpoint langsung memuat statement tanpa deploy ulang kode.

## 4. Contoh isi endpoint

`GET /.well-known/assetlinks.json` bila konfigurasi terisi:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "store.spkd.ruangkerja",
      "sha256_cert_fingerprints": ["AA:BB:CC:…:99"]
    }
  }
]
```

Verifikasi setelah terpasang: buka `https://<domain>/.well-known/assetlinks.json` dari browser, atau cek lewat Digital Asset Links tool Google (https://developers.google.com/digital-asset-tools/v1/statements:list) dengan nama paket + sidik jari di atas.
