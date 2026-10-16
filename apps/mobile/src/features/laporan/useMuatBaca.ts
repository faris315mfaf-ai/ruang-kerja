/**
 * Muat data baca (riwayat, laporan tim, detail) dengan tarik-untuk-segarkan
 * dan cadangan offline: bila gagal karena koneksi dan ada data sebelumnya,
 * data itu tetap tampil dengan penanda "offline".
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';

import { ambilCache, taruhCache } from './cache';

export interface MuatBaca<T> {
  data: T | null;
  memuat: boolean;
  menyegarkan: boolean;
  galat: { pesan: string; status: number; kode: string | null } | null;
  /** Waktu (ms) data cadangan yang ditampilkan saat offline; null bila data segar. */
  offlineSejak: number | null;
  muatUlang: (segarkan?: boolean) => Promise<void>;
}

export function useMuatBaca<T>(kunci: string | null, ambil: () => Promise<T>): MuatBaca<T> {
  const awal = kunci ? ambilCache<T>(kunci) : null;
  const [data, setData] = useState<T | null>(awal?.data ?? null);
  const [memuat, setMemuat] = useState(awal === null);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [galat, setGalat] = useState<MuatBaca<T>['galat']>(null);
  const [offlineSejak, setOfflineSejak] = useState<number | null>(null);
  const urut = useRef(0);
  const ambilRef = useRef(ambil);
  useEffect(() => {
    ambilRef.current = ambil;
  }, [ambil]);

  const muatUlang = useCallback(
    async (segarkan = false): Promise<void> => {
      const nomor = ++urut.current;
      const cache = kunci ? ambilCache<T>(kunci) : null;
      if (segarkan) setMenyegarkan(true);
      else if (!cache) setMemuat(true);
      if (!segarkan) setData(cache ? cache.data : null);
      try {
        const d = await ambilRef.current();
        if (nomor !== urut.current) return;
        setData(d);
        setGalat(null);
        setOfflineSejak(null);
        if (kunci) taruhCache(kunci, d);
      } catch (err) {
        if (nomor !== urut.current) return;
        const e = { pesan: err instanceof ApiError ? err.message : 'Tidak dapat memuat data.', status: err instanceof ApiError ? err.status : 0, kode: err instanceof ApiError ? err.code : null };
        if (e.status === 0 && cache) {
          setData(cache.data);
          setOfflineSejak(cache.pada);
          setGalat(null);
        } else {
          setGalat(e);
          if (e.status !== 0) setData(null);
        }
      } finally {
        if (nomor === urut.current) {
          setMemuat(false);
          setMenyegarkan(false);
        }
      }
    },
    [kunci],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat kunci berubah
    void muatUlang();
  }, [muatUlang]);

  return { data, memuat, menyegarkan, galat, offlineSejak, muatUlang };
}
