/**
 * Lokasi GPS untuk absen — expo-location, akurasi tinggi, izin ramah.
 */
import * as Location from 'expo-location';
import { useCallback, useRef, useState } from 'react';

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
  | { keadaan: 'galat'; pesan: string; bukaPengaturan?: boolean };

/** A fix older than this is re-acquired before it is sent to the server. */
export const UMUR_MAKS_LOKASI_MS = 2 * 60 * 1000;
const BATAS_WAKTU_MS = 15_000;

class BatasWaktuLokasi extends Error {}

/** True when the fix is recent enough to be submitted. */
export function lokasiSegar(titik: TitikLokasi | null, sekarang = Date.now()): titik is TitikLokasi {
  return titik !== null && sekarang - titik.waktu < UMUR_MAKS_LOKASI_MS;
}

export function useLokasi(): {
  status: StatusLokasi;
  /** Reads a fresh fix; resolves with it, or null when it failed (status holds the reason). */
  ambil: () => Promise<TitikLokasi | null>;
  /** Forgets the current fix (e.g. after a successful submit). */
  reset: () => void;
} {
  const [status, setStatus] = useState<StatusLokasi>({ keadaan: 'idle' });
  const urutan = useRef(0);

  const ambil = useCallback(async (): Promise<TitikLokasi | null> => {
    const id = ++urutan.current;
    setStatus({ keadaan: 'memuat' });

    try {
      const izin = await Location.requestForegroundPermissionsAsync();
      if (!izin.granted) {
        if (id === urutan.current) {
          setStatus({
            keadaan: 'galat',
            pesan: izin.canAskAgain
              ? 'Izin lokasi diperlukan untuk absen. Izinkan lalu coba lagi.'
              : 'Izin lokasi ditolak. Izinkan dari pengaturan ponsel lalu coba lagi.',
            bukaPengaturan: !izin.canAskAgain,
          });
        }
        return null;
      }

      let timer: ReturnType<typeof setTimeout> | undefined;
      const posisi = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, tolak) => {
          timer = setTimeout(() => tolak(new BatasWaktuLokasi()), BATAS_WAKTU_MS);
        }),
      ]).finally(() => clearTimeout(timer));

      const titik: TitikLokasi = {
        latitude: posisi.coords.latitude,
        longitude: posisi.coords.longitude,
        accuracy: posisi.coords.accuracy ?? null,
        // Some devices report a cached fix timestamp; never treat it as newer than now.
        waktu: Math.min(posisi.timestamp, Date.now()),
      };
      if (id === urutan.current) {
        setStatus({ keadaan: 'siap', titik });
      }
      return titik;
    } catch (err) {
      if (id === urutan.current) {
        setStatus({
          keadaan: 'galat',
          pesan:
            err instanceof BatasWaktuLokasi
              ? 'Lokasi belum terbaca setelah 15 detik. Pindah ke area terbuka atau pastikan GPS aktif, lalu coba lagi.'
              : 'Lokasi belum terbaca. Pastikan GPS aktif lalu coba lagi.',
        });
      }
      return null;
    }
  }, []);

  const reset = useCallback((): void => {
    urutan.current += 1;
    setStatus({ keadaan: 'idle' });
  }, []);

  return { status, ambil, reset };
}
