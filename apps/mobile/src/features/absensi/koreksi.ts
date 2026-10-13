/** Pintu masuk koreksi absensi — form lengkap ada di modul Pengajuan (Bagian 4); sementara layar "Segera hadir". */
import type { KoreksiHari } from '@/api/absensi';
import { bukaSegera } from '@/features/settings/ComingSoon';

import { hariTanggalPendek } from './tanggal';

export function bukaKoreksiHari(tanggal: string, koreksi: KoreksiHari | null): void {
  const batas = koreksi?.deadline ? ` Batas pengajuan untuk ${hariTanggalPendek(tanggal)}: ${hariTanggalPendek(koreksi.deadline)}.` : '';
  bukaSegera({
    judul: 'Koreksi absensi',
    ikon: 'clipboard-pen-line',
    catatan: `Pengajuan koreksi absensi akan hadir di aplikasi.${batas} Untuk sementara ajukan lewat RuangKerja versi desktop.`,
    tautan: '/pengajuan/baru?kategori=koreksi',
  });
}

export function bukaPengajuanTerkait(judul = 'Pengajuan saya'): void {
  bukaSegera({ judul, ikon: 'file-text', tautan: '/pengajuan' });
}
