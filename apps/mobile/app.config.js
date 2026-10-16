/**
 * Konfigurasi Expo dinamis: membungkus `app.json` (sumber utama) dan hanya
 * menambah `android.googleServicesFile` bila berkas Firebase ada.
 *
 * Berkas dicari di (urutan): env `GOOGLE_SERVICES_JSON` (path absolut) →
 * `<repo>/secrets/android/google-services.json`. Berkasnya rahasia proyek
 * Firebase pemilik dan TIDAK di-commit (`/secrets/` di .gitignore). Tanpa
 * berkas, build tetap sukses: push FCM nonaktif (aplikasi menampilkan status
 * "belum tersedia"), notifikasi lokal dan Inbox tetap berfungsi.
 * Langkah pemilik: docs/deploy/ANDROID-FCM.md.
 */
/* global __dirname */
const fs = require('fs');
const path = require('path');

const KANDIDAT = [process.env.GOOGLE_SERVICES_JSON, path.resolve(__dirname, '../../secrets/android/google-services.json')];

/** Path berkas google-services.json yang ada, atau null. */
function cariGoogleServices() {
  for (const kandidat of KANDIDAT) {
    if (kandidat && fs.existsSync(kandidat)) {
      return kandidat;
    }
  }
  return null;
}

module.exports = ({ config }) => {
  const berkas = cariGoogleServices();
  if (berkas === null) {
    console.log('[RuangKerja] google-services.json tidak ditemukan: push FCM nonaktif pada build ini (docs/deploy/ANDROID-FCM.md).');
    return config;
  }
  return { ...config, android: { ...config.android, googleServicesFile: berkas } };
};

module.exports.cariGoogleServices = cariGoogleServices;
