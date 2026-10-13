/**
 * Susunan menu tab Lainnya per peran (docs/mockups/android/spec/13-fondasi-desain
 * › 14-lainnya-per-peran). Baris hanya muncul bila pengguna berwenang DAN fitur
 * aktif; butir yang fiturnya belum dibangun membuka layar "Segera hadir".
 */
import { router } from 'expo-router';
import { View } from 'react-native';

import { bolehLaporanTimProfil } from '@/features/laporan/akses';
import { CountBadge, Icon, type AnyIconName } from '@/ui';

import { bukaSegera, type ParamSegera } from './ComingSoon';
import { fiturAktif, type Peran, type ProfilLengkap } from './profile';
import type { ItemMenu } from './parts';

interface Konteks {
  profil: ProfilLengkap;
  peran: Peran;
  belumBaca: number;
  warnaChevron: string;
}

function lencanaAngka(jumlah: number, warnaChevron: string): React.ReactNode {
  if (jumlah <= 0) {
    return undefined;
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <CountBadge count={jumlah} />
      <Icon name="chevron-right" size={20} color={warnaChevron} />
    </View>
  );
}

function rute(kunci: string, judul: string, ikon: AnyIconName, path: string, extra: Partial<ItemMenu> = {}): ItemMenu {
  return { kunci, judul, ikon, onPress: () => router.push(path as never), ...extra };
}

function segera(kunci: string, judul: string, ikon: AnyIconName, subjudul?: string, param: Partial<ParamSegera> = {}, extra: Partial<ItemMenu> = {}): ItemMenu {
  return {
    kunci,
    judul,
    subjudul,
    ikon,
    onPress: () => bukaSegera({ judul, ikon, ...param }),
    ...extra,
  };
}

