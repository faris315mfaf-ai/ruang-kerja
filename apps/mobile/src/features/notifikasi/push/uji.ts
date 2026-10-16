/**
 * "Kirim notifikasi uji": lewat server (`system.test` → FCM) bila push aktif
 * di perangkat ini, selain itu notifikasi LOKAL (jelas ditandai di pesannya).
 * Dipakai layar Pengaturan › Notifikasi dan Notifikasi di ponsel ini.
 */
import { useCallback, useState } from 'react';

import { ApiError } from '@/api/client';
import { kirimNotifikasiUji } from '@/api/notifikasi';
import { useSnackbar } from '@/ui';

import { izinNotifikasiDiberikan } from './token';
import { tampilkanNotifikasiLokal } from './lokal';
import { bacaStatusPush } from './status';

export interface UjiNotifikasi {
  mengirim: boolean;
  /** Server bila push aktif (`serverSiap` dari pengaturan + token terdaftar), selain itu lokal. */
  kirim: () => Promise<void>;
  /** Selalu lokal (tanpa server/Firebase). */
  kirimLokal: () => Promise<void>;
}

const ALASAN_LOKAL: Record<string, string> = {
  izin: 'izin notifikasi belum diberikan',
  firebase: 'Firebase belum dikonfigurasi di aplikasi ini',
  offline: 'token push belum terkirim ke server',
  server: 'token push belum terdaftar di server',
  memeriksa: 'status push belum diketahui',
};

export function useUjiNotifikasi(serverSiap: boolean | undefined): UjiNotifikasi {
  const snackbar = useSnackbar();
  const [mengirim, setMengirim] = useState(false);

  const lokal = useCallback(
    async (alasan: string | null): Promise<void> => {
      if (!(await izinNotifikasiDiberikan())) {
        snackbar.show({ message: 'Izin notifikasi belum diberikan di Android. Aktifkan dulu untuk menguji.', variant: 'warn' });
        return;
      }
      try {
        await tampilkanNotifikasiLokal({
          title: 'Notifikasi uji (LOKAL)',
          body: 'Dibuat di ponsel ini, tidak lewat server atau Firebase. Ketuk untuk membuka pengaturan.',
        });
        snackbar.show({
          message: alasan ? `Notifikasi uji LOKAL ditampilkan — ${alasan}.` : 'Notifikasi uji LOKAL ditampilkan (tidak lewat server).',
          variant: 'info',
          duration: 6000,
        });
      } catch {
        snackbar.show({ message: 'Notifikasi uji lokal gagal ditampilkan.', variant: 'bad' });
      }
    },
    [snackbar],
  );

  const kirim = useCallback(async (): Promise<void> => {
    setMengirim(true);
    try {
      const status = bacaStatusPush();
      if (!serverSiap || status.kode !== 'aktif') {
        const alasan = !serverSiap && status.kode === 'aktif' ? 'push dari server belum aktif' : ALASAN_LOKAL[status.kode] ?? 'push belum aktif';
        await lokal(alasan);
        return;
      }
      const hasil = await kirimNotifikasiUji();
      snackbar.show({ message: `${hasil.message} (lewat server)`, variant: 'ok', duration: 6000 });
    } catch (err) {
      const mati = err instanceof ApiError && err.status === 0;
      snackbar.show({
        message: mati
          ? 'Tidak ada koneksi. Notifikasi uji belum terkirim.'
          : err instanceof ApiError && err.status === 429
            ? 'Terlalu sering. Coba lagi sebentar lagi.'
            : err instanceof ApiError
              ? err.message
              : 'Notifikasi uji gagal dikirim.',
        variant: mati ? 'offline' : 'bad',
      });
    } finally {
      setMengirim(false);
    }
  }, [lokal, serverSiap, snackbar]);

  const kirimLokal = useCallback(async (): Promise<void> => {
    setMengirim(true);
    try {
      await lokal(null);
    } finally {
      setMengirim(false);
    }
  }, [lokal]);

  return { mengirim, kirim, kirimLokal };
}
