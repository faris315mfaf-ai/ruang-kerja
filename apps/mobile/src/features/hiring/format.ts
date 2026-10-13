/** Label, nada, dan format kecil modul Hiring (label tahap/status dari server bila ada). */
import type { StatusLowongan, TahapKandidat, TujuanPindah } from '@/api/hiring';
import { ApiError } from '@/api/client';
import type { Tone } from '@/ui';

export const URUTAN_TAHAP: TahapKandidat[] = ['applied', 'screening', 'interview', 'assessment', 'final_review', 'hired', 'rejected'];

export const LABEL_TAHAP: Record<TahapKandidat, string> = {
  applied: 'Masuk',
  screening: 'Seleksi berkas',
  interview: 'Wawancara',
  assessment: 'Penilaian',
  final_review: 'Keputusan akhir',
  hired: 'Diterima',
  rejected: 'Ditolak',
};

export function nadaTahap(tahap: TahapKandidat): Tone {
  switch (tahap) {
    case 'applied':
      return 'info';
    case 'final_review':
      return 'warning';
    case 'hired':
      return 'success';
    case 'rejected':
      return 'danger';
    default:
      return 'primary';
  }
}

export function nadaStatusLowongan(status: StatusLowongan): Tone {
  return status === 'open' ? 'success' : status === 'draft' ? 'neutral' : 'danger';
}

/**
 * Pilihan "Pindahkan ke…" dari kartu daftar (respons daftar tidak membawa
 * `move_targets`): semua tahap terbuka selain tahap sekarang, tanpa Diterima,
 * "Ditolak…" butuh alasan. Server tetap memeriksa gerbang checklist (422).
 */
export function tujuanDariDaftar(tahap: TahapKandidat): TujuanPindah[] {
  const terbuka: TahapKandidat[] = ['applied', 'screening', 'interview', 'assessment', 'final_review'];
  const daftar: TujuanPindah[] = terbuka.filter((t) => t !== tahap).map((t) => ({ stage: t, label: LABEL_TAHAP[t], requires_reason: false, blocked: null }));
  if (tahap !== 'rejected') {
    daftar.push({ stage: 'rejected', label: LABEL_TAHAP.rejected, requires_reason: true, blocked: null });
  }
  return daftar;
}

const ANGKA = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

/** "4,5" */
export function angka(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : ANGKA.format(n);
}

/** "4,5" dengan satu desimal tetap: "21,0". */
export function angkaSatu(n: number): string {
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
}

/** Tautan luar yang boleh dibuka (CV, berkas formulir): hanya http/https. */
export function tautanAman(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}

/** Nama depan untuk kalimat ringkas ("Ratna langsung Diterima"). */
export function namaDepan(nama: string): string {
  return nama.trim().split(/\s+/)[0] ?? nama;
}

/** Pesan galat siap tampil (validasi pertama bila 422). */
export function pesanGalat(err: unknown, cadangan: string): string {
  if (err instanceof ApiError) {
    if (err.status === 0) {
      return 'Tidak ada koneksi. Coba lagi setelah tersambung.';
    }
    return err.firstValidationError ?? err.message;
  }
  return cadangan;
}

export function statusGalat(err: unknown): number {
  return err instanceof ApiError ? err.status : -1;
}

/** Galat per field 422 → `{field: pesan}` (kunci bertitik apa adanya, mis. `field_map.email`). */
export function galatField(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.status !== 422) {
    return {};
  }
  const hasil: Record<string, string> = {};
  for (const [k, v] of Object.entries(err.errors)) {
    if (v[0]) {
      hasil[k] = v[0];
    }
  }
  return hasil;
}

/** Ambil galat untuk kunci daftar (mis. `interviewer_ids` atau `interviewer_ids.0`). */
export function galatAwalan(galat: Record<string, string>, awalan: string): string | null {
  if (galat[awalan]) {
    return galat[awalan];
  }
  const kunci = Object.keys(galat).find((k) => k.startsWith(`${awalan}.`));
  return kunci ? (galat[kunci] ?? null) : null;
}
