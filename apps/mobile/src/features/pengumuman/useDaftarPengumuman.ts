/** Daftar Pengumuman per tab dengan paginasi `page` dan hapus optimistis. */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import { daftarPengumuman, hapusPengumuman, type ItemPengumuman, type TabPengumuman } from '@/api/pengumuman';

interface Keadaan {
  items: ItemPengumuman[];
  page: number;
  lastPage: number;
  status: 'memuat' | 'ok' | 'galat';
  galat: string | null;
  galatStatus: number | null;
}

const AWAL: Keadaan = { items: [], page: 1, lastPage: 1, status: 'memuat', galat: null, galatStatus: null };

export function useDaftarPengumuman(tab: TabPengumuman): {
  state: Keadaan;
  bolehBuat: boolean;
  menyegarkan: boolean;
  memuatLagi: boolean;
  muatUlang: (senyap?: boolean) => Promise<void>;
  muatBerikut: () => Promise<void>;
  hapus: (id: string) => Promise<void>;
} {
  const [state, setState] = useState<Keadaan>(AWAL);
  const [bolehBuat, setBolehBuat] = useState(false);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const permintaan = useRef(0);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  });

  const muat = useCallback(
    async (mode: 'awal' | 'segarkan' | 'senyap' | 'berikut'): Promise<void> => {
      const id = ++permintaan.current;
      const halaman = mode === 'berikut' ? stateRef.current.page + 1 : 1;
      if (mode === 'awal') {
        setState(AWAL);
      } else if (mode === 'segarkan') {
        setMenyegarkan(true);
      } else if (mode === 'berikut') {
        setMemuatLagi(true);
      }
      try {
        const hasil = await daftarPengumuman(tab, halaman);
        if (id !== permintaan.current) {
          return;
        }
        setBolehBuat(hasil.can_create);
        setState((lama) => ({
          items: mode === 'berikut' ? [...lama.items, ...hasil.items.filter((x) => !lama.items.some((y) => y.id === x.id))] : hasil.items,
          page: halaman,
          lastPage: hasil.meta.last_page,
          status: 'ok',
          galat: null,
          galatStatus: null,
        }));
      } catch (err) {
        if (id !== permintaan.current) {
          return;
        }
        const pesan = err instanceof ApiError ? err.message : 'Tidak dapat memuat pengumuman.';
        const kode = err instanceof ApiError ? err.status : null;
        setState((lama) => (lama.items.length > 0 ? { ...lama, status: 'ok', galat: pesan, galatStatus: kode } : { ...lama, status: 'galat', galat: pesan, galatStatus: kode }));
      } finally {
        if (id === permintaan.current) {
          setMenyegarkan(false);
          setMemuatLagi(false);
        }
      }
    },
    [tab],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat tab berganti
    void muat('awal');
  }, [muat]);

  const muatUlang = useCallback((senyap = false) => muat(senyap ? 'senyap' : 'segarkan'), [muat]);
  const muatBerikut = useCallback(async () => {
    const s = stateRef.current;
    if (s.status === 'ok' && s.page < s.lastPage) {
      await muat('berikut');
    }
  }, [muat]);

  const hapus = useCallback(async (id: string): Promise<void> => {
    await hapusPengumuman(id);
    setState((lama) => ({ ...lama, items: lama.items.filter((i) => i.id !== id) }));
  }, []);

  return { state, bolehBuat, menyegarkan, memuatLagi, muatUlang, muatBerikut, hapus };
}
