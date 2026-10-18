import { formatKantor } from '@/lib/zonaKantor';
/**
 * Tanggal murni (tanpa zona waktu) sebagai string `YYYY-MM-DD` — sama dengan
 * isian tanggal web ("Hari, dd/mm/yyyy"). Tidak memakai `new Date(string)`
 * agar tidak bergeser zona.
 */

export const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
export const NAMA_HARI_SINGKAT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const;
export const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export interface Ymd {
  y: number;
  m: number;
  d: number;
}

const POLA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function hariDalamBulan(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** `YYYY-MM-DD` valid → komponen; selain itu null (31/02 ditolak). */
export function parseIso(iso: string | null | undefined): Ymd | null {
  const cocok = POLA_ISO.exec(iso ?? '');
  if (!cocok) {
    return null;
  }
  const y = Number(cocok[1]);
  const m = Number(cocok[2]);
  const d = Number(cocok[3]);
  if (m < 1 || m > 12 || d < 1 || d > hariDalamBulan(y, m)) {
    return null;
  }
  return { y, m, d };
}

export function toIso({ y, m, d }: Ymd): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Tanggal hari ini menurut zona kantor perusahaan (bukan jam perangkat;
 * `zonaKantor()`, dari profil `GET /auth/saya`): ponsel di zona lain tidak
 * menganggap "Hari ini" sudah besok/masih kemarin dibanding server. Tanpa
 * dukungan zona Intl → jam perangkat.
 */
export function hariIniIso(sekarang: Date = new Date()): string {
  let fmtKantor: Intl.DateTimeFormat | null;
  try {
    fmtKantor = formatKantor('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    fmtKantor = null;
  }
  if (fmtKantor) {
    const bagian = fmtKantor.formatToParts(sekarang);
    const ambil = (t: string): number => Number(bagian.find((b) => b.type === t)?.value);
    const iso = toIso({ y: ambil('year'), m: ambil('month'), d: ambil('day') });
    if (parseIso(iso)) {
      return iso;
    }
  }
  return toIso({ y: sekarang.getFullYear(), m: sekarang.getMonth() + 1, d: sekarang.getDate() });
}

/** Hari dalam pekan, 0 = Minggu. */
export function hariKe(ymd: Ymd): number {
  return new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay();
}

/** "13/10/2026". */
export function formatNumerik(iso: string): string {
  const p = parseIso(iso);
  return p ? `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}` : '';
}

/** "Selasa, 13/10/2026" — bentuk tampil baku isian tanggal. */
export function formatHariTanggal(iso: string): string {
  const p = parseIso(iso);
  return p ? `${NAMA_HARI[hariKe(p)] ?? ''}, ${formatNumerik(iso)}` : '';
}

/**
 * Terima `dd/mm/yyyy`, `d/m/yyyy`, `dd-mm-yyyy`, `ddmmyyyy` → ISO; salah → null.
 */
export function parseKetikan(teks: string): string | null {
  const bersih = teks.trim();
  let d: number;
  let m: number;
  let y: number;
  if (/^\d{8}$/.test(bersih)) {
    d = Number(bersih.slice(0, 2));
    m = Number(bersih.slice(2, 4));
    y = Number(bersih.slice(4));
  } else {
    const bagian = bersih.split(/[/.-]/);
    if (bagian.length !== 3 || bagian.some((b) => !/^\d+$/.test(b)) || (bagian[2]?.length ?? 0) !== 4) {
      return null;
    }
    d = Number(bagian[0]);
    m = Number(bagian[1]);
    y = Number(bagian[2]);
  }
  const iso = toIso({ y, m, d });
  return parseIso(iso) ? iso : null;
}

/** Sisipkan "/" otomatis saat mengetik angka: "1310" → "13/10/". */
export function maskKetikan(teks: string): string {
  const mentah = teks.replace(/[^\d/.-]/g, '');
  // Hanya menambah "/" bila pengguna sedang menambah angka (bukan menghapus).
  const bagian = mentah.split(/[/.-]/);
  if (bagian.length < 3) {
    const terakhir = bagian[bagian.length - 1] ?? '';
    if (terakhir.length === 2 && !/[/.-]$/.test(mentah)) {
      return `${mentah}/`;
    }
  }
  return mentah.slice(0, 10);
}

export function geserBulan({ y, m }: { y: number; m: number }, delta: number): { y: number; m: number } {
  const total = y * 12 + (m - 1) + delta;
  return { y: Math.floor(total / 12), m: (total % 12) + 1 };
}

/** Jumlah hari dalam bulan (m 1–12). */
export function jumlahHari(y: number, m: number): number {
  return hariDalamBulan(y, m);
}

/** Indeks kolom hari pertama bulan dengan pekan mulai Senin (0 = Senin). */
export function kolomAwalBulan(y: number, m: number): number {
  return (hariKe({ y, m, d: 1 }) + 6) % 7;
}