/** Kelompok "Pekerjaan". */
export function menuPekerjaan({ profil, peran, belumBaca, warnaChevron }: Konteks): ItemMenu[] {
  const pimpinan = peran.hr || peran.direksi || peran.admin;
  const inbox = rute('inbox', 'Inbox', 'inbox', '/inbox', {
    subjudul: 'Notifikasi & perlu tindakan',
    nada: 'teal',
    kanan: lencanaAngka(belumBaca, warnaChevron),
    aksesibilitas: `Buka inbox${belumBaca > 0 ? `, ${belumBaca} belum dibaca` : ''}`,
  });
  const persetujuan = segera('persetujuan', 'Persetujuan', 'circle-check', pimpinan ? 'Antrean penyetuju · HR/Direksi' : 'Antrean penyetuju', { tautan: '/persetujuan' }, { nada: 'warn' });

  const daftar: ItemMenu[] = [];

  if (peran.manajemen) {
    if (peran.kadiv && !pimpinan) {
      daftar.push(persetujuan, inbox);
    } else {
      daftar.push(inbox, persetujuan);
    }
  } else {
    daftar.push(inbox);
  }

  daftar.push(rute('buat-cepat', 'Buat cepat', 'plus', '/buat-cepat', { subjudul: 'Tugas, check-in, pengajuan, catatan' }));

  if (peran.hr || peran.admin) {
    daftar.push(
      segera('reset-sandi', 'Permintaan reset sandi', 'key-round', 'Menunggu keputusan HR', {}, { nada: 'warn' }),
      segera('hiring', 'Hiring', 'user-round-search', 'Lowongan · kandidat · keputusan'),
    );
  }
  if (peran.direksi || peran.admin) {
    daftar.push(segera('portofolio', 'Portofolio proyek', 'briefcase-business', 'Kesehatan & progres proyek', { tautan: '/portofolio' }));
  }

  if (pimpinan) {
    daftar.push(
      segera('absensi-hari-ini', 'Absensi hari ini', 'clipboard-check', 'Hadir · terlambat · cuti'),
      segera('kedisiplinan', 'Kedisiplinan', 'gauge', undefined, { tautan: '/absensi/kedisiplinan' }),
      segera('ringkasan', 'Ringkasan manajemen', 'chart-no-axes-column', 'Direksi/HR/SA', { tautan: '/manajemen' }),
    );
    if (fiturAktif(profil, 'role_dashboards', false)) {
      daftar.push(segera('dashboard-jabatan', 'Dashboard jabatan', 'briefcase'));
    }
  } else if (peran.kadiv) {
    daftar.push(
      segera('absensi-tim', 'Absensi tim hari ini', 'clipboard-check', 'Hadir · terlambat · cuti'),
      segera('kedisiplinan', 'Kedisiplinan', 'gauge', undefined, { tautan: '/absensi/kedisiplinan' }),
    );
  }

  const bacaTim = bolehLaporanTimProfil(profil);
  daftar.push(rute('laporan', 'Laporan harian', 'clipboard-pen', '/laporan', { subjudul: bacaTim ? 'Milik saya & laporan tim' : 'Tulis laporan & riwayat' }));
  if (bacaTim) {
    daftar.push(rute('laporan-tim', 'Laporan tim', 'users', '/laporan/tim', { subjudul: 'Siapa yang sudah dan belum lapor' }));
  }
  daftar.push(
    segera('pengajuan', 'Pengajuan saya', 'calendar-days', 'Cuti, izin, sakit, koreksi, barang', {
      aksiJudul: 'Buat pengajuan baru',
      aksiRute: '/pengajuan/baru',
    }),
    rute('kalender', 'Kalender & rapat', 'calendar-clock', '/kalender', {
      subjudul: pimpinan ? 'Termasuk jadwal pimpinan (baca)' : undefined,
    }),
  );
  if (fiturAktif(profil, 'meetings', true)) {
    daftar.push(rute('rapat', 'Rapat', 'calendar-check', '/rapat', { subjudul: 'Agenda, RSVP, dan notulen' }));
  }
  if (fiturAktif(profil, 'notes', true)) {
    daftar.push(rute('catatan', 'Catatan & notulensi', 'notebook-pen', '/catatan'));
  }
  if (fiturAktif(profil, 'automation', false)) {
    daftar.push(rute('otomasi', 'Otomasi & berulang', 'workflow', '/otomasi', { subjudul: 'Aturan, tugas berulang, template' }));
  }
  if (fiturAktif(profil, 'okr', false)) {
    daftar.push(segera('okr', 'OKR divisi', 'target'));
  }
  daftar.push(
    rute('pengumuman', 'Pengumuman', 'megaphone', '/pengumuman', { subjudul: pimpinan ? 'Tulis ke semua' : peran.kadiv ? 'Tulis ke divisi' : undefined }),
  );
  if (fiturAktif(profil, 'automation', false)) {
    daftar.push(rute('kinerja', 'Kinerja saya', 'gauge', '/kinerja', { subjudul: 'Metrik output, tanpa skor gabungan' }));
  }

  return daftar;
}

/** Kelompok "Organisasi" — hanya bukan staf; kosong untuk staf. */
export function menuOrganisasi({ peran }: Konteks): ItemMenu[] {
  if (peran.staf) {
    return [];
  }
  const pimpinan = peran.hr || peran.direksi || peran.admin;
  const daftar: ItemMenu[] = [];
  if (pimpinan) {
    daftar.push(segera('karyawan', 'Karyawan', 'users', 'Cari & profil (ubah di desktop)', { tautan: '/admin/karyawan' }));
  }
  daftar.push(segera('struktur', 'Struktur organisasi', 'network', undefined, { tautan: '/organisasi/struktur' }));
  if (!pimpinan && peran.kadiv) {
    daftar.push(segera('anggota-divisi', 'Anggota divisi', 'users'));
  }
  if (peran.hr || peran.admin) {
    daftar.push({
      kunci: 'kelola',
      judul: 'Kelola organisasi, alur, jenis, lokasi…',
      subjudul: 'Tersedia di desktop',
      ikon: 'monitor',
      nada: 'warn',
      onPress: () =>
        bukaSegera({
          judul: 'Kelola organisasi, alur, jenis, lokasi…',
          ikon: 'monitor',
          desktop: true,
          tautan: '/admin/organisasi',
        }),
    });
  }
  return daftar;
}
