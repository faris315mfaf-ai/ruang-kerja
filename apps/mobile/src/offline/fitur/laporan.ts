/**
 * Tulis LAPORAN HARIAN saat offline (keputusan pemilik 14 Okt 2026): simpan
 * otomatis draf (`PUT laporan/hari-ini`) dan kirim (`POST …/kirim`) masuk
 * antrean lokal lalu dikirim otomatis begitu ada internet.
 *
 *  - Draf berturutan digabung jadi SATU item menunggu (isian terakhir menang);
 *    "kirim" mengantre di belakang draf terbaru (satu `urutanKunci`
 *    `laporan:<tanggal>`) dan menggantikan draf yang sudah tak perlu — badan
 *    kirim memuat isian lengkap. "Pindahkan ke …" diterapkan server saat kirim.
 *  - Laporan terkunci pukul 23.59 (waktu kantor). Item yang sampai ke server
 *    sesudahnya ditolak 403 `laporan_terkunci`: ditampilkan sebagai konflik
 *    di Antrean ("sudah terkunci; hubungi atasan/HR"). Pemeriksaan tanggal di
 *    perangkat dilakukan lebih dulu, server tetap penentu.
 */
import { router } from 'expo-router';

import { ApiError, apiRequest } from '@/api/client';
import type { BodyLaporan, HasilKirim, Laporan } from '@/api/laporan';
import { tanggalLaporan } from '@/features/laporan/format';

import { cariItem, daftarkanPenangan, enqueue, hapusItem, perbaruiItem, type ItemAntrean } from '../antrean';
import { cobaOnline, tanggalKantor, type HasilTulis } from './umum';

export const JENIS_LAPORAN = { draf: 'laporan.draf', kirim: 'laporan.kirim' } as const;

export const CATATAN_OFFLINE_LAPORAN = 'Offline: terkirim otomatis saat online; laporan terkunci pukul 23.59.';

interface MetaLaporan {
  tanggal: string;
}

function meta(item: ItemAntrean): MetaLaporan {
  return item.meta as unknown as MetaLaporan;
}

export function itemLaporan(tanggal: string): ItemAntrean[] {
  return cariItem((i) => i.jenis.startsWith('laporan.') && meta(i).tanggal === tanggal);
}

export interface AntreanLaporan {
  /** Isian terbaru yang menunggu dikirim (draf atau kirim). */
  body: BodyLaporan;
  /** Waktu perangkat saat isian itu terakhir diubah (ISO). */
  disimpanPada: string;
  /** Ada permintaan "Kirim" yang menunggu. */
  menungguKirim: boolean;
  /** Item yang `konflik`/`gagal`. */
  bermasalah: ItemAntrean[];
}

/** Isian terbaru dari antrean untuk sebuah tanggal (untuk memulihkan form), atau null. */
export function bacaAntreanLaporan(tanggal: string): AntreanLaporan | null {
  const daftar = itemLaporan(tanggal);
  const terakhir = daftar.at(-1);
  if (!terakhir) {
    return null;
  }
  return {
    body: terakhir.json as BodyLaporan,
    disimpanPada: terakhir.dibuatPada,
    menungguKirim: daftar.some((i) => i.jenis === JENIS_LAPORAN.kirim && i.status !== 'konflik' && i.status !== 'gagal'),
    bermasalah: daftar.filter((i) => i.status === 'konflik' || i.status === 'gagal'),
  };
}

/** Simpan draf: langsung ke server bila online dan tak ada antrean tanggal itu; selain itu antre. */
export async function simpanDrafLaporan(body: BodyLaporan): Promise<HasilTulis<Laporan>> {
  const tanggal = body.report_date;
  if (itemLaporan(tanggal).length === 0) {
    const hasil = await cobaOnline(() => apiRequest<{ report: Laporan }>('laporan/hari-ini', { method: 'PUT', json: body, timeoutMs: 20_000, cache: false }));
    if (hasil) {
      if (!hasil.nilai?.report) {
        throw new ApiError({ status: 500, message: 'Respons server kosong.' });
      }
      return { antre: false, nilai: hasil.nilai.report };
    }
  }
  // Gabung ke draf yang menunggu BILA itu item terakhir tanggal ini (kirim yang menunggu harus tetap lebih dulu).
  const terakhir = itemLaporan(tanggal).at(-1);
  if (terakhir && terakhir.jenis === JENIS_LAPORAN.draf && terakhir.status === 'menunggu') {
    if (await perbaruiItem(terakhir.id, { json: body, ringkas: ringkasBody(body) })) {
      return { antre: true };
    }
  }
  await enqueue({
    jenis: JENIS_LAPORAN.draf,
    label: `Draf laporan ${tanggalLaporan(tanggal)}`,
    ringkas: ringkasBody(body),
    method: 'PUT',
    path: 'laporan/hari-ini',
    json: body,
    urutanKunci: `laporan:${tanggal}`,
    meta: { tanggal } satisfies MetaLaporan as unknown as Record<string, unknown>,
  });
  return { antre: true };
}

