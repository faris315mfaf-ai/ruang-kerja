/**
 * "Kirim tautan ke email saya" dengan konfirmasi (mockup 11 › 05/22): tautan
 * selalu ke email akun sendiri dan hanya path web ber-allowlist server.
 */
import { useCallback } from 'react';

import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { useDialog } from '@/ui';

import { usePeranHr } from './akses';

export function useTautanDesktop(): { kirim: (path: string, judul: string, catatan?: string) => void; mengirim: boolean } {
  const dialog = useDialog();
  const { email } = usePeranHr();
  const { kirim: kirimLangsung, mengirim } = useKirimTautan();

  const kirim = useCallback(
    (path: string, judul: string, catatan = 'Buka dari komputer, lalu masuk.'): void => {
      void (async () => {
        const ok = await dialog.confirm({
          title: 'Kirim tautan ke email saya?',
          message: `Kami kirim tautan ${judul} ke ${email || 'email akun Anda'}. ${catatan}`,
          confirmLabel: 'Kirim tautan',
          cancelLabel: 'Batal',
        });
        if (ok) await kirimLangsung(path);
      })();
    },
    [dialog, email, kirimLangsung],
  );

  return { kirim, mengirim };
}
