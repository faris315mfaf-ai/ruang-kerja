import type { ItemPengumuman } from '@/api/pengumuman';
import { jam, tanggalPendek } from '@/lib/format';
import type { Tone } from '@/ui';

/** "12 Okt 2026 · 13.00" */
export function waktuTerbit(iso: string): string {
  return `${tanggalPendek(iso)} · ${jam(iso)}`;
}

/** Penanda masa tampil: "Tampil s.d. 31 Okt 2026" · "Sudah berakhir" · "Tanpa batas". */
export function penandaTampil(item: ItemPengumuman): { teks: string; tone: Tone } {
  if (!item.active) {
    return { teks: 'Sudah berakhir', tone: 'neutral' };
  }
  if (item.expires_at) {
    return { teks: `Tampil s.d. ${tanggalPendek(item.expires_at)}`, tone: 'info' };
  }
  return { teks: 'Tanpa batas waktu', tone: 'info' };
}

/** "Hana Nuraini · Semua karyawan · 12 Okt 2026 · 13.00" */
export function barisMeta(item: ItemPengumuman): string {
  return [item.author?.name, item.audience_label, waktuTerbit(item.published_at)].filter((x): x is string => Boolean(x)).join(' · ');
}