/** Kirim laporan: langsung ke server bila online; selain itu antre di belakang draf terbaru. */
export async function kirimLaporanAman(body: BodyLaporan): Promise<HasilTulis<HasilKirim>> {
  const tanggal = body.report_date;
  if (itemLaporan(tanggal).length === 0) {
    const hasil = await cobaOnline(() => apiRequest<HasilKirim>('laporan/hari-ini/kirim', { method: 'POST', json: body, timeoutMs: 20_000, cache: false }));
    if (hasil) {
      if (!hasil.nilai) {
        throw new ApiError({ status: 500, message: 'Respons server kosong.' });
      }
      return { antre: false, nilai: hasil.nilai };
    }
  }
  // Draf yang menunggu jadi tidak perlu: badan kirim memuat isian lengkap.
  for (const i of itemLaporan(tanggal)) {
    if (i.jenis === JENIS_LAPORAN.draf && i.status === 'menunggu') {
      await hapusItem(i.id);
    }
  }
  await enqueue({
    jenis: JENIS_LAPORAN.kirim,
    label: `Kirim laporan ${tanggalLaporan(tanggal)}`,
    ringkas: ringkasBody(body),
    method: 'POST',
    path: 'laporan/hari-ini/kirim',
    json: body,
    urutanKunci: `laporan:${tanggal}`,
    dedupeKunci: `laporan:${tanggal}:kirim`,
    meta: { tanggal } satisfies MetaLaporan as unknown as Record<string, unknown>,
  });
  return { antre: true };
}

function ringkasBody(b: BodyLaporan): string {
  const n = b.items.length;
  return n === 0 ? 'Belum ada pekerjaan' : `${n} pekerjaan`;
}

function pesanTerkunci(tanggal: string): string {
  return `Laporan tanggal ${tanggalLaporan(tanggal)} sudah terkunci (batas pukul 23.59). Hubungi atasan atau HR bila perlu dikoreksi.`;
}

let terdaftar = false;

export function daftarkanPenanganLaporan(): void {
  if (terdaftar) {
    return;
  }
  terdaftar = true;

  const umum = {
    bangunPermintaan: (item: ItemAntrean): undefined => {
      const { tanggal } = meta(item);
      if (tanggal < tanggalKantor()) {
        // Hari sudah berganti di perangkat: server pasti menolak (403). Tanpa kirim, tampilkan penjelasan yang jelas.
        throw new ApiError({ status: 403, code: 'laporan_terkunci', message: pesanTerkunci(tanggal) });
      }
      return undefined;
    },
    catatan: (item: ItemAntrean): { teks: string; nada: 'info' | 'warn' | 'bad' } | null => {
      if (item.status === 'konflik' || item.status === 'gagal') {
        // Pesan server ("Muat ulang untuk menulis…") dilengkapi arahan yang jelas; pemeriksaan di perangkat sudah memuatnya.
        return item.galat?.kode === 'laporan_terkunci' && !item.galat.pesan.includes('Hubungi atasan')
          ? { teks: `Laporan tanggal ${tanggalLaporan(meta(item).tanggal)} sudah terkunci; hubungi atasan/HR.`, nada: 'bad' }
          : null;
      }
      return { teks: CATATAN_OFFLINE_LAPORAN, nada: 'info' };
    },
    ubah: (item: ItemAntrean): void => {
      if (meta(item).tanggal === tanggalKantor()) {
        router.push('/laporan/hari-ini' as never);
      }
    },
  };

  daftarkanPenangan(JENIS_LAPORAN.draf, { ...umum, pesanSukses: () => null });
  daftarkanPenangan(JENIS_LAPORAN.kirim, {
    ...umum,
    pesanSukses: (item) => `Laporan ${tanggalLaporan(meta(item).tanggal)} terkirim`,
  });
}

daftarkanPenanganLaporan();
