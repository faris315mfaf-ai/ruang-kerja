/**
 * "Urungkan" sisi aplikasi untuk aksi yang tidak punya urungkan di server
 * (kontrak B5-A: hapus milestone/risiko/catatan, minta update, arahan): aksi
 * ditahan 6 detik dengan snackbar "Urungkan", baru dikirim bila tidak
 * dibatalkan. Timer tetap berjalan walau layar ditutup.
 */
import { useCallback } from 'react';

import { ApiError } from '@/api/client';
import { useSnackbar } from '@/ui';

export const JEDA_URUNGKAN = 6000;

export interface OpsiTunda {
  /** Pesan selama jeda, mis. "Milestone dihapus." */
  pesan: string;
  /** Pengiriman ke server setelah jeda. Nilai string = pesan sukses (opsional). */
  kirim: () => Promise<string | void>;
  /** Pulihkan tampilan bila diurungkan atau gagal. */
  pulihkan?: () => void;
  /** Dipanggil setelah sukses (mis. muat ulang). */
  selesai?: () => void;
}

export function useTundaKirim(): (opsi: OpsiTunda) => void {
  const snackbar = useSnackbar();
  return useCallback(
    ({ pesan, kirim, pulihkan, selesai }: OpsiTunda): void => {
      let batal = false;
      const timer = setTimeout(() => {
        if (batal) return;
        kirim()
          .then((pesanServer) => {
            if (typeof pesanServer === 'string' && pesanServer !== '') snackbar.show({ message: pesanServer, variant: 'ok' });
            selesai?.();
          })
          .catch((err: unknown) => {
            pulihkan?.();
            snackbar.show({
              message: err instanceof ApiError ? (err.status === 0 ? 'Tidak ada koneksi. Perubahan dibatalkan.' : (err.firstValidationError ?? err.message)) : 'Gagal menyimpan perubahan.',
              variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad',
            });
          });
      }, JEDA_URUNGKAN);
      snackbar.show({
        message: pesan,
        variant: 'info',
        actionLabel: 'Urungkan',
        duration: JEDA_URUNGKAN,
        onAction: () => {
          batal = true;
          clearTimeout(timer);
          pulihkan?.();
          snackbar.show({ message: 'Dibatalkan.', variant: 'info', duration: 2000 });
        },
      });
    },
    [snackbar],
  );
}

/** Pesan galat siap tampil (422 → pesan field pertama). */
export function pesanGalat(err: unknown, cadangan: string): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return 'Tidak ada koneksi. Coba lagi saat tersambung.';
    return err.firstValidationError ?? err.message;
  }
  return cadangan;
}
