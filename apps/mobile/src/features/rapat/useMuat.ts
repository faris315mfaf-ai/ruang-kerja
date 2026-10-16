/**
 * Pemuat data layar rapat: status memuat/siap/galat/offline/mati (404 flag
 * `features.meetings`), cache memori untuk "data tersimpan" saat offline,
 * dan muat ulang saat layar kembali fokus.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';

import { bacaCache, simpanCache } from './util';

export type StatusMuat = 'memuat' | 'siap' | 'galat' | 'offline' | 'mati' | 'terlarang';

export interface HasilMuat<T> {
  data: T | null;
  status: StatusMuat;
  galat: ApiError | null;
  /** Data ditampilkan dari cache karena tanpa koneksi. */
  dariCache: number | null;
  menyegarkan: boolean;
  muat: (diam?: boolean) => Promise<void>;
  setData: (fn: (lama: T | null) => T | null) => void;
}

export function useMuat<T>(kunci: string | null, ambil: () => Promise<T>, opsi: { fokus?: boolean } = {}): HasilMuat<T> {
  const awal = kunci ? bacaCache<T>(kunci) : null;
  const [data, setDataMentah] = useState<T | null>(awal?.data ?? null);
  const [status, setStatus] = useState<StatusMuat>(awal ? 'siap' : 'memuat');
  const [galat, setGalat] = useState<ApiError | null>(null);
  const [dariCache, setDariCache] = useState<number | null>(null);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const ambilRef = useRef(ambil);
  useEffect(() => {
    ambilRef.current = ambil;
  });
  const adaData = useRef(awal !== null);
  const kunciRef = useRef(kunci);

  const muat = useCallback(async (diam = false): Promise<void> => {
    const k = kunciRef.current;
    if (!diam) {
      setMenyegarkan(adaData.current);
      if (!adaData.current) {
        setStatus('memuat');
      }
    }
    try {
      const hasil = await ambilRef.current();
      if (k !== kunciRef.current) {
        return;
      }
      setDataMentah(hasil);
      adaData.current = true;
      if (k) {
        simpanCache(k, hasil);
      }
      setStatus('siap');
      setGalat(null);
      setDariCache(null);
    } catch (err) {
      if (k !== kunciRef.current) {
        return;
      }
      const e = err instanceof ApiError ? err : new ApiError({ status: -1, message: 'Data tidak dapat dimuat.' });
      setGalat(e);
      if (e.status === 0) {
        const c = k ? bacaCache<T>(k) : null;
        if (c) {
          setDataMentah(c.data);
          adaData.current = true;
          setDariCache(c.saat);
          setStatus('siap');
        } else {
          setStatus(adaData.current ? 'siap' : 'offline');
          setDariCache(adaData.current ? Date.now() : null);
        }
      } else if (e.status === 404) {
        setStatus('mati');
      } else if (e.status === 403) {
        setStatus('terlarang');
      } else if (!adaData.current || !diam) {
        setStatus(adaData.current ? 'siap' : 'galat');
      }
    } finally {
      setMenyegarkan(false);
    }
  }, []);

  // Kunci berganti (tab/bulan/minggu lain): tampilkan cache kunci itu lalu muat.
  const kunciLama = useRef(kunci);
  useEffect(() => {
    if (kunciLama.current === kunci) {
      return;
    }
    kunciLama.current = kunci;
    kunciRef.current = kunci;
    ambilRef.current = ambil;
    const c = kunci ? bacaCache<T>(kunci) : null;
    adaData.current = c !== null;
    setDataMentah(c?.data ?? null);
    setStatus(c ? 'siap' : 'memuat');
    setDariCache(null);
    void muat();
  }, [kunci, muat, ambil]);

  const pertama = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (pertama.current || opsi.fokus !== false) {
        pertama.current = false;
        void muat();
      }
    }, [muat, opsi.fokus]),
  );

  const setData = useCallback((fn: (lama: T | null) => T | null) => {
    setDataMentah((lama) => {
      const baru = fn(lama);
      if (kunciRef.current && baru !== null) {
        simpanCache(kunciRef.current, baru);
      }
      return baru;
    });
  }, []);

  return { data, status, galat, dariCache, menyegarkan, muat, setData };
}
