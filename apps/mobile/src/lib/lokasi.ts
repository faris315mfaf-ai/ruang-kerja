/**
 * Lokasi GPS untuk absen — expo-location, akurasi tinggi, izin ramah.
 */
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

export interface TitikLokasi {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  waktu: number;
}

export type StatusLokasi =
  | { keadaan: 'idle' }
  | { keadaan: 'memuat' }
  | { keadaan: 'siap'; titik: TitikLokasi }
  | { keadaan: 'galat'; pesan: string };

export function useLokasi(): {
  status: StatusLokasi;
  ambil: () => Promise<void>;
} {
  const [status, setStatus] = useState<StatusLokasi>({ keadaan: 'idle' });

  const ambil = useCallback(async (): Promise<void> => {
    setStatus({ keadaan: 'memuat' });

    try {
      const izin = await Location.requestForegroundPermissionsAsync();
      if (!izin.granted) {
        setStatus({
          keadaan: 'galat',
          pesan: 'Izin lokasi diperlukan untuk absen. Izinkan dari pengaturan ponsel lalu coba lagi.',
        });
        return;
      }

      const posisi = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setStatus({
        keadaan: 'siap',
        titik: {
          latitude: posisi.coords.latitude,
          longitude: posisi.coords.longitude,
          accuracy: posisi.coords.accuracy ?? null,
          waktu: posisi.timestamp,
        },
      });
    } catch {
      setStatus({ keadaan: 'galat', pesan: 'Lokasi belum terbaca. Pastikan GPS aktif lalu coba lagi.' });
    }
  }, []);

  return { status, ambil };
}
