/**
 * Mematikan sorotan fokus bawaan Android (kotak abu persegi di belakang
 * tombol bundar saat navigasi keyboard/D-pad). `android:defaultFocusHighlightEnabled`
 * di tema berlaku untuk semua View karena RN membuat View tanpa atribut XML,
 * sehingga nilainya jatuh ke tema. Cincin fokus yang mengikuti bentuk tombol
 * digambar sendiri oleh `Pressable` (src/ui/Pressable.tsx).
 */
const { withAndroidStyles } = require('expo/config-plugins');

module.exports = function withNoFocusHighlight(config) {
  return withAndroidStyles(config, (cfg) => {
    const tema = cfg.modResults.resources.style?.find((s) => s.$.name === 'AppTheme');
    if (tema) {
      tema.item = (tema.item ?? []).filter((i) => i.$.name !== 'android:defaultFocusHighlightEnabled');
      tema.item.push({ $: { name: 'android:defaultFocusHighlightEnabled' }, _: 'false' });
    }
    return cfg;
  });
};
