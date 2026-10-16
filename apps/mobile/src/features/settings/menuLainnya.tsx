/**
 * Susunan menu tab Lainnya per peran (docs/mockups/android/spec/13-fondasi-desain
 * › 14-lainnya-per-peran). Baris hanya muncul bila pengguna berwenang DAN fitur
 * aktif; butir yang fiturnya belum dibangun membuka layar "Segera hadir".
 */
import { router } from 'expo-router';
import { View } from 'react-native';

import type { AksesHiring } from '@/api/hiring';
import { LencanaHiring } from '@/features/hiring/akses';
import { bolehLaporanTimProfil } from '@/features/laporan/akses';
import { LencanaPersetujuan } from '@/features/persetujuan/LencanaPersetujuan';
import { LencanaAntrean } from '@/offline/LencanaAntrean';
import { CountBadge, Icon, type AnyIconName } from '@/ui';

import { bukaSegera, type ParamSegera } from './ComingSoon';
import { fiturAktif, type Peran, type ProfilLengkap } from './profile';
import type { ItemMenu } from './parts';

interface Konteks {
  profil: ProfilLengkap;
  peran: Peran;
  belumBaca: number;
  warnaChevron: string;
  /** `GET /hiring/akses` (useAksesHiring): pewawancara/penyetuju non-HR juga melihat baris Hiring. */
  hiring?: AksesHiring | null;
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

/** Baris Hiring (rekrutmen): HR/SA, atau pewawancara/penyetuju yang ditugaskan. */
function barisHiring(warnaChevron: string): ItemMenu {
  return rute('hiring', 'Hiring', 'user-round-search', '/hiring', { subjudul: 'Lowongan · kandidat · keputusan', kanan: <LencanaHiring warnaChevron={warnaChevron} /> });
}

/** Kelompok "Pekerjaan". */
export function menuPekerjaan({ profil, peran, belumBaca, warnaChevron, hiring }: Konteks): ItemMenu[] {
  const pimpinan = peran.hr || peran.direksi || peran.admin;
  const inbox = rute('inbox', 'Inbox', 'inbox', '/inbox', {
    subjudul: 'Notifikasi & perlu tindakan',
    nada: 'teal',
    kanan: lencanaAngka(belumBaca, warnaChevron),
    aksesibilitas: `Buka inbox${belumBaca > 0 ? `, ${belumBaca} belum dibaca` : ''}`,
  });
  const persetujuan = rute('persetujuan', 'Persetujuan', 'circle-check', '/persetujuan', {
    subjudul: pimpinan ? 'Antrean penyetuju · HR/Direksi' : 'Antrean penyetuju',
    nada: 'warn',
    kanan: <LencanaPersetujuan warnaChevron={warnaChevron} />,
  });

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

  daftar.push(
    rute('sinkron', 'Antrean sinkron', 'refresh-cw', '/sinkron', {
      subjudul: 'Perubahan yang dibuat saat offline',
      kanan: <LencanaAntrean warnaChevron={warnaChevron} />,
    }),
  );

  daftar.push(rute('buat-cepat', 'Buat cepat', 'plus', '/buat-cepat', { subjudul: 'Tugas, check-in, pengajuan, catatan' }));

  if (peran.hr || peran.admin) {
    daftar.push(
      rute('reset-sandi', 'Permintaan reset sandi', 'key-round', '/karyawan/permintaan-sandi', { subjudul: 'Menunggu keputusan HR', nada: 'warn' }),
      rute('saldo-cuti', 'Saldo cuti', 'wallet-cards', '/saldo-cuti', { subjudul: 'Semua karyawan · baca saja' }),
      barisHiring(warnaChevron),
    );
  } else if (hiring?.has_access) {
    daftar.push(barisHiring(warnaChevron));
  }
  if (peran.direksi || peran.admin) {
    daftar.push(rute('portofolio', 'Portofolio proyek', 'briefcase-business', '/portofolio', { subjudul: 'Kesehatan & progres proyek' }));
  } else if (peran.kadiv) {
    daftar.push(rute('portofolio', 'Proyek divisi', 'briefcase-business', '/portofolio', { subjudul: 'Proyek yang melibatkan divisi Anda' }));
  }

  if (pimpinan) {
    daftar.push(
      rute('absensi-tim', 'Absensi tim', 'clipboard-check', '/absensi-tim', { subjudul: 'Hari ini · Rekap · Kedisiplinan' }),
      rute('ringkasan', 'Dashboard Manajemen', 'chart-no-axes-column', '/manajemen', { subjudul: 'Kehadiran, tugas, proyek, beban kerja' }),
    );
    if (fiturAktif(profil, 'role_dashboards', false)) {
      daftar.push(segera('dashboard-jabatan', 'Dashboard jabatan', 'briefcase'));
    }
  } else if (peran.kadiv) {
    daftar.push(
      rute('absensi-tim', 'Absensi divisi', 'clipboard-check', '/absensi-tim', { subjudul: 'Hari ini · Rekap · Kedisiplinan' }),
    );
  }

  const bacaTim = bolehLaporanTimProfil(profil);
  daftar.push(rute('laporan', 'Laporan harian', 'clipboard-pen', '/laporan', { subjudul: bacaTim ? 'Milik saya & laporan tim' : 'Tulis laporan & riwayat' }));
  if (bacaTim) {
    daftar.push(rute('laporan-tim', 'Laporan tim', 'users', '/laporan/tim', { subjudul: 'Siapa yang sudah dan belum lapor' }));
  }
  daftar.push(
    rute('pengajuan', 'Pengajuan saya', 'calendar-days', '/pengajuan', { subjudul: 'Cuti, izin, sakit, koreksi, barang' }),
    rute('kalender', 'Kalender & rapat', 'calendar-clock', '/kalender', {
      subjudul: pimpinan ? 'Termasuk jadwal pimpinan (baca)' : undefined,
    }),
  );
  if (fiturAktif(profil, 'meetings', true)) {
    daftar.push(rute('rapat', 'Rapat', 'calendar-check', '/rapat', { subjudul: 'Agenda, RSVP, dan notulen' }));
    if (pimpinan) {
      daftar.push(rute('jadwal-manajemen', 'Jadwal manajemen', 'calendar-days', '/manajemen/jadwal', { subjudul: 'Rapat pimpinan, notulen, tindak lanjut' }));
    }
  }
  if (fiturAktif(profil, 'notes', true)) {
    daftar.push(rute('catatan', 'Catatan & notulensi', 'notebook-pen', '/catatan'));
  }
  if (fiturAktif(profil, 'automation', false)) {
    daftar.push(rute('otomasi', 'Otomasi & berulang', 'workflow', '/otomasi', { subjudul: 'Aturan, tugas berulang, template' }));
  }
  if (fiturAktif(profil, 'okr', false)) {
    daftar.push(rute('okr', 'OKR divisi', 'target', '/okr', { subjudul: 'Objective & key result per kuartal' }));
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
    daftar.push(rute('karyawan', 'Karyawan', 'users', '/karyawan', { subjudul: peran.hr || peran.admin ? 'Cari & profil (ubah di desktop)' : 'Lihat saja' }));
  }
  daftar.push(rute('struktur', 'Struktur organisasi', 'network', '/organisasi/struktur', { subjudul: 'Divisi, tim, dan orang' }));
  if (peran.hr || peran.admin) {
    // Admin · tersedia di desktop (mockup 11 › 01, 26).
    const desktop = (kunci: string, judul: string, subjudul: string, tautan: string, catatan?: string): ItemMenu =>
      segera(kunci, judul, 'monitor', subjudul, { desktop: true, tautan, catatan }, { nada: 'warn' });
    if (peran.admin) {
      daftar.push(desktop('audit', 'Audit log', 'Catatan aksi sensitif · desktop', '/admin/audit', 'Hanya Super Admin.'));
    }
    daftar.push(
      desktop('alur-jenis', 'Alur & jenis pengajuan', 'Kunci jenis, alur persetujuan · desktop', '/admin/pengajuan'),
      desktop('lokasi-shift', 'Lokasi, shift & hari libur', 'Geofence, jadwal, kiosk QR · desktop', '/admin/absensi'),
      desktop('kelola', 'Organisasi', 'Divisi, tim, jabatan · desktop', '/admin/organisasi'),
    );
  }
  return daftar;
}
