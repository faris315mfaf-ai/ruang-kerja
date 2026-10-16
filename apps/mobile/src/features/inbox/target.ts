/**
 * SATU-SATUNYA pemeta tujuan ketukan (notifikasi Inbox, hasil Cari, ketuk
 * push) ke rute aplikasi. Server mengirim `target {type,id,anchor,params}`
 * (docs/sesi/ponsel-b2c-inbox.md §1); aplikasi tidak pernah mem-parsing URL web.
 *
 *  - layar yang sudah ada     → `rute`
 *  - modul yang belum dibangun → `segera` (layar "Segera hadir"/"Tersedia di desktop")
 *  - berkas luar (Google Docs) → `luar`
 *  - tanpa tujuan              → `detail` (lembar detail notifikasi)
 */
import { Linking } from 'react-native';
import { router } from 'expo-router';

import { bukaSegera, type ParamSegera } from '@/features/settings/ComingSoon';

export interface TargetLike {
  type: string;
  id: string | null;
  anchor?: string | null;
  params?: Record<string, string> | null;
}

export type Tujuan =
  | { aksi: 'rute'; href: string }
  | { aksi: 'segera'; param: ParamSegera }
  | { aksi: 'luar'; url: string }
  | { aksi: 'detail' }
  | { aksi: 'tidak-tersedia'; jenis: string };

function rute(href: string): Tujuan {
  return { aksi: 'rute', href };
}

function segera(param: ParamSegera): Tujuan {
  return { aksi: 'segera', param };
}

function dengan(path: string, query: Record<string, string | undefined>): string {
  const bagian = Object.entries(query)
    .filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return bagian.length > 0 ? `${path}?${bagian.join('&')}` : path;
}

/** Peta jenis target → tujuan. `notifikasiId` dipakai jenis yang membuka detail notifikasi itu sendiri. */
export function resolveTarget(target: TargetLike | null | undefined, opsi: { notifikasiId?: string; urlLuar?: string | null } = {}): Tujuan {
  if (!target) {
    return { aksi: 'detail' };
  }
  const { type, id } = target;
  const anchor = target.anchor ?? null;
  const params = target.params ?? {};

  switch (type) {
    case 'tugas':
      return id ? rute(dengan(`/tugas/${id}`, { anchor: anchor ?? undefined })) : { aksi: 'tidak-tersedia', jenis: 'Tugas' };
    case 'catatan':
      return id ? rute(`/catatan/${id}`) : { aksi: 'tidak-tersedia', jenis: 'Catatan' };
    case 'obrolan':
      return id ? rute(dengan(`/obrolan/${id}`, { anchor: anchor ?? undefined })) : { aksi: 'tidak-tersedia', jenis: 'Obrolan' };
    case 'rapat':
      if (!id) {
        return { aksi: 'tidak-tersedia', jenis: 'Rapat' };
      }
      return rute(dengan(anchor === 'notulen' ? `/rapat/${id}/notulen` : `/rapat/${id}`, { tanggal: params.tanggal }));
    case 'workspace':
      return id ? rute(`/workspace/${id}`) : { aksi: 'tidak-tersedia', jenis: 'Workspace' };
    case 'pengumuman':
      return id ? rute(`/pengumuman/${id}`) : rute('/pengumuman');
    case 'briefing':
      // Teks lengkap ada di isi notifikasi → layar penuh detail notifikasi.
      return opsi.notifikasiId ? rute(`/inbox/${opsi.notifikasiId}`) : { aksi: 'detail' };
    case 'absensi':
      return rute('/absen');
    case 'keamanan':
      return rute('/pengaturan/keamanan');
    case 'pengajuan':
      return id ? rute(`/pengajuan/${id}`) : rute('/pengajuan');
    case 'persetujuan':
      return id ? rute(`/persetujuan/${id}`) : rute('/persetujuan');
    case 'laporan':
      return rute(id ? `/laporan/${id}` : '/laporan/hari-ini');
    case 'proyek':
      return segera({ judul: 'Ringkasan proyek', ikon: 'briefcase-business', desktop: true, tautan: '/portofolio' });
    case 'okr':
      return segera({ judul: 'OKR divisi', ikon: 'target', desktop: true, tautan: id ? `/okr/${id}` : '/okr' });
    case 'hiring':
      return segera({ judul: 'Profil kandidat', ikon: 'user-round-search', desktop: true, tautan: '/hiring' });
    case 'karyawan':
      return segera({ judul: 'Karyawan', ikon: 'users', desktop: true, tautan: id ? `/admin/karyawan/${id}` : '/admin/karyawan' });
    case 'orang':
      return segera({ judul: 'Profil karyawan', ikon: 'user', desktop: true, tautan: id ? `/admin/karyawan/${id}` : undefined });
    case 'dokumen':
      return opsi.urlLuar ? { aksi: 'luar', url: opsi.urlLuar } : { aksi: 'tidak-tersedia', jenis: 'Dokumen' };
    default:
      return { aksi: 'detail' };
  }
}

/** Jalankan tujuan. `detail` tidak menavigasi: pemanggil membuka lembar detail. Mengembalikan `true` bila sudah ditangani. */
export function bukaTujuan(tujuan: Tujuan, notifikasiId?: string): boolean {
  switch (tujuan.aksi) {
    case 'rute':
      router.push(tujuan.href as never);
      return true;
    case 'segera':
      bukaSegera(tujuan.param);
      return true;
    case 'luar':
      void Linking.openURL(tujuan.url).catch(() => undefined);
      return true;
    case 'tidak-tersedia':
      router.push({ pathname: '/inbox/tidak-tersedia', params: { jenis: tujuan.jenis } } as never);
      return true;
    case 'detail':
      if (notifikasiId) {
        router.push(`/inbox/${notifikasiId}` as never);
        return true;
      }
      return false;
  }
}
