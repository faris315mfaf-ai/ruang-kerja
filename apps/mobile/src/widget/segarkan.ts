/**
 * Memperbarui widget dari DALAM aplikasi (`requestWidgetUpdate`): dipanggil lewat
 * `penyegar.ts` setelah data berubah, saat aplikasi ke latar, serta saat sesi mulai/berakhir.
 * Modul ini dimuat malas (`import()`), dan semuanya terbaik-usaha: build tanpa modul native
 * widget (dev client lama, Expo Go) tidak boleh mengganggu aplikasi.
 */
import { SEMUA_WIDGET, type NamaWidget } from './keadaan';

export interface OpsiSegarkan {
  /** Paksa keadaan "Masuk dulu" (keluar akun / sesi berakhir), tanpa memuat data. */
  keluar?: boolean;
}

/** Muat ulang widget `nama` (bawaan: ketiganya) yang terpasang di layar utama. */
export async function segarkanWidget(nama: readonly NamaWidget[] = SEMUA_WIDGET, opsi: OpsiSegarkan = {}): Promise<void> {
  try {
    const [{ requestWidgetUpdate }, { susunWidget }, { lupakanMemo }] = await Promise.all([import('react-native-android-widget'), import('./susun'), import('./data')]);
    lupakanMemo();
    await Promise.all(
      nama.map((widgetName) =>
        requestWidgetUpdate({
          widgetName,
          renderWidget: (info) => susunWidget(widgetName, info, opsi.keluar === true),
        }).catch(() => undefined),
      ),
    );
  } catch {
    // Modul native tidak ada / tidak ada widget: tidak ada yang perlu dilakukan.
  }
}
