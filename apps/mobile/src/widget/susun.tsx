'use no memo';
/**
 * Menyusun satu widget siap gambar: memuat data (`data.ts`), menentukan keadaan
 * (`keadaan.ts`), lalu mengembalikan pasangan `{ light, dark }` — Android memilih
 * sendiri sesuai tema sistem. Dipakai task headless (`penangan.tsx`), pemanggil
 * `requestWidgetUpdate` dari aplikasi (`segarkan.ts`), dan layar setelan.
 */
import type { WidgetRepresentation } from 'react-native-android-widget';

import { muatCheckIn, muatRapat, muatTugas } from './data';
import {
  keadaanCheckIn,
  keadaanRapat,
  keadaanTugas,
  type KeadaanCheckIn,
  type KeadaanRapat,
  type KeadaanTugas,
  type NamaWidget,
  type SetelanTugas,
} from './keadaan';
import { bacaSetelan } from './setelan';
import { WidgetCheckIn, WidgetRapat, WidgetTugas } from './tampilan';
import { paletWidget } from './tema';

/** Ukuran bawaan (dp) bila peluncur belum melaporkan ukuran. */
const TINGGI_BAWAAN: Record<NamaWidget, number> = { CheckIn: 92, TugasHariIni: 196, RapatBerikutnya: 92 };

export interface InfoUkuran {
  widgetId: number;
  width: number;
  height: number;
}

function tinggiDari(nama: NamaWidget, info: InfoUkuran): number {
  return info.height > 0 ? info.height : TINGGI_BAWAAN[nama];
}

export function gambarCheckIn(k: KeadaanCheckIn, tinggi: number): WidgetRepresentation {
  const p = paletWidget();
  return { light: <WidgetCheckIn k={k} p={p.terang} tinggi={tinggi} />, dark: <WidgetCheckIn k={k} p={p.malam} tinggi={tinggi} /> };
}

export function gambarTugas(k: KeadaanTugas, setelan: SetelanTugas): WidgetRepresentation {
  const p = paletWidget(setelan.transparan);
  return { light: <WidgetTugas k={k} p={p.terang} />, dark: <WidgetTugas k={k} p={p.malam} /> };
}

export function gambarRapat(k: KeadaanRapat, tinggi: number): WidgetRepresentation {
  const p = paletWidget();
  return { light: <WidgetRapat k={k} p={p.terang} tinggi={tinggi} />, dark: <WidgetRapat k={k} p={p.malam} tinggi={tinggi} /> };
}

/**
 * Muat data + susun widget `nama`. `keluar` = paksa keadaan "Masuk dulu" tanpa membaca
 * sesi/jaringan (dipakai tepat saat keluar akun supaya widget tidak sempat menampilkan data).
 */
export async function susunWidget(nama: NamaWidget, info: InfoUkuran, keluar = false): Promise<WidgetRepresentation> {
  const sekarang = Date.now();
  const tinggi = tinggiDari(nama, info);
  switch (nama) {
    case 'CheckIn': {
      const m = keluar ? { sekarang, adaSesi: false, absen: null, dariCache: false, cachedAt: null, antre: [] } : await muatCheckIn(sekarang);
      return gambarCheckIn(keadaanCheckIn(m), tinggi);
    }
    case 'TugasHariIni': {
      const setelan = await bacaSetelan(info.widgetId);
      const m = keluar ? { sekarang, adaSesi: false, hari: null, terlambat: [], dariCache: false, cachedAt: null, setelan } : await muatTugas(setelan, sekarang);
      return gambarTugas(keadaanTugas(m, tinggi), setelan);
    }
    case 'RapatBerikutnya': {
      const m = keluar ? { sekarang, adaSesi: false, hariIni: null, akanDatang: null, fiturMati: false, dariCache: false, cachedAt: null } : await muatRapat(sekarang);
      return gambarRapat(keadaanRapat(m), tinggi);
    }
  }
}
