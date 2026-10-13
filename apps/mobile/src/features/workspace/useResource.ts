/**
 * Pemuat data layar dengan cache dalam-memori (stale-while-revalidate):
 * data lama langsung tampil, lalu disegarkan. Bila jaringan putus (status 0)
 * dan sudah ada data, layar tetap menampilkan data terakhir + pita offline
 * (`offline`, `diperbarui`). Cache hanya hidup selama aplikasi berjalan.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';

interface Entri {
  data: unknown;
  at: number;
}

const cache = new Map<string, Entri>();

export function hapusCache(awalan?: string): void {
  for (const k of [...cache.keys()]) {
    if (awalan === undefined || k.startsWith(awalan)) {
      cache.delete(k);
    }
  }
}

export interface HasilResource<T> {
  data: T | null;
  galat: ApiError | null;
  /** Pemuatan pertama tanpa data lama. */
  memuat: boolean;
  /** Sedang menyegarkan (data lama mungkin tampil). */
  menyegarkan: boolean;
  /** Gagal terhubung tetapi data lama masih ditampilkan. */
  offline: boolean;
  diperbarui: Date | null;
  muat: () => Promise<void>;
  ubah: (fn: (lama: T) => T) => void;
}

/**
 * Segarkan diam-diam saat layar kembali fokus (mis. setelah mengubah tugas di
 * layar lain). Hanya untuk layar (butuh konteks navigasi) — bukan untuk
 * komponen di luar layar seperti sheet tombol-tengah.
 */
export function useSegarkanSaatFokus(muat: () => Promise<void>): void {
  const pertama = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (pertama.current) {
        pertama.current = false;
        return;
      }
      void muat();
    }, [muat]),
  );
}

export function bentukGalat(err: unknown, cadangan: string): ApiError {
  return err instanceof ApiError ? err : new ApiError({ status: 0, message: cadangan });
}

export function useResource<T>(key: string | null, fetcher: () => Promise<T>): HasilResource<T> {
  const awal = key !== null ? (cache.get(key) as Entri | undefined) : undefined;
  const [data, setData] = useState<T | null>((awal?.data as T | undefined) ?? null);
  const [galat, setGalat] = useState<ApiError | null>(null);
  const [memuat, setMemuat] = useState(key !== null && awal === undefined);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [offline, setOffline] = useState(false);
  const [diperbarui, setDiperbarui] = useState<Date | null>(awal ? new Date(awal.at) : null);
  const fetcherRef = useRef(fetcher);
  const kunciRef = useRef(key);
  const adaData = useRef(awal !== undefined);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const muat = useCallback(async (): Promise<void> => {
    const kunci = kunciRef.current;
    if (kunci === null) {
      return;
    }
    if (adaData.current) {
      setMenyegarkan(true);
    } else {
      setMemuat(true);
    }
    try {
      const hasil = await fetcherRef.current();
      if (kunciRef.current !== kunci) {
        return;
      }
      const sekarang = Date.now();
      cache.set(kunci, { data: hasil, at: sekarang });
      adaData.current = true;
      setData(hasil);
      setGalat(null);
      setOffline(false);
      setDiperbarui(new Date(sekarang));
    } catch (err) {
      if (kunciRef.current !== kunci) {
        return;
      }
      const e = bentukGalat(err, 'Tidak dapat memuat data.');
      if (adaData.current && e.status === 0) {
        setOffline(true);
      } else {
        setGalat(e);
      }
    } finally {
      if (kunciRef.current === kunci) {
        setMemuat(false);
        setMenyegarkan(false);
      }
    }
  }, [setMemuat, setMenyegarkan, setData, setGalat, setOffline, setDiperbarui]);

  useEffect(() => {
    kunciRef.current = key;
    const entri = key !== null ? (cache.get(key) as Entri | undefined) : undefined;
    adaData.current = entri !== undefined;
    /* eslint-disable react-hooks/set-state-in-effect -- sinkron keadaan saat kunci berganti */
    setData((entri?.data as T | undefined) ?? null);
    setDiperbarui(entri ? new Date(entri.at) : null);
    setGalat(null);
    setOffline(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    void muat();
  }, [key, muat]);

  const ubah = useCallback((fn: (lama: T) => T): void => {
    setData((lama) => {
      if (lama === null) {
        return lama;
      }
      const baru = fn(lama);
      if (kunciRef.current !== null) {
        cache.set(kunciRef.current, { data: baru, at: Date.now() });
      }
      return baru;
    });
  }, [setData]);

  return { data, galat, memuat, menyegarkan, offline, diperbarui, muat, ubah };
}
