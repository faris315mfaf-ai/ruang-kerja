/** Pengelompokan hari & jam untuk Inbox (zona kantor). */
import { zonaKantor } from '@/lib/zonaKantor';

function kunciHari(tanggal: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zonaKantor(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(tanggal);
}

/** "09.02" */
export function jamKantor(iso: string): string {
  const tanggal = new Date(iso);
  if (Number.isNaN(tanggal.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('id-ID', { timeZone: zonaKantor(), hour: '2-digit', minute: '2-digit', hour12: false }).format(tanggal).replace(':', '.');
}

/** "Hari ini" · "Kemarin" · "Sab, 3 Okt 2026". */
export function labelHari(iso: string, sekarang: Date = new Date()): { kunci: string; label: string } {
  const tanggal = new Date(iso);
  const kunci = kunciHari(tanggal);
  if (kunci === kunciHari(sekarang)) {
    return { kunci, label: 'Hari ini' };
  }
  if (kunci === kunciHari(new Date(sekarang.getTime() - 86_400_000))) {
    return { kunci, label: 'Kemarin' };
  }
  const label = new Intl.DateTimeFormat('id-ID', { timeZone: zonaKantor(), weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(tanggal);
  return { kunci, label };
}

export interface KelompokHari<T> {
  kunci: string;
  label: string;
  items: T[];
}

export function kelompokkanPerHari<T extends { created_at: string }>(items: T[], sekarang: Date = new Date()): KelompokHari<T>[] {
  const hasil: KelompokHari<T>[] = [];
  for (const item of items) {
    const { kunci, label } = labelHari(item.created_at, sekarang);
    const terakhir = hasil[hasil.length - 1];
    if (terakhir && terakhir.kunci === kunci) {
      terakhir.items.push(item);
    } else {
      hasil.push({ kunci, label, items: [item] });
    }
  }
  return hasil;
}
