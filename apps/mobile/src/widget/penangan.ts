/**
 * Task handler widget (`registerWidgetTaskHandler`): dipanggil pustaka di proses headless
 * pada WIDGET_ADDED / WIDGET_UPDATE (periodik ≥ 30 menit dari OS) / WIDGET_RESIZED /
 * WIDGET_CLICK (aksi "SEGARKAN") / WIDGET_DELETED. Klik OPEN_URI / OPEN_APP ditangani
 * native tanpa JS. Tidak ada aksi yang mengubah data: widget hanya menampilkan dan membuka
 * aplikasi (check-in tetap lewat layar Absen dengan selfie + GPS).
 */
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { lupakanMemo } from './data';
import { AKSI_SEGARKAN, adalahNamaWidget } from './keadaan';
import { hapusSetelan } from './setelan';
import { susunWidget } from './susun';

export async function penanganWidget(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetInfo, widgetAction, clickAction, renderWidget } = props;
  if (widgetAction === 'WIDGET_DELETED') {
    await hapusSetelan(widgetInfo.widgetId);
    return;
  }
  if (!adalahNamaWidget(widgetInfo.widgetName)) {
    return;
  }
  if (widgetAction === 'WIDGET_CLICK') {
    if (clickAction !== AKSI_SEGARKAN) {
      return;
    }
    lupakanMemo();
  }
  try {
    renderWidget(await susunWidget(widgetInfo.widgetName, widgetInfo));
  } catch {
    // Gagal menyusun (mis. basis data terkunci): biarkan gambar terakhir tetap tampil.
  }
}
