/** Format OKR: nilai per satuan, status, kuartal (rumus progres dihitung server). */
import type { KeyResult, SatuanKr, StatusOkr } from '@/api/okr';
import type { Tone } from '@/ui';

import { angka } from '@/features/proyek/format';

export function nadaOkr(s: StatusOkr): Tone {
  return s === 'on_track' ? 'success' : s === 'at_risk' ? 'warning' : 'danger';
}

export const LABEL_OKR: Record<StatusOkr, string> = { on_track: 'Sesuai jalur', at_risk: 'Berisiko', behind: 'Tertinggal' };

/** "Q4 2026" dari "2026-Q4". */
export function labelKuartal(k: string): string {
  const c = /^(\d{4})-Q([1-4])$/.exec(k);
  return c ? `Q${c[2]} ${c[1]}` : k;
}

export const LABEL_SATUAN: Record<SatuanKr, string> = { number: 'Angka', percent: 'Persen', currency: 'Rupiah', days: 'Hari' };

/** Nilai KR siap tampil: "14 skenario", "47%", "Rp 1.250.000", "5 hari". */
export function nilaiKr(kr: Pick<KeyResult, 'unit' | 'unit_label'>, v: number): string {
  switch (kr.unit) {
    case 'percent':
      return `${angka(v, 2)}%`;
    case 'currency':
      return `Rp ${angka(v, 2)}`;
    case 'days':
      return `${angka(v, 2)} hari`;
    default:
      return `${angka(v, 2)}${kr.unit_label ? ` ${kr.unit_label}` : ''}`;
  }
}

/** 0–1 → "16%". */
export function pecahanPersen(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `${Math.round(n * 100)}%`;
}

/** Teks isian angka ("47,5") → number; null bila tidak valid. */
export function bacaAngka(teks: string): number | null {
  const t = teks.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '' || !/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}

/** number → teks isian ("47,5"). */
export function tulisAngka(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : String(n).replace('.', ',');
}
