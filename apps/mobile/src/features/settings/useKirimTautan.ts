/**
 * "Kirim tautan ke email saya" (`POST /tautan-desktop`) untuk fitur yang hanya
 * ada di desktop. Path harus masuk daftar putih server (config/api_app_links).
 */
import { useCallback, useState } from 'react';

import { ApiError } from '@/api/client';
import { kirimTautanDesktop } from '@/api/akun';
import { useSnackbar } from '@/ui';

export function useKirimTautan(): { kirim: (path: string) => Promise<void>; mengirim: boolean } {
  const snackbar = useSnackbar();
  const [mengirim, setMengirim] = useState(false);

  const kirim = useCallback(
    async (path: string): Promise<void> => {
      if (mengirim) {
        return;
      }
      setMengirim(true);
      try {
        const hasil = await kirimTautanDesktop(path);
        snackbar.show({ message: hasil.message, variant: 'ok' });
      } catch (err) {
        if (err instanceof ApiError && err.status === 0) {
          snackbar.show({ message: 'Tidak ada koneksi. Tautan belum terkirim.', variant: 'offline' });
        } else {
          snackbar.show({
            message: err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Tautan gagal dikirim.',
            variant: 'bad',
          });
        }
      } finally {
        setMengirim(false);
      }
    },
    [mengirim, snackbar],
  );

  return { kirim, mengirim };
}
