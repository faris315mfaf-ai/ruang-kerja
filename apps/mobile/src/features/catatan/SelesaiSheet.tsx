/** Sheet "Selesai mencatat?" (mockup 17): simpan paksa lalu akhiri mode catat. */
import { useState } from 'react';

import { BottomSheet, Button, Text, useSnackbar } from '@/ui';

import { akhiriSesi } from './sesiCatat';

export function SelesaiSheet({ visible, onClose, siram }: { visible: boolean; onClose: () => void; siram: () => Promise<boolean> }): React.JSX.Element {
  const snackbar = useSnackbar();
  const [sibuk, setSibuk] = useState(false);

  async function selesai(): Promise<void> {
    setSibuk(true);
    try {
      const aman = await siram();
      if (!aman) {
        snackbar.show({ message: 'Sebagian isi belum tersimpan. Periksa koneksi, lalu coba lagi.', variant: 'bad' });
        return;
      }
      akhiriSesi();
      onClose();
      snackbar.show({ message: 'Mode catat selesai.', variant: 'ok' });
    } finally {
      setSibuk(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Selesai mencatat?">
      <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
        Isi disimpan sekarang. Notulensi tetap ada di Catatan › Pribadi dan pil “Kembali ke notulensi” ditutup.
      </Text>
      <Button title="Selesai mencatat" onPress={() => void selesai()} loading={sibuk} loadingTitle="Menyimpan…" />
    </BottomSheet>
  );
}
