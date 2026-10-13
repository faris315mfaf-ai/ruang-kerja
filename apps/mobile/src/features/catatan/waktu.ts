import { jam, tanggalTanpaTahun, ymdJakarta } from '@/lib/format';

/** "Hari ini 08.12" · "Kemarin 16.02" · "12 Okt 14.05" (zona Jakarta). */
export function labelWaktu(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const hariIni = ymdJakarta(new Date());
  const kemarin = ymdJakarta(new Date(Date.now() - 86_400_000));
  const kunci = ymdJakarta(iso);
  if (kunci === hariIni) {
    return `Hari ini ${jam(iso)}`;
  }
  if (kunci === kemarin) {
    return `Kemarin ${jam(iso)}`;
  }
  return `${tanggalTanpaTahun(iso)} ${jam(iso)}`;
}
