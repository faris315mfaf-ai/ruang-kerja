/** Konfirmasi "Buang …?" saat kembali dari form yang sudah diisi (tombol/gestur kembali sistem). */
import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useDialog } from '@/ui';

export function useJagaBuang(adaPerubahan: boolean, judul: string, pesan: string): { izinkanKeluar: () => void } {
  const navigation = useNavigation();
  const dialog = useDialog();
  const lewati = useRef(false);
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (lewati.current || !adaPerubahan) return;
      e.preventDefault();
      void dialog.confirm({ title: judul, message: pesan, confirmLabel: 'Buang', destructive: true }).then((ok) => {
        if (ok) {
          lewati.current = true;
          navigation.dispatch(e.data.action);
        }
      });
    });
  }, [navigation, adaPerubahan, dialog, judul, pesan]);
  return {
    izinkanKeluar: () => {
      lewati.current = true;
    },
  };
}
