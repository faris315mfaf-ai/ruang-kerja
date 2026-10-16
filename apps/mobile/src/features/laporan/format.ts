/** Format tampilan laporan harian (tanggal kantor `YYYY-MM-DD`, angka id-ID). */
import type { KategoriStatus } from '@/api/laporan';
import { jam } from '@/lib/format';

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;
const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;

function pecah(ymd: string): { y: number; m: number; d: number; hari: number } | null {
  const c = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!c) {
    return null;
  }
  const y = Number(c[1]);
  const m = Number(c[2]);
  const d = Number(c[3]);
  return { y, m, d, hari: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/** "Selasa, 13 Okt 2026" */
export function tanggalLaporan(ymd: string): string {
  const p = pecah(ymd);
  return p ? `${HARI[p.hari]}, ${p.d} ${BULAN_SINGKAT[p.m - 1]} ${p.y}` : ymd;
}

/** "Sel 13 Okt" */
export function tanggalSingkat(ymd: string): string {
  const p = pecah(ymd);
  return p ? `${HARI_SINGKAT[p.hari]} ${p.d} ${BULAN_SINGKAT[p.m - 1]}` : ymd;
}

/** "13 Okt" */
export function tanggalTanpaHari(ymd: string): string {
  const p = pecah(ymd);
  return p ? `${p.d} ${BULAN_SINGKAT[p.m - 1]}` : ymd;
}

/** { angka: "13", hari: "Sel" } untuk kolom tanggal riwayat. */
export function kotakTanggal(ymd: string): { angka: string; hari: string } {
  const p = pecah(ymd);
  return p ? { angka: String(p.d), hari: HARI_SINGKAT[p.hari] ?? '' } : { angka: ymd, hari: '' };
}

/** "Okt 2026" dari "2026-10". */
export function labelBulan(bulan: string): string {
  const c = /^(\d{4})-(\d{2})$/.exec(bulan);
  return c ? `${BULAN_SINGKAT[Number(c[2]) - 1]} ${c[1]}` : bulan;
}

/** Geser `YYYY-MM-DD` sejumlah hari. */
export function geserHari(ymd: string, delta: number): string {
  const p = pecah(ymd);
  if (!p) {
    return ymd;
  }
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + delta));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** "3,5" — jam dengan koma desimal. */
export function angkaJam(nilai: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(nilai);
}

/** "3 pekerjaan · 7 jam" */
export function ringkasPekerjaan(jumlah: number, jamTotal: number | null | undefined): string {
  const bagian = [`${jumlah} pekerjaan`];
  if (jamTotal !== null && jamTotal !== undefined && jamTotal > 0) {
    bagian.push(`${angkaJam(jamTotal)} jam`);
  }
  return bagian.join(' · ');
}

/** "16.52" atau "—". */
export function jamKirim(iso: string | null | undefined): string {
  return iso ? jam(iso) : '—';
}

const LABEL_KATEGORI: Record<KategoriStatus, string> = {
  backlog: 'backlog',
  todo: 'akan dikerjakan',
  in_progress: 'saat ini',
  review: 'review',
  done: 'selesai',
  canceled: 'dibatalkan',
};

/** Keterangan kecil kategori kolom di sheet "Pindahkan ke". */
export function labelKategori(k: KategoriStatus): string {
  return LABEL_KATEGORI[k];
}

const NAMA_KATEGORI: Record<KategoriStatus, string> = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'Sedang dikerjakan',
  review: 'Review',
  done: 'Selesai',
  canceled: 'Dibatalkan',
};

/** Nama kategori untuk "dipindah ke …" bila nama kolom tidak diketahui. */
export function namaKategori(k: KategoriStatus): string {
  return NAMA_KATEGORI[k];
}

/** Bilangan dari teks ber-koma ("3,5") → 3.5; kosong/tidak valid → null. */
export function parseAngka(teks: string): number | null {
  const bersih = teks.trim().replace(',', '.');
  if (bersih === '') {
    return null;
  }
  const n = Number(bersih);
  return Number.isFinite(n) ? n : null;
}
