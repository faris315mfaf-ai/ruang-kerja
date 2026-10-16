/**
 * Play Store release size: R8 minify + resource shrinking, only the ABIs real
 * phones use (arm64-v8a, armeabi-v7a) and keep rules for the native libraries
 * R8 cannot see through (WebRTC/LiveKit, Android widget, Firebase messaging).
 *
 * Off by default so dev-client / emulator builds keep every ABI and fast builds.
 * Enable with `RUANGKERJA_RELEASE_SHRINK=1` when running `expo prebuild`
 * (see docs/deploy/ANDROID-RILIS.md §AAB Play Store).
 */
const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod, withGradleProperties } = require('expo/config-plugins');

const KEEP_RULES = `
# --- RuangKerja release shrink (plugins/withReleaseShrink.js) ---
-keep class expo.modules.** { *; }
-keep class expo.** { *; }
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class org.webrtc.** { *; }
-keep class livekit.org.** { *; }
-keep class org.jni_zero.** { *; }
-keep class org.chromium.** { *; }
-keep class net.zetetic.** { *; }
-keep class io.requery.** { *; }
-keepclasseswithmembernames class * { native <methods>; }
-keep class com.oney.WebRTCModule.** { *; }
-keep class com.livekit.reactnative.** { *; }
-keep class io.livekit.** { *; }
-keep class com.reactnativeandroidwidget.** { *; }
-keep class com.google.firebase.** { *; }
-dontwarn org.webrtc.**
-dontwarn io.livekit.**
-dontwarn livekit.org.**
-dontwarn org.chromium.**
-dontwarn com.google.firebase.ktx.Firebase
`;

function setProp(items, key, value) {
  const hit = items.find((i) => i.type === 'property' && i.key === key);
  if (hit) {
    hit.value = value;
  } else {
    items.push({ type: 'property', key, value });
  }
}

module.exports = function withReleaseShrink(config) {
  if (process.env.RUANGKERJA_RELEASE_SHRINK !== '1') {
    return config;
  }
  config = withGradleProperties(config, (cfg) => {
    setProp(cfg.modResults, 'android.enableMinifyInReleaseBuilds', 'true');
    setProp(cfg.modResults, 'android.enableShrinkResourcesInReleaseBuilds', 'true');
    setProp(cfg.modResults, 'reactNativeArchitectures', 'armeabi-v7a,arm64-v8a');
    setProp(cfg.modResults, 'org.gradle.jvmargs', '-Xmx4096m -XX:MaxMetaspaceSize=1024m');
    return cfg;
  });
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!current.includes('RuangKerja release shrink')) {
        fs.writeFileSync(file, current + KEEP_RULES);
      }
      return cfg;
    },
  ]);
};
