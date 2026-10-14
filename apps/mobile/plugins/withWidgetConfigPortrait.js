/**
 * The widget settings activity added by react-native-android-widget has no
 * orientation set, so it can open in landscape on some launchers/emulators.
 * Lock it to portrait like MainActivity (phone UI only).
 */
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withWidgetConfigPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    for (const activity of app?.activity ?? []) {
      if (activity.$['android:name'] === '.WidgetConfigurationActivity') {
        activity.$['android:screenOrientation'] = 'portrait';
      }
    }
    return cfg;
  });
};
