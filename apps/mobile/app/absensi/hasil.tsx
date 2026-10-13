/** Hasil check-in/out (berhasil atau ditolak) dari store; tombol kembali sistem menutup ke layar Absen. */
import { router } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler } from 'react-native';

import { HasilGagal } from '@/features/absensi/HasilGagal';
import { HasilSukses } from '@/features/absensi/HasilSukses';
import { absenStore, useAbsenStore } from '@/features/absensi/store';

export default function LayarHasil(): React.JSX.Element | null {
  const st = useAbsenStore();
  const hasil = st.hasil;

  const tutup = useCallback((): void => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/absen');
    }
  }, []);

  useEffect(() => {
    const l = BackHandler.addEventListener('hardwareBackPress', () => {
      tutup();
      return true;
    });
    return () => l.remove();
  }, [tutup]);

  // Hasil dibersihkan saat layar ditutup.
  useEffect(() => () => absenStore.setHasil(null), []);

  // Tanpa hasil (mis. dibuka langsung): kembali.
  useEffect(() => {
    if (hasil === null) {
      tutup();
    }
  }, [hasil, tutup]);

  if (hasil === null) {
    return null;
  }
  return hasil.jenis === 'sukses' ? <HasilSukses h={hasil} onSelesai={tutup} /> : <HasilGagal key={hasil.diterimaPada} h={hasil} onKembali={tutup} />;
}
