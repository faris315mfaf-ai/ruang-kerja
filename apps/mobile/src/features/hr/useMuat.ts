/**
 * Muat data baca modul HR dengan tarik-untuk-segarkan, penyegaran diam
 * (polling), dan cadangan offline DALAM MEMORI saja (tidak pernah ke disk:
 * data karyawan & absensi bersifat pribadi). Bila penyegaran gagal sementara
 * data sudah tampil, data dipertahankan dan `tertunda` menyala.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';

const simpanan = new Map<string, { data: unknown; pada: number }>();

function ambilSimpanan<T>(kunci: string | null): { data: T; pada: number } | null {
  if (kunci === null) return null;
  const c = simpanan.get(kunci);
  return c ? { data: c.data as T, pada: c.pada } : null;
}

function taruhSimpanan(kunci: string, data: unknown): void {
  simpanan.delete(kunci);
  simpanan.set(kunci, { data, pada: Date.now() });
  if (simpanan.size > 40) {
    const pertama = simpanan.keys().next().value;
    if (pertama !== undefined) simpanan.delete(pertama);
  }
}

/** Hapus seluruh cadangan (mis. setelah aksi yang mengubah data). */
export function lupakanSimpanan(awalan: string): void {
  for (const k of [...simpanan.keys()]) {
    if (k.startsWith(awalan)) simpanan.delete(k);
  }
}

export interface Galat {
  pesan: string;
  status: number;
  errors: Record<string, string[]>;
}

export function keGalat(err: unknown, cadangan = 'Tidak dapat memuat data.'): Galat {
  return err instanceof ApiError ? { pesan: err.message, status: err.status, errors: err.errors } : { pesan: cadangan, status: -1, errors: {} };
}

export type ModeMuat = 'awal' | 'tarik' | 'diam';

export interface Muat<T> {
  data: T | null;
  memuat: boolean;
  menyegarkan: boolean;
  galat: Galat | null;
  /** Waktu (ms) data cadangan yang tampil karena offline; null bila segar. */
  offlineSejak: number | null;
  /** Penyegaran terakhir gagal (data lama masih tampil). */
  tertunda: boolean;
  /** Waktu (ms) data terakhir berhasil dimuat. */
  diperbarui: number | null;
  muatUlang: (mode?: ModeMuat) => Promise<void>;
  setData: (ubah: (lama: T | null) => T | null) => void;
}

export function useMuat<T>(kunci: string | null, ambil: () => Promise<T>): Muat<T> {
  const awal = ambilSimpanan<T>(kunci);
  const [data, setDataState] = useState<T | null>(awal?.data ?? null);
  const [memuat, setMemuat] = useState(awal === null && kunci !== null);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [galat, setGalat] = useState<Galat | null>(null);
  const [offlineSejak, setOfflineSejak] = useState<number | null>(null);
  const [tertunda, setTertunda] = useState(false);
  const [diperbarui, setDiperbarui] = useState<number | null>(awal?.pada ?? null);
  const urut = useRef(0);
  const dataRef = useRef<T | null>(data);
  const ambilRef = useRef(ambil);
  useEffect(() => {
    ambilRef.current = ambil;
  }, [ambil]);

  const pasang = useCallback((d: T | null) => {
    dataRef.current = d;
    setDataState(d);
  }, []);

  const muatUlang = useCallback(
    async (mode: ModeMuat = 'awal'): Promise<void> => {
      if (kunci === null) return;
      const nomor = ++urut.current;
      const cadangan = ambilSimpanan<T>(kunci);
      if (mode === 'tarik') setMenyegarkan(true);
      if (mode === 'awal') {
        pasang(cadangan ? cadangan.data : null);
        setDiperbarui(cadangan ? cadangan.pada : null);
        setMemuat(cadangan === null);
        setGalat(null);
      }
      try {
        const d = await ambilRef.current();
        if (nomor !== urut.current) return;
        pasang(d);
        setGalat(null);
        setOfflineSejak(null);
        setTertunda(false);
        setDiperbarui(Date.now());
        taruhSimpanan(kunci, d);
      } catch (err) {
        if (nomor !== urut.current) return;
        const g = keGalat(err);
        const ada = dataRef.current !== null;
        if (g.status === 0 && (ada || cadangan)) {
          if (!ada && cadangan) pasang(cadangan.data);
          setOfflineSejak(cadangan?.pada ?? Date.now());
          setTertunda(true);
          setGalat(null);
        } else if (mode === 'diam' && ada && g.status !== 403 && g.status !== 404) {
          setTertunda(true);
        } else {
          setGalat(g);
          setTertunda(false);
          if (g.status !== 0) pasang(null);
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
    void muatUlang('awal');
  }, [muatUlang]);

  const setData = useCallback(
    (ubah: (lama: T | null) => T | null) => {
      const baru = ubah(dataRef.current);
      pasang(baru);
      if (kunci !== null && baru !== null) taruhSimpanan(kunci, baru);
    },
    [kunci, pasang],
  );

  return { data, memuat, menyegarkan, galat, offlineSejak, tertunda, diperbarui, muatUlang, setData };
}
