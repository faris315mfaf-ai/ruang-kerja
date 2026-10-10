/**
 * Palet warna bernama RuangKerja — padanan resources/css/palette.css.
 * Kolom papan & label menyimpan NAMA palet (bukan hex); tema gelap
 * memakai varian terangnya seperti web.
 */
import type { ArusColors } from '@/lib/theme';

export const NAMA_PALET = [
  'gray',
  'slate',
  'teal',
  'blue',
  'green',
  'amber',
  'orange',
  'red',
  'violet',
  'pink',
] as const;

export type NamaPalet = (typeof NAMA_PALET)[number];

const TERANG: Record<NamaPalet, string> = {
  gray: '#8495a8',
  slate: '#46576b',
  teal: '#0b7f86',
  blue: '#1e5fd6',
  green: '#0f7a55',
  amber: '#b26b00',
  orange: '#c2410c',
  red: '#c42137',
  violet: '#6d4ae0',
  pink: '#be185d',
};

const GELAP: Record<NamaPalet, string> = {
  gray: '#7d8fa5',
  slate: '#a6b4c6',
  teal: '#2dbfb1',
  blue: '#7fa8ff',
  green: '#4ade9b',
  amber: '#f6b95c',
  orange: '#fb8b5a',
  red: '#ff7a8a',
  violet: '#a48bff',
  pink: '#f47bb0',
};

/** Warna palet sesuai tema; nama tak dikenal → abu netral. */
export function warnaPalet(nama: string | null | undefined, dark: boolean): string {
  const kunci = (nama ?? '') as NamaPalet;
  return (dark ? GELAP : TERANG)[kunci] ?? (dark ? GELAP.gray : TERANG.gray);
}

/** Titik warna prioritas tugas (0 none · 1 urgent · 2 tinggi · 3 sedang · 4 rendah). */
export function warnaPrioritas(nilai: number | null | undefined, colors: ArusColors): string {
  switch (nilai) {
    case 1:
      return colors.danger;
    case 2:
      return colors.warning;
    case 3:
      return colors.info;
    case 4:
      return colors.subtle;
    default:
      return colors.borderStrong;
  }
}
