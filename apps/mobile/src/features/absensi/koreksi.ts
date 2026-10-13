/**
 * Pintu masuk Pengajuan dari Absensi (Bagian 4): form koreksi terisi tanggal
 * (`/pengajuan/baru?jenis=KOR&tanggal=…`), daftar Pengajuan saya, dinas luar.
 */
import { router } from 'expo-router';

import type { KoreksiHari } from '@/api/absensi';
import { ymdHariIni } from '@/lib/format';

/** Ajukan koreksi untuk `tanggal` (YYYY-MM-DD, bawaan hari ini); bila sudah ada koreksi berjalan, buka pengajuan itu. */
export function bukaKoreksiHari(tanggal: string = ymdHariIni(), koreksi: KoreksiHari | null = null): void {
  const berjalan = koreksi?.pendingRequest;
  if (berjalan) {
    router.push(`/pengajuan/${berjalan.id}`);
    return;
  }
  router.push({ pathname: '/pengajuan/baru', params: { jenis: 'KOR', tanggal } });
}

export function bukaPengajuanTerkait(_judul = 'Pengajuan saya'): void {
  router.push('/pengajuan');
}

export function bukaDinasLuar(): void {
  router.push({ pathname: '/pengajuan/baru', params: { jenis: 'dinas' } });
}
