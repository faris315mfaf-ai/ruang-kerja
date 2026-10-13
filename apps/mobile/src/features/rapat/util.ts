/**
 * Utilitas modul Rapat (mockup 08): label platform, tanggal kantor (WIB),
 * kemunculan seri, hitung mundur, cache data terakhir untuk mode offline.
 */
import type { Colors } from '@/theme';
import type { AnyIconName, Tone } from '@/ui';
import { tanggal } from '@/ui';
import { jam } from '@/lib/format';

export const PLATFORM: Record<string, { label: string; ikon: AnyIconName; tone: Tone; hint: string }> = {
  video: { label: 'Video RuangKerja', ikon: 'video', tone: 'primary', hint: 'Ruang video bawaan · tanpa tautan' },
  meet: { label: 'Google Meet', ikon: 'video', tone: 'success', hint: 'Tempel tautan (opsional) · tautan otomatis ditahan' },
  zoom: { label: 'Zoom', ikon: 'video', tone: 'info', hint: 'Tempel tautan rapat' },
  room: { label: 'Tatap muka', ikon: 'building-2', tone: 'neutral', hint: 'Ruangan, mis. Ruang Rapat Lt. 3' },
  client: { label: 'Di klien', ikon: 'handshake', tone: 'warning', hint: 'Nama klien dan alamatnya' },
};

export function infoPlatform(kode: string): { label: string; ikon: AnyIconName; tone: Tone; hint: string } {
  return PLATFORM[kode] ?? { label: kode, ikon: 'video', tone: 'neutral', hint: '' };
}

/** Warna garis kiri baris agenda per platform. */
export function warnaPlatform(colors: Colors, kode: string): string {
  switch (kode) {
    case 'video':
      return colors.fill.teal;
    case 'meet':
      return colors.success;
    case 'zoom':
      return colors.accentBlue;
    case 'client':
      return colors.fill.warning;
    default:
      return colors.subtle;
  }
}

// ── Tanggal kantor (YYYY-MM-DD) ─────────────────────────────────────────────

const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function urai(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y: y || 1970, m: m || 1, d: d || 1 };
}

