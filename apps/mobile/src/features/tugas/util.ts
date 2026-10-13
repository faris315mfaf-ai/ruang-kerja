/**
 * Pembantu murni modul Tugas: tanggal (YYYY-MM-DD tanpa geser zona), label,
 * pesan galat, dan pengelompokan daftar.
 */
import { ApiError } from '@/api/client';
import type { BarisTugas, KategoriStatus, KelompokTenggat, LajurRencana, LingkupTugas } from '@/api/tugas';
import { tanggal } from '@/ui';

export const LABEL_PRIORITAS: Record<number, string> = { 0: 'Tanpa', 1: 'Urgent', 2: 'Tinggi', 3: 'Sedang', 4: 'Rendah' };

export const LABEL_KATEGORI: Record<KategoriStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'Sedang dikerjakan',
  review: 'Review',
  done: 'Selesai',
  canceled: 'Dibatalkan',
};

export const LABEL_LINGKUP: Record<LingkupTugas, string> = {
  ditugaskan: 'Ditugaskan ke saya',
  'saya-amati': 'Saya amati',
  'saya-buat': 'Saya buat',
};

export const LABEL_KELOMPOK: Record<KelompokTenggat, string> = {
  terlambat: 'Terlambat',
  'hari-ini': 'Hari ini',
  'minggu-ini': 'Minggu ini',
  nanti: 'Nanti',
  'tanpa-tenggat': 'Tanpa tenggat',
  selesai: 'Selesai minggu ini',
};

export const URUTAN_KELOMPOK: KelompokTenggat[] = ['terlambat', 'hari-ini', 'minggu-ini', 'nanti', 'tanpa-tenggat', 'selesai'];

export const LABEL_LAJUR: Record<LajurRencana, string> = { today: 'Hari ini', week: 'Minggu ini', later: 'Nanti' };

/** "Sel, 13 Okt" dari YYYY-MM-DD. */
export function hariSingkat(iso: string | null | undefined): string {
  const p = tanggal.parseIso(iso);
  if (!p) {
    return '—';
  }
  const idx = (tanggal.hariKe(p) + 6) % 7;
  return `${tanggal.NAMA_HARI_SINGKAT[idx] ?? ''}, ${p.d} ${(tanggal.NAMA_BULAN[p.m - 1] ?? '').slice(0, 3)}`;
}

/** "13 Okt 2026" dari YYYY-MM-DD. */
export function tanggalRingkas(iso: string | null | undefined): string {
  const p = tanggal.parseIso(iso);
  return p ? `${p.d} ${(tanggal.NAMA_BULAN[p.m - 1] ?? '').slice(0, 3)} ${p.y}` : '—';
}

/** Tambah hari pada YYYY-MM-DD. */
export function tambahHari(iso: string, n: number): string {
  const p = tanggal.parseIso(iso);
  if (!p) {
    return iso;
  }
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return tanggal.toIso({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() });
}

/** Minggu ISO berjalan: tanggal Minggu terakhir (YYYY-MM-DD). */
export function akhirPekan(iso: string): string {
  const p = tanggal.parseIso(iso);
  if (!p) {
    return iso;
  }
  const ke = (tanggal.hariKe(p) + 6) % 7; // 0 = Senin
  return tambahHari(iso, 6 - ke);
}

export interface TeksTenggat {
  text: string;
  tone: 'danger' | 'warning' | 'muted';
  icon: 'clock-alert' | 'calendar' | 'clock';
}

/** Teks tenggat kartu: "Lewat 1 hari" (merah) · "Hari ini" (amber) · "Rab, 14 Okt". */
export function teksTenggat(baris: Pick<BarisTugas, 'due_date' | 'days_late' | 'group' | 'status'>, hariIni: string): TeksTenggat | null {
  if (!baris.due_date) {
    return null;
  }
  if (baris.status.is_done || baris.status.category === 'canceled') {
    return { text: hariSingkat(baris.due_date), tone: 'muted', icon: 'calendar' };
  }
  if (baris.days_late > 0 || baris.due_date < hariIni) {
    const n = baris.days_late > 0 ? baris.days_late : 1;
    return { text: `Lewat ${n} hari`, tone: 'danger', icon: 'clock-alert' };
  }
  if (baris.due_date === hariIni) {
    return { text: 'Hari ini', tone: 'warning', icon: 'clock' };
  }
  return { text: hariSingkat(baris.due_date), tone: 'muted', icon: 'calendar' };
}

/** Pesan galat siap tampil (validasi pertama bila ada). */
export function pesanGalat(err: unknown, cadangan: string): string {
  if (err instanceof ApiError) {
    return err.firstValidationError ?? err.message;
  }
  return cadangan;
}

export function tanpaKoneksi(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0;
}

/** Petakan galat validasi 422 → { field: pesan } (kunci diubah lewat `peta`). */
export function galatPerField(err: unknown, peta: Record<string, string> = {}): Record<string, string> {
  const hasil: Record<string, string> = {};
  if (err instanceof ApiError) {
    for (const [kunci, daftar] of Object.entries(err.errors)) {
      const pesan = daftar[0];
      if (pesan) {
        hasil[peta[kunci] ?? kunci] = pesan;
      }
    }
  }
  return hasil;
}

export const PESAN_TITIPAN =
  'Tugas ini ditugaskan orang lain. Judul, deskripsi, tenggat, dan penanggung jawab hanya bisa diubah pembuatnya atau atasan Anda.';

/** Hari/tanggal untuk "data terakhir": "13 Okt 07.52". */
export function stempelWaktu(d: Date): string {
  const jam = String(d.getHours()).padStart(2, '0');
  const menit = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${(tanggal.NAMA_BULAN[d.getMonth()] ?? '').slice(0, 3)} ${jam}.${menit}`;
}

/** Ukuran berkas: "2,4 MB". */
export function ukuranBerkas(bytes: number | null | undefined): string {
  if (!bytes) {
    return '';
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
