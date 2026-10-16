/** Format tanggal murni (YYYY-MM-DD, tanpa pergeseran zona) untuk riwayat absensi. */

const ZONA = 'UTC';

function dariYmd(ymd: string): Date | null {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) {
    return null;
  }
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function fmt(ymd: string, opsi: Intl.DateTimeFormatOptions): string {
  const d = dariYmd(ymd);
  return d ? new Intl.DateTimeFormat('id-ID', { ...opsi, timeZone: ZONA }).format(d) : ymd;
}

/** "Selasa, 22 Sep 2026" */
export function hariTanggal(ymd: string): string {
  return fmt(ymd, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Sel, 22 Sep 2026" */
export function hariTanggalPendek(ymd: string): string {
  return fmt(ymd, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** "22 Sep" */
export function tanggalSingkat(ymd: string): string {
  return fmt(ymd, { day: 'numeric', month: 'short' });
}

/** "Sel" */
export function hariSingkat(ymd: string): string {
  return fmt(ymd, { weekday: 'short' });
}

/** Indeks kolom Senin=0 … Minggu=6. */
export function kolomSenin(ymd: string): number {
  const d = dariYmd(ymd);
  return d ? (d.getUTCDay() + 6) % 7 : 0;
}

/** "2026-10" ± n bulan. */
export function geserBulan(bulan: string, n: number): string {
  const [y, m] = bulan.split('-').map(Number);
  const total = (y ?? 1970) * 12 + ((m ?? 1) - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function bulanDari(ymd: string): string {
  return ymd.slice(0, 7);
}
