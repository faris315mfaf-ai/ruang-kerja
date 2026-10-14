/**
 * Palet widget terang & malam dari token tema aplikasi. Widget memilih tema sistem
 * lewat pasangan `{ light, dark }` (Android memakai layout `-night`), jadi keduanya
 * dibangun sekaligus. `transparan` = setelan "Latar transparan" widget Tugas.
 */
import { darkColors, darkGradients, lightColors, lightGradients } from '@/theme/tokens';

import { buatPalet, type Palet } from './palet';

export interface PasanganPalet {
  terang: Palet;
  malam: Palet;
}

/** Putih di atas gradien aksi (token `primaryFg` tema terang). */
const PUTIH = lightColors.primaryFg;

export function paletWidget(transparan = false): PasanganPalet {
  return {
    terang: buatPalet(lightColors, lightGradients.aksi, { transparan, onAksi: PUTIH }),
    malam: buatPalet(darkColors, darkGradients.aksi, { transparan, onAksi: PUTIH }),
  };
}
