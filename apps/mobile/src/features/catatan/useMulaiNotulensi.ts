/** "Mulai notulensi": POST /catatan/notulensi lalu buka editor dalam mode catat. */
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { mulaiNotulensi } from '@/api/catatan';
import { useSnackbar } from '@/ui';

import { pesanGalat } from './AksiBaris';
import { sesiStore } from './sesiCatat';

export function useMulaiNotulensi(): { mulai: () => Promise<void>; membuat: boolean } {
  const snackbar = useSnackbar();
  const [membuat, setMembuat] = useState(false);
  const mulaiRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const mulai = useCallback(async (): Promise<void> => {
    if (membuat) {
      return;
    }
    const berjalan = sesiStore.get().sesi;
    if (berjalan !== null) {
      snackbar.show({ message: 'Notulensi sedang berjalan. Selesaikan dulu sebelum memulai yang baru.', variant: 'info' });
      router.push(`/catatan/${berjalan.noteId}`);
      return;
    }
    setMembuat(true);
    try {
      const hasil = await mulaiNotulensi();
      router.push(`/catatan/${hasil.note.id}${hasil.mode === 'catat' ? '?mode=catat' : ''}`);
    } catch (err) {
      snackbar.show({
        message: pesanGalat(err, 'Notulensi gagal dibuat. Coba lagi.'),
        variant: 'bad',
        actionLabel: 'Coba lagi',
        onAction: () => {
          void mulaiRef.current();
        },
      });
    } finally {
      setMembuat(false);
    }
  }, [membuat, snackbar]);

  useEffect(() => {
    mulaiRef.current = mulai;
  }, [mulai]);

  return { mulai, membuat };
}
