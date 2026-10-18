/**
 * Format tanggal/jam/angka Indonesia (locale id-ID, zona kantor) —
 * padanan resources/js/lib/format.ts milik web.
 */
import { zonaKantor } from '@/lib/zonaKantor';

function formatWith(option: Intl.DateTimeFormatOptions, value: Date | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '—';
  }
  return new Intl.DateTimeFormat('id-ID', { ...option, timeZone: zonaKantor() }).format(date);
}

/** "Senin, 12 Oktober 2026" */
export function tanggalPanjang(value: Date | string | null | undefined): string {
  return formatWith({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, value);
}

/** "12 Okt 2026" */
export function tanggalPendek(value: Date | string | null | undefined): string {
  return formatWith({ day: 'numeric', month: 'short', year: 'numeric' }, value);
}

/** "12 Okt" */
export function tanggalTanpaTahun(value: Date | string | null | undefined): string {
  return formatWith({ day: 'numeric', month: 'short' }, value);
}

/** "07.35" */
export function jam(value: Date | string | null | undefined): string {
  return formatWith({ hour: '2-digit', minute: '2-digit' }, value);
}

/** "12 Okt, 07.35" */
export function tanggalJam(value: Date | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return `${tanggalTanpaTahun(value)}, ${jam(value)}`;
}

/** "12 Oktober 2026" dari string YYYY-MM-DD (tanpa pergeseran zona). */
export function tanggalDariYMD(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) {
    return value;
  }
  return formatWith({ day: 'numeric', month: 'long', year: 'numeric' }, new Date(Date.UTC(y, m - 1, d, 4)));
}

/** Hari ini dalam YYYY-MM-DD (zona Jakarta). */
export function ymdHariIni(): string {
  return ymdJakarta(new Date());
}

/** Kunci tanggal YYYY-MM-DD (zona Jakarta) dari suatu waktu — pengelompokan per hari. */
export function ymdJakarta(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaKantor(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof value === 'string' ? new Date(value) : value);
}

/** "3 jam 20 menit" dari menit. */
export function durasiMenit(total: number | null | undefined): string {
  if (total === null || total === undefined) {
    return '—';
  }
  if (total <= 0) {
    return '0 menit';
  }
  const jam = Math.floor(total / 60);
  const menit = Math.round(total % 60);
  if (jam === 0) {
    return `${menit} menit`;
  }
  if (menit === 0) {
    return `${jam} jam`;
  }
  return `${jam} jam ${menit} menit`;
}

/** "1.234 m" / "2,3 km". */
export function jarakMeter(meter: number | null | undefined): string {
  if (meter === null || meter === undefined) {
    return '—';
  }
  if (meter >= 1000) {
    return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(meter / 1000)} km`;
  }
  return `${new Intl.NumberFormat('id-ID').format(Math.round(meter))} m`;
}

/** Sapaan sesuai jam Jakarta. */
export function sapaan(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: zonaKantor(), hour: 'numeric', hour12: false }).format(now),
  );
  if (hour < 11) {
    return 'Selamat pagi';
  }
  if (hour < 15) {
    return 'Selamat siang';
  }
  if (hour < 19) {
    return 'Selamat sore';
  }
  return 'Selamat malam';
}

/** Awalan huruf untuk nama tampilan (avatar inisial). */
export function inisial(nama: string): string {
  return nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((kata) => kata[0]?.toUpperCase() ?? '')
    .join('');
}

/** "3 hari lalu" — waktu relatif sederhana. */
export function waktuRelatif(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const saat = new Date(value).getTime();
  if (Number.isNaN(saat)) {
    return '';
  }
  const bedaDetik = Math.round((Date.now() - saat) / 1000);
  if (bedaDetik < 60) {
    return 'baru saja';
  }
  const menit = Math.round(bedaDetik / 60);
  if (menit < 60) {
    return `${menit} menit lalu`;
  }
  const jamLalu = Math.round(menit / 60);
  if (jamLalu < 24) {
    return `${jamLalu} jam lalu`;
  }
  const hari = Math.round(jamLalu / 24);
  if (hari < 7) {
    return `${hari} hari lalu`;
  }
  return tanggalPendek(value);
}
