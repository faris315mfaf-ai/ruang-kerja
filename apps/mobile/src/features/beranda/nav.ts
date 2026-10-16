/** Tujuan navigasi Beranda yang dimiliki modul/agen lain (dipusatkan agar mudah diganti). */
import { router } from 'expo-router';

import { bukaSegera } from '@/features/settings/ComingSoon';

/** Daftar pengumuman (modul 10 — A2-Inbox: `app/pengumuman`). */
export function bukaDaftarPengumuman(): void {
  router.push('/pengumuman' as never);
}

/** Antrean persetujuan (Bagian 4 — A4-Persetujuan: `app/persetujuan`). */
export function bukaPersetujuan(): void {
  router.push('/persetujuan' as never);
}

/** Hiring (Bagian 5 — S5-H: `app/hiring`). */
export function bukaHiring(): void {
  router.push('/hiring' as never);
}

/** Absensi tim HR/Kadiv (Bagian 5 — S5-B: `app/absensi-tim`). Tanpa argumen agar aman dipakai sebagai `onPress`. */
export function bukaAbsensiHr(): void {
  router.push('/absensi-tim' as never);
}

/** Laporan tim (Bagian 4 — `app/laporan/tim`). */
export function bukaLaporanTim(): void {
  router.push('/laporan/tim' as never);
}

/** Formulir laporan hari ini (Bagian 4 — `app/laporan/hari-ini`). */
export function bukaLaporanHariIni(): void {
  router.push('/laporan/hari-ini' as never);
}

export function bukaDashboardDireksi(): void {
  bukaSegera({
    judul: 'Dashboard Direksi',
    ikon: 'chart-no-axes-column',
    tautan: '/manajemen',
    catatan: 'Monitoring kerja Direksi hadir di Bagian 5 aplikasi.',
  });
}

/** Pencarian global (modul 10 — A2-Inbox: `app/cari`). */
export function bukaCari(): void {
  router.push('/cari' as never);
}
