/** Format kecil khusus Beranda & dashboard (id-ID, zona Asia/Jakarta). */
import { tanggalDariYMD } from '@/lib/format';

const JAKARTA = 'Asia/Jakarta';

/** "SELASA, 13 OKTOBER" — overline app bar Beranda. */
export function overlineTanggal(now = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: JAKARTA }).format(now).toUpperCase();
}

/** Nama depan: "Sari Wulandari" → "Sari". */
export function namaDepan(nama: string | null | undefined): string {
  return (nama ?? '').trim().split(/\s+/)[0] ?? '';
}

/** Angka id-ID: 2,5 · 1.250. */
export function angka(nilai: number | null | undefined, desimal = 0): string {
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) {
    return '—';
  }
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: desimal, minimumFractionDigits: 0 }).format(nilai);
}

/** "82%" atau "—". */
export function persen(nilai: number | null | undefined): string {
  return nilai === null || nilai === undefined ? '—' : `${angka(nilai)}%`;
}

/** "+6 poin vs bulan lalu" / "−3 poin …"; null bila tak ada pembanding. */
export function teksDelta(delta: number | null | undefined, pembanding: string, satuan = 'poin'): string | undefined {
  if (delta === null || delta === undefined || Number.isNaN(delta)) {
    return undefined;
  }
  const bulat = Math.round(delta * 10) / 10;
  const tanda = bulat > 0 ? '+' : bulat < 0 ? '−' : '±';
  return `${tanda}${angka(Math.abs(bulat), 1)} ${satuan} vs ${pembanding}`;
}

/** "12 Okt" dari YYYY-MM-DD tanpa geser zona. */
export function tglSingkat(ymd: string | null | undefined): string {
  const panjang = tanggalDariYMD(ymd);
  const bagian = panjang.split(' ');
  return bagian.length === 3 ? `${bagian[0]} ${(bagian[1] ?? '').slice(0, 3)}` : panjang;
}

/** "Sel, 13 Okt" dari ISO. */
export function hariTanggal(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: JAKARTA }).format(new Date(iso));
}

export function jamKantor(date: Date | null): string {
  if (!date) {
    return '';
  }
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: JAKARTA }).format(date);
}
