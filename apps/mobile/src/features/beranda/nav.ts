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
