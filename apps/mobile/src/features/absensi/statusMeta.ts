/**
 * Kategori tampilan sel kalender & status hari (status tidak pernah warna saja:
 * tiap kategori punya ikon + label). Kategori mengikuti legenda mockup 13.
 */
import type { SelHari } from '@/api/absensi';
import type { AnyIconName, Tone } from '@/ui';

export type KategoriHari = 'hadir' | 'terlambat' | 'wfh' | 'izin' | 'koreksi' | 'alpha' | 'menunggu' | 'libur';

export interface MetaKategori {
  label: string;
  tone: Tone;
  /** Ikon kecil di pojok sel; null = tanpa. */
  ikon: AnyIconName | null;
}

export const META: Record<KategoriHari, MetaKategori> = {
  hadir: { label: 'Hadir', tone: 'success', ikon: null },
  terlambat: { label: 'Terlambat', tone: 'warning', ikon: 'clock' },
  wfh: { label: 'WFH', tone: 'primary', ikon: 'house' },
  izin: { label: 'Izin/cuti', tone: 'info', ikon: 'file-text' },
  koreksi: { label: 'Koreksi', tone: 'neutral', ikon: 'pencil' },
  alpha: { label: 'Alpha', tone: 'danger', ikon: 'x' },
  menunggu: { label: 'Belum check-in', tone: 'neutral', ikon: null },
  libur: { label: 'Libur', tone: 'neutral', ikon: null },
};

export function kategoriHari(h: SelHari): KategoriHari {
  if (h.isCorrected || h.kind === 'needs_correction') {
    return 'koreksi';
  }
  switch (h.kind) {
    case 'present':
    case 'early_leave':
      return 'hadir';
    case 'late':
      return 'terlambat';
    case 'wfh':
      return 'wfh';
    case 'leave':
    case 'permit':
    case 'sick':
    case 'business_trip':
      return 'izin';
    case 'absent':
      return 'alpha';
    case 'none':
      return 'menunggu';
    default:
      return 'libur';
  }
}

/** Hari yang punya catatan (muncul di "Catatan bulan ini"). */
export function perluCatatan(h: SelHari): boolean {
  const k = kategoriHari(h);
  return k === 'terlambat' || k === 'koreksi' || k === 'izin' || k === 'wfh' || k === 'alpha' || h.kind === 'early_leave' || h.isSuspicious;
}
