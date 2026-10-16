/**
 * Pemicu pembaruan widget dari sisi aplikasi (selain pembaruan periodik ≥ 30 menit oleh OS):
 *  - antrean offline berubah (item absen/tugas diantre, tersinkron, konflik, dibuang);
 *  - mutasi API sukses (check-in/out, tugas, RSVP rapat) — termasuk yang dikirim mesin antrean;
 *  - aplikasi masuk latar (supaya layar utama sudah mutakhir saat pengguna keluar dari aplikasi);
 *  - sesi dimulai / berakhir (`src/offline/sesi.ts`): widget kembali ke "Masuk dulu" saat keluar akun.
 * Semua dirapikan (debounce) dan dimuat malas; kegagalan tidak pernah mengganggu aplikasi.
 *
 * Modul ini diimpor `src/offline/penanganFitur.ts` (sehingga juga aktif di sinkron latar) dan
 * `src/offline/sesi.ts`. Pemasangan pendengar sekali per proses JS.
 */
import { AppState } from 'react-native';

import { setPendengarMutasi } from '@/api/client';
import { onAntrean } from '@/offline/antrean';

import { SEMUA_WIDGET, widgetUntukJenisAntrean, widgetUntukMutasi, type NamaWidget } from './keadaan';

const TUNDA_MS = 3000;
/** Jeda minimal antar pembaruan karena aplikasi masuk latar (ke-latar-kan berulang cepat tidak menembak server). */
const JEDA_LATAR_MS = 60_000;

const antri = new Set<NamaWidget>();
let timer: ReturnType<typeof setTimeout> | null = null;
let terakhirLatar = 0;

/** Jadwalkan pembaruan widget (digabung dalam satu putaran). */
export function jadwalkanSegarkanWidget(nama: readonly NamaWidget[] = SEMUA_WIDGET, tundaMs: number = TUNDA_MS): void {
  if (nama.length === 0) {
    return;
  }
  nama.forEach((n) => antri.add(n));
  if (timer !== null) {
    clearTimeout(timer);
  }
  timer = setTimeout(() => {
    timer = null;
    const daftar = [...antri];
    antri.clear();
    void import('./segarkan').then((m) => m.segarkanWidget(daftar)).catch(() => undefined);
  }, tundaMs);
}

/** Keluar akun / sesi berakhir: gambar ulang SEMUA widget sebagai "Masuk dulu", tanpa memuat data. */
export function segarkanWidgetKeluar(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  antri.clear();
  void import('./segarkan').then((m) => m.segarkanWidget(SEMUA_WIDGET, { keluar: true })).catch(() => undefined);
}

let terpasang = false;

function pasang(): void {
  if (terpasang) {
    return;
  }
  terpasang = true;
  onAntrean((p) => {
    if (p.tipe === 'selesai') {
      return;
    }
    jadwalkanSegarkanWidget(widgetUntukJenisAntrean(p.item.jenis));
  });
  setPendengarMutasi((_method, path) => jadwalkanSegarkanWidget(widgetUntukMutasi(path)));
  AppState.addEventListener('change', (status) => {
    if (status !== 'background' || Date.now() - terakhirLatar < JEDA_LATAR_MS) {
      return;
    }
    terakhirLatar = Date.now();
    jadwalkanSegarkanWidget(SEMUA_WIDGET, 1500);
  });
}

pasang();
