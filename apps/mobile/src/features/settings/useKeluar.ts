/**
 * Alur keluar akun: dialog konfirmasi (dengan peringatan bila ada perubahan
 * offline belum terkirim) → `useSession().keluar()` (cabut token di server;
 * tetap keluar bila server tak terjangkau).
 */
import { useCallback, useState } from 'react';

import { jumlahTertunda } from '@/offline/antrean';
import { useSession } from '@/session/SessionProvider';
import { useDialog, useSnackbar } from '@/ui';

/** Jumlah perubahan yang dibuat saat offline dan belum terkirim (antrean offline, `src/offline`). */
export function jumlahAntreanTertunda(): { jumlah: number; rincian: string } {
  return { jumlah: jumlahTertunda(), rincian: '' };
}

export function useKeluar(): { keluarDenganKonfirmasi: () => Promise<void>; keluarLangsung: () => Promise<void>; keluar: boolean } {
  const { keluar } = useSession();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [sibuk, setSibuk] = useState(false);

  const keluarLangsung = useCallback(async (): Promise<void> => {
    setSibuk(true);
    try {
      await keluar();
      snackbar.show({ message: 'Anda sudah keluar.', variant: 'info', anchor: 'bottom' });
    } finally {
      setSibuk(false);
    }
  }, [keluar, snackbar]);

  const keluarDenganKonfirmasi = useCallback(async (): Promise<void> => {
    const antrean = jumlahAntreanTertunda();
    const setuju =
      antrean.jumlah > 0
        ? await dialog.confirm({
            title: 'Ada perubahan belum terkirim',
            message: `${antrean.jumlah} perubahan dibuat saat offline${antrean.rincian ? ` (${antrean.rincian})` : ''} belum terkirim. Keluar sekarang akan menghapusnya dari perangkat ini.`,
            confirmLabel: 'Keluar & hapus',
            cancelLabel: 'Tetap di sini',
            destructive: true,
          })
        : await dialog.confirm({
            title: 'Keluar dari RuangKerja?',
            message: 'Anda perlu masuk lagi dengan email dan kata sandi. Perangkat ini dihapus dari daftar perangkat Anda.',
            confirmLabel: 'Keluar',
            cancelLabel: 'Batal',
            destructive: true,
          });
    if (setuju) {
      await keluarLangsung();
    }
  }, [dialog, keluarLangsung]);

  return { keluarDenganKonfirmasi, keluarLangsung, keluar: sibuk };
}