export function keYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function tambahHari(ymd: string, n: number): string {
  const { y, m, d } = urai(ymd);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return keYmd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 1 = Senin … 7 = Minggu. */
export function hariIso(ymd: string): number {
  const { y, m, d } = urai(ymd);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

export function seninDari(ymd: string): string {
  return tambahHari(ymd, 1 - hariIso(ymd));
}

/** "Sel" */
export function namaHariSingkat(ymd: string): string {
  return tanggal.NAMA_HARI_SINGKAT[hariIso(ymd) - 1] ?? '';
}

/** "Selasa" */
export function namaHari(ymd: string): string {
  const w = hariIso(ymd);
  return tanggal.NAMA_HARI[w === 7 ? 0 : w] ?? '';
}

/** "Sel, 13 Okt" */
export function hariSingkat(ymd: string): string {
  const { m, d } = urai(ymd);
  return `${namaHariSingkat(ymd)}, ${d} ${BULAN_SINGKAT[m - 1] ?? ''}`;
}

/** "Selasa, 13 Okt" */
export function judulHari(ymd: string): string {
  const { m, d } = urai(ymd);
  return `${namaHari(ymd)}, ${d} ${BULAN_SINGKAT[m - 1] ?? ''}`;
}

/** "Selasa, 13 Okt 2026" */
export function hariPanjang(ymd: string): string {
  return `${judulHari(ymd)} ${urai(ymd).y}`;
}

/** "Sel, 13 Okt 2026" */
export function hariSingkatTahun(ymd: string): string {
  return `${hariSingkat(ymd)} ${urai(ymd).y}`;
}

export function namaBulan(y: number, m: number): string {
  return `${tanggal.NAMA_BULAN[m - 1] ?? ''} ${y}`;
}

/** "12–18 Oktober 2026" (atau lintas bulan "28 Sep – 4 Okt 2026"). */
export function rentangMinggu(senin: string): string {
  const akhir = tambahHari(senin, 6);
  const a = urai(senin);
  const b = urai(akhir);
  if (a.m === b.m) {
    return `${a.d}–${b.d} ${tanggal.NAMA_BULAN[a.m - 1] ?? ''} ${a.y}`;
  }
  return `${a.d} ${BULAN_SINGKAT[a.m - 1] ?? ''} – ${b.d} ${BULAN_SINGKAT[b.m - 1] ?? ''} ${b.y}`;
}

/** "09.00–10.00" */
export function rentangJam(mulai: string, selesai: string): string {
  return `${jam(mulai)}–${jam(selesai)}`;
}

/** "1 jam", "30 menit", "1 jam 30 menit". */
export function labelDurasi(menit: number): string {
  if (menit < 60) {
    return `${menit} menit`;
  }
  const j = Math.floor(menit / 60);
  const s = menit % 60;
  return s === 0 ? `${j} jam` : `${j} jam ${s} menit`;
}

/** "30 dan 15 menit sebelumnya". */
export function labelPengingat(daftar: unknown[]): string {
  const angka = daftar.filter((x): x is number => typeof x === 'number').sort((a, b) => b - a);
  if (angka.length === 0) {
    return 'Tanpa pengingat';
  }
  const teks = angka.map((n) => (n === 0 ? 'saat mulai' : String(n)));
  if (teks.length === 1) {
    return angka[0] === 0 ? 'Saat rapat mulai' : `${teks[0]} menit sebelumnya`;
  }
  return `${teks.slice(0, -1).join(', ')} dan ${teks[teks.length - 1]} menit sebelumnya`;
}

export const LABEL_ULANGI: Record<string, string> = {
  none: 'Tidak berulang',
  weekdays: 'Setiap hari kerja (Sen–Jum)',
  weekly: 'Setiap minggu',
  mon_wed_fri: 'Senin, Rabu, Jumat',
};

/** Lencana pendek di agenda: "Mingguan", "Sen/Rab/Jum", "Hari kerja". */
export function lencanaSeri(recurrence: string): string | null {
  switch (recurrence) {
    case 'weekly':
      return 'Mingguan';
    case 'mon_wed_fri':
      return 'Sen/Rab/Jum';
    case 'weekdays':
      return 'Hari kerja';
    default:
      return null;
  }
}

/** "Setiap Selasa, tanpa akhir" / "Setiap hari kerja s.d. 30 Okt 2026". */
export function labelBerulang(recurrence: string, occurrence: string, until: string | null): string | null {
  let dasar: string;
  switch (recurrence) {
    case 'weekly':
      dasar = `Setiap ${namaHari(occurrence)}`;
      break;
    case 'weekdays':
      dasar = 'Setiap hari kerja (Sen–Jum)';
      break;
    case 'mon_wed_fri':
      dasar = 'Senin, Rabu, Jumat';
      break;
    default:
      return null;
  }
  return until ? `${dasar} s.d. ${hariSingkatTahun(until)}` : `${dasar}, tanpa akhir`;
}

function cocokSeri(recurrence: string, ymd: string): boolean {
  const w = hariIso(ymd);
  if (recurrence === 'weekdays') {
    return w <= 5;
  }
  if (recurrence === 'mon_wed_fri') {
    return w === 1 || w === 3 || w === 5;
  }
  return true;
}

/** Kemunculan seri di sekitar `pusat` (sebelum & sesudah), dibatasi `until`. */
export function kemunculanSeri(recurrence: string, pusat: string, until: string | null, sebelum = 2, sesudah = 3): string[] {
  if (recurrence === 'none') {
    return [pusat];
  }
  const langkah = recurrence === 'weekly' ? 7 : 1;
  const mundur: string[] = [];
  let t = pusat;
  for (let i = 0; i < 60 && mundur.length < sebelum; i += 1) {
    t = tambahHari(t, -langkah);
    if (cocokSeri(recurrence, t)) {
      mundur.unshift(t);
    }
  }
  const maju: string[] = [];
  t = pusat;
  for (let i = 0; i < 60 && maju.length < sesudah; i += 1) {
    t = tambahHari(t, langkah);
    if (until && t > until) {
      break;
    }
    if (cocokSeri(recurrence, t)) {
      maju.push(t);
    }
  }
  return [...mundur, pusat, ...maju];
}

// ── Waktu relatif ───────────────────────────────────────────────────────────

/** "52 menit", "1 jam 5 menit", "2 hari". */
export function teksSelang(ms: number): string {
  const menit = Math.max(0, Math.round(ms / 60_000));
  if (menit < 60) {
    return `${menit} menit`;
  }
  if (menit < 24 * 60) {
    const j = Math.floor(menit / 60);
    const s = menit % 60;
    return s === 0 ? `${j} jam` : `${j} jam ${s} menit`;
  }
  return `${Math.round(menit / (24 * 60))} hari`;
}

export type FaseRapat = 'akan' | 'berlangsung' | 'selesai';

export function faseRapat(mulai: string, selesai: string, sekarang: number): FaseRapat {
  if (sekarang < new Date(mulai).getTime()) {
    return 'akan';
  }
  if (sekarang < new Date(selesai).getTime()) {
    return 'berlangsung';
  }
  return 'selesai';
}

// ── Cache memori (data terakhir saat offline) ───────────────────────────────

const cache = new Map<string, { data: unknown; saat: number }>();

export function simpanCache(kunci: string, data: unknown): void {
  cache.set(kunci, { data, saat: Date.now() });
}

export function bacaCache<T>(kunci: string): { data: T; saat: number } | null {
  const isi = cache.get(kunci);
  return isi ? { data: isi.data as T, saat: isi.saat } : null;
}

/** Nama depan untuk teks ringkas ("Rizky"). */
export function namaDepan(nama: string | null | undefined): string {
  return (nama ?? '').trim().split(/\s+/)[0] ?? '';
}

/** Tinta di atas gradien aksi/merek/hangat — putih di kedua tema (sama dengan Chip @/ui). */
export const PUTIH = '#FFFFFF';
