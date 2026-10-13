/** Tujuan navigasi Beranda yang dimiliki modul/agen lain (dipusatkan agar mudah diganti). */
import { router } from 'expo-router';

import { bukaSegera } from '@/features/settings/ComingSoon';

/** Daftar pengumuman (modul 10 — A2-Inbox: `app/pengumuman`). */
export function bukaDaftarPengumuman(): void {
  router.push('/pengumuman' as never);
}

/** Persetujuan = Bagian 4: sementara layar "Segera hadir". */
export function bukaPersetujuan(): void {
  bukaSegera({ judul: 'Persetujuan', ikon: 'circle-check', catatan: 'Antrean persetujuan hadir di Bagian 4 aplikasi.' });
}

export function bukaHiring(): void {
  bukaSegera({ judul: 'Hiring', ikon: 'user-round-search', tautan: '/hiring', catatan: 'Modul rekrutmen hadir di versi berikutnya.' });
}

export function bukaAbsensiHr(): void {
  bukaSegera({ judul: 'Absensi', ikon: 'clipboard-check', tautan: '/absensi/kedisiplinan', catatan: 'Rekap dan kedisiplinan dikelola di desktop.' });
}

export function bukaLaporanTim(): void {
  bukaSegera({ judul: 'Laporan harian tim', ikon: 'clipboard-pen', catatan: 'Laporan harian hadir di Bagian 4 aplikasi.' });
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
