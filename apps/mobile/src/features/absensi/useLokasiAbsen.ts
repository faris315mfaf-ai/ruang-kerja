/**
 * Lokasi GPS untuk Absen (expo-location, hanya izin foreground). Berbeda dari
 * `lib/lokasi.ts`: membedakan izin belum diminta / ditolak / ditolak permanen /
 * hanya perkiraan / layanan lokasi mati, membawa penanda lokasi palsu
 * (`mocked`), dan semua dialog sistem dibungkus `tahanKunci` agar kunci
 * aplikasi tidak menutup aplikasi saat dialog Android tampil.
 */
import * as Location from 'expo-location';
import { useCallback, useRef, useState } from 'react';

import { useAppLock } from '@/features/auth/appLock';

export interface TitikGps {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** Epoch ms fix (tidak pernah lebih baru dari sekarang). */
  waktu: number;
  /** Android melaporkan lokasi dari aplikasi simulasi. */
  mocked: boolean;
}

export type JenisGalatLokasi = 'izin_belum' | 'izin_ditolak' | 'izin_permanen' | 'perkiraan' | 'layanan_mati' | 'waktu' | 'umum';

export type StatusGps =
  | { keadaan: 'idle' }
  | { keadaan: 'memuat' }
  | { keadaan: 'siap'; titik: TitikGps }
  | { keadaan: 'galat'; jenis: JenisGalatLokasi; pesan: string; titik: TitikGps | null };

/** Fix lebih tua dari ini dibaca ulang sebelum dikirim. */
export const UMUR_MAKS_MS = 2 * 60 * 1000;
export const BATAS_WAKTU_MS = 15_000;
/** Akurasi di atas ini ditandai server (`low_accuracy`). */
export const AKURASI_TANDAI_M = 100;
/** Peringatan dini di aplikasi mulai dari sini. */
export const AKURASI_PERINGATAN_M = 50;

class BatasWaktu extends Error {}

export function titikSegar(titik: TitikGps | null, sekarang = Date.now()): titik is TitikGps {
  return titik !== null && sekarang - titik.waktu < UMUR_MAKS_MS;
}

export function useLokasiAbsen(): {
  status: StatusGps;
  /** Baca fix baru. `minta` = tampilkan dialog izin bila belum diminta (setelah penjelasan). */
  ambil: (opsi?: { minta?: boolean }) => Promise<TitikGps | null>;
  /** Dialog sistem "Aktifkan lokasi" lalu baca ulang. */
  aktifkanLayanan: () => Promise<TitikGps | null>;
  reset: () => void;
} {
  const { tahanKunci } = useAppLock();
  const [status, setStatus] = useState<StatusGps>({ keadaan: 'idle' });
  const urutan = useRef(0);

  const ambil = useCallback(
    async (opsi?: { minta?: boolean }): Promise<TitikGps | null> => {
      const id = ++urutan.current;
      const aktif = (): boolean => id === urutan.current;
      const gagal = (jenis: JenisGalatLokasi, pesan: string, titik: TitikGps | null = null): null => {
        if (aktif()) {
          setStatus({ keadaan: 'galat', jenis, pesan, titik });
        }
        return null;
      };
      setStatus({ keadaan: 'memuat' });

      try {
        let izin = await Location.getForegroundPermissionsAsync();
        if (!izin.granted) {
          if (izin.canAskAgain && opsi?.minta !== true) {
            return gagal('izin_belum', 'Izinkan lokasi saat absen agar kami bisa memastikan Anda berada di area kantor.');
          }
          if (!izin.canAskAgain && izin.status !== 'undetermined') {
            return gagal('izin_permanen', 'Izin lokasi ditolak. Izinkan dari pengaturan ponsel lalu coba lagi. Android tidak menampilkan dialog izin lagi setelah ditolak dua kali.');
          }
          izin = await tahanKunci(() => Location.requestForegroundPermissionsAsync());
          if (!izin.granted) {
            return izin.canAskAgain
              ? gagal('izin_ditolak', 'Izin lokasi diperlukan untuk check-in GPS. Izinkan lalu coba lagi.')
              : gagal('izin_permanen', 'Izin lokasi ditolak. Izinkan dari pengaturan ponsel lalu coba lagi. Android tidak menampilkan dialog izin lagi setelah ditolak dua kali.');
          }
        }

        if (!(await Location.hasServicesEnabledAsync().catch(() => true))) {
          return gagal('layanan_mati', 'Layanan lokasi mati. RuangKerja memerlukannya untuk memeriksa Anda berada di area kantor.');
        }

        let timer: ReturnType<typeof setTimeout> | undefined;
        const posisi = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise<never>((_, tolak) => {
            timer = setTimeout(() => tolak(new BatasWaktu()), BATAS_WAKTU_MS);
          }),
        ]).finally(() => clearTimeout(timer));

        const titik: TitikGps = {
          latitude: posisi.coords.latitude,
          longitude: posisi.coords.longitude,
          accuracy: posisi.coords.accuracy ?? null,
          waktu: Math.min(posisi.timestamp, Date.now()),
          mocked: posisi.mocked === true,
        };

        // Izin "Perkiraan" (Android 12+): terlalu kasar untuk absen.
        if (izin.android?.accuracy === 'coarse') {
          return gagal('perkiraan', 'Lokasi perkiraan. Akurasi terlalu kasar untuk absen. Ubah izin ke Lokasi tepat.', titik);
        }

        if (aktif()) {
          setStatus({ keadaan: 'siap', titik });
        }
        return titik;
      } catch (err) {
        return err instanceof BatasWaktu
          ? gagal('waktu', 'Lokasi belum terbaca setelah 15 detik. Pindah ke area terbuka atau pastikan GPS aktif, lalu coba lagi.')
          : gagal('umum', 'Lokasi belum terbaca. Pastikan GPS aktif lalu coba lagi.');
      }
    },
    [tahanKunci],
  );

  const aktifkanLayanan = useCallback(async (): Promise<TitikGps | null> => {
    try {
      await tahanKunci(() => Location.enableNetworkProviderAsync());
    } catch {
      // Pengguna menolak: pesan "layanan mati" tetap tampil setelah baca ulang.
    }
    return ambil();
  }, [ambil, tahanKunci]);

  const reset = useCallback((): void => {
    urutan.current += 1;
    setStatus({ keadaan: 'idle' });
  }, []);

  return { status, ambil, aktifkanLayanan, reset };
}
