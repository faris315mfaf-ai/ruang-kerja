/** Tujuan navigasi Persetujuan yang dimiliki modul lain (A4-Pengajuan: `app/pengajuan/**`). */
import { router } from 'expo-router';

/** Detail pengajuan sisi pemohon/HR (pembatalan HR ada di sana). */
export function bukaDetailPengajuan(id: string): void {
  router.push(`/pengajuan/${id}` as never);
}

/** Pengajuan saya. */
export function bukaPengajuanSaya(): void {
  router.push('/pengajuan' as never);
}
