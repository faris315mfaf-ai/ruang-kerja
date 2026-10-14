/**
 * Pendaftaran widget layar utama — diimpor dari `index.ts` (titik masuk) SESUDAH
 * `./src/offline/latar`, pada SETIAP start JS (termasuk start headless oleh WorkManager
 * untuk pembaruan widget), karena task handler dan layar setelan harus terdaftar sebelum
 * pustaka widget memanggilnya.
 *
 * Ringan saat buka dingin: hanya pustaka widget yang dimuat di sini; penangan (data, tampilan)
 * dan layar setelan (UI aplikasi) dimuat malas saat benar-benar dipanggil.
 *
 * Terbaik-usaha: build yang belum memuat modul native `react-native-android-widget`
 * (dev client lama, Expo Go) melempar saat modul dimuat — itu tidak boleh membuat aplikasi
 * gagal mulai, jadi dimuat dengan `require` di dalam try/catch (impor statis tidak bisa).
 */
import { createElement } from 'react';
import type { WidgetConfigurationScreenProps, WidgetTaskHandlerProps } from 'react-native-android-widget';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerWidgetConfigurationScreen, registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget');

  registerWidgetTaskHandler(async (props: WidgetTaskHandlerProps) => {
    const { penanganWidget } = await import('./penangan');
    await penanganWidget(props);
  });

  registerWidgetConfigurationScreen((props: WidgetConfigurationScreenProps) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LayarSetelanWidget } = require('./LayarSetelan') as typeof import('./LayarSetelan');
    return createElement(LayarSetelanWidget, props);
  });
} catch {
  // Modul native widget tidak tersedia pada build ini.
}

export {};
