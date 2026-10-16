/**
 * Pemuat data layar: muat saat `ambil` berubah (kunci filter), muat ulang
 * diam-diam (tarik-untuk-segarkan, tanpa kerangka), simpan data terakhir.
 * Galat jaringan (status 0) dengan data lama = mode offline: data tetap
 * terbaca dan `terakhir` memuat jam pemuatan sukses terakhir.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';

export interface HasilMuat<T> {
  data: T | null;
  /** true selama pemuatan non-diam (pertama / ganti filter / coba lagi). */
  memuat: boolean;
  galat: ApiError | null;
  /** Galat jaringan saat data lama masih ada. */
  offline: boolean;
  /** Galat non-jaringan saat data lama masih ada (tarik untuk mencoba lagi). */
  gagalSegar: boolean;
  terakhir: Date | null;
  muat: (diam?: boolean) => Promise<void>;
}

export function galatDariAny(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError({ status: 0, message: 'Tidak dapat memuat data. Periksa koneksi Anda.' });
}

export function useMuat<T>(ambil: () => Promise<T>): HasilMuat<T> {
  const [data, setData] = useState<T | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<ApiError | null>(null);
  const [terakhir, setTerakhir] = useState<Date | null>(null);
  const nomor = useRef(0);

  const muat = useCallback(
    async (diam = false): Promise<void> => {
      const saya = ++nomor.current;
      if (!diam) {
        setMemuat(true);
      }
      try {
        const hasil = await ambil();
        if (saya === nomor.current) {
          setData(hasil);
          setGalat(null);
          setTerakhir(new Date());
        }
      } catch (err) {
        if (saya === nomor.current) {
          setGalat(galatDariAny(err));
        }
      } finally {
        if (saya === nomor.current) {
          setMemuat(false);
        }
      }
    },
    [ambil],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat layar dibuka / filter berubah
    void muat();
  }, [muat]);

  return {
    data,
    memuat,
    galat,
    offline: galat !== null && galat.status === 0 && data !== null,
    gagalSegar: galat !== null && galat.status !== 0 && data !== null,
    terakhir,
    muat,
  };
}
