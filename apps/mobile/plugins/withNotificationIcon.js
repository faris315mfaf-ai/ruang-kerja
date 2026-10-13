/**
 * Ikon notifikasi kecil (status bar) + warna aksen, tanpa memasang
 * `expo-notifications` dulu. Menyalin `assets/notification-icon.png`
 * (siluet putih + alfa, 96×96) ke `res/drawable-*dpi/notification_icon.png`,
 * menulis warna `notification_icon_color`, dan meta-data bawaan FCM
 * (`default_notification_icon` / `default_notification_color`).
 *
 * Nama sumber daya dan meta-data sama dengan yang ditulis plugin
 * `expo-notifications`. Saat paket itu dipasang: hapus plugin ini dari
 * app.json dan isi `["expo-notifications", { "icon": "./assets/notification-icon.png",
 * "color": "#0B7F86" }]` — hasil prebuild tetap sama.
 * Spesifikasi: docs/mockups/android/spec/12-android-native.md §7.1 (berkas 26).
 */
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidColors, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const NAMA = 'notification_icon';
const WARNA = 'notification_icon_color';
const UKURAN = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 };

module.exports = function withNotificationIcon(config, { icon, color }) {
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const sumber = path.resolve(cfg.modRequest.projectRoot, icon);
      const res = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res');
      const dasar = path.basename(sumber, '.png');
      for (const [dpi] of Object.entries(UKURAN)) {
        // Berkas per densitas `notification-icon-<dpi>.png` bila ada; selain itu PNG 96 px dipakai (Android menskalakan).
        const khusus = path.join(path.dirname(sumber), `${dasar}-${dpi}.png`);
        const dir = path.join(res, `drawable-${dpi}`);
        fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(fs.existsSync(khusus) ? khusus : sumber, path.join(dir, `${NAMA}.png`));
      }
      return cfg;
    },
  ]);

  config = withAndroidColors(config, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, { name: WARNA, value: color });
    return cfg;
  });

  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, 'com.google.firebase.messaging.default_notification_icon', `@drawable/${NAMA}`, 'resource');
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, 'com.google.firebase.messaging.default_notification_color', `@color/${WARNA}`, 'resource');
    return cfg;
  });
};
