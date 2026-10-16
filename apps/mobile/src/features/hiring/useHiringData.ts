/**
 * Pemuat data Hiring. Data pelamar TIDAK pernah disimpan ke disk dan juga tidak
 * ke cache memori lintas layar: hanya state komponen yang sedang tampil
 * (hilang saat layar ditutup/keluar akun). Bila penyegaran gagal karena
 * jaringan sementara data sudah tampil, data dipertahankan dan `offlineSejak`
 * terisi (banner "Anda offline").
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';

export interface GalatMuat {
  pesan: string;
  status: number;
}

export type ModeMuat = 'awal' | 'tarik' | 'diam';

export interface HiringData<T> {
  data: T | null;
  memuat: boolean;
  menyegarkan: boolean;
  galat: GalatMuat | null;
  /** Waktu (ms) data terakhir berhasil dimuat, bila penyegaran terakhir gagal karena offline. */
  offlineSejak: number | null;
  muat: (mode?: ModeMuat) => Promise<void>;
  setData: (ubah: (lama: T | null) => T | null) => void;
}

export function useHiringData<T>(kunci: string | null, ambil: () => Promise<T>): HiringData<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [memuat, setMemuat] = useState(kunci !== null);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [galat, setGalat] = useState<GalatMuat | null>(null);
  const [offlineSejak, setOfflineSejak] = useState<number | null>(null);
  const urut = useRef(0);
  const dataRef = useRef<T | null>(null);
  const terakhir = useRef<number | null>(null);
  const ambilRef = useRef(ambil);
  useEffect(() => {
    ambilRef.current = ambil;
  }, [ambil]);

  const pasang = useCallback((d: T | null) => {
    dataRef.current = d;
    setDataState(d);
  }, []);

  const muat = useCallback(
    async (mode: ModeMuat = 'awal'): Promise<void> => {
      if (kunci === null) {
        return;
      }
      const nomor = ++urut.current;
      if (mode === 'tarik') {
        setMenyegarkan(true);
      }
      if (mode === 'awal') {
        setMemuat(dataRef.current === null);
        setGalat(null);
      }
      try {
        const d = await ambilRef.current();
        if (nomor !== urut.current) {
          return;
        }
        pasang(d);
        terakhir.current = Date.now();
        setGalat(null);
        setOfflineSejak(null);
      } catch (err) {
        if (nomor !== urut.current) {
          return;
        }
        const g: GalatMuat = err instanceof ApiError ? { pesan: err.message, status: err.status } : { pesan: 'Tidak dapat memuat data.', status: -1 };
        if (dataRef.current !== null && (g.status === 0 || (mode === 'diam' && g.status >= 500))) {
          setOfflineSejak(g.status === 0 ? (terakhir.current ?? Date.now()) : null);
        } else {
          setGalat(g);
          if (g.status !== 0) {
            pasang(null);
          }
        }
      } finally {
        if (nomor === urut.current) {
          setMemuat(false);
          setMenyegarkan(false);
        }
      }
    },
    [kunci, pasang],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat kunci berubah
    void muat('awal');
  }, [muat]);

  const setData = useCallback(
    (ubah: (lama: T | null) => T | null) => {
      pasang(ubah(dataRef.current));
    },
    [pasang],
  );

  return { data, memuat, menyegarkan, galat, offlineSejak, muat, setData };
}
