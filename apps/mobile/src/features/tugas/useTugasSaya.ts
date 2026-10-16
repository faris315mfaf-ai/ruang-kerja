/**
 * Data "Tugas saya": satu hook untuk lingkup, filter, pengelompokan,
 * paginasi ("Muat lagi"), muat ulang senyap saat layar kembali fokus, dan
 * mode "Rencana saya". Respons lambat untuk parameter lama diabaikan
 * (id permintaan).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import { daftarTugasSaya, rencanaSaya, type BarisTugas, type HalamanTugasSaya, type LingkupTugas, type Perencana } from '@/api/tugas';

import { FILTER_KOSONG, jumlahFilter, keParam, type FilterTugas, type KelompokPer } from './filter';
import { pesanGalat } from './util';

export interface GalatMuat {
  pesan: string;
  status: number;
}

type MetaTugas = HalamanTugasSaya['meta'];

interface Cache {
  tasks: BarisTugas[];
  meta: MetaTugas;
  waktu: Date;
}

const cacheModul = new Map<string, Cache>();

export function useTugasSaya(): {
  lingkup: LingkupTugas;
  setLingkup: (l: LingkupTugas) => void;
  filter: FilterTugas;
  setFilter: (f: FilterTugas) => void;
  kelompok: KelompokPer;
  setKelompok: (k: KelompokPer) => void;
  tampilSelesai: boolean;
  setTampilSelesai: (v: boolean) => void;
  mode: 'daftar' | 'rencana';
  setMode: (m: 'daftar' | 'rencana') => void;
  tasks: BarisTugas[];
  meta: MetaTugas | null;
  perencana: Perencana | null;
  memuat: boolean;
  memuatLagi: boolean;
  menyegarkan: boolean;
  galat: GalatMuat | null;
  basi: Date | null;
  masihAda: boolean;
  chipWorkspace: { key: string; jumlah: number }[];
  muatLagi: () => void;
  segarkan: () => void;
  segarkanSenyap: () => void;
  ubahLokal: (id: string, fn: (b: BarisTugas) => BarisTugas | null) => void;
  setPerencana: (p: Perencana) => void;
  aktifFilter: number;
} {
  const [lingkup, setLingkupState] = useState<LingkupTugas>('ditugaskan');
  const [filter, setFilterState] = useState<FilterTugas>(FILTER_KOSONG);
  const [kelompok, setKelompok] = useState<KelompokPer>('tenggat');
  const [tampilSelesai, setTampilSelesai] = useState(false);
  const [mode, setMode] = useState<'daftar' | 'rencana'>('daftar');
  const [tasks, setTasks] = useState<BarisTugas[]>([]);
  const [meta, setMeta] = useState<MetaTugas | null>(null);
  const [perencana, setPerencana] = useState<Perencana | null>(null);
  const [halaman, setHalaman] = useState(1);
  const [memuat, setMemuat] = useState(true);
  const [memuatLagiState, setMemuatLagiState] = useState(false);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [galat, setGalat] = useState<GalatMuat | null>(null);
  const [basi, setBasi] = useState<Date | null>(null);
  const [chipWs, setChipWs] = useState<{ key: string; jumlah: number }[]>([]);
  const permintaan = useRef(0);
  const sudahMuat = useRef(false);

  const urut = kelompok === 'prioritas' ? 'prioritas' : kelompok === 'workspace' ? 'workspace' : 'tenggat';

  const kunciCache = useMemo(() => JSON.stringify([lingkup, filter, urut, tampilSelesai]), [lingkup, filter, urut, tampilSelesai]);

  const ambil = useCallback(
    async (halamanBaru: number, jenis: 'awal' | 'tambah' | 'senyap' | 'tarik'): Promise<void> => {
      const id = ++permintaan.current;
      if (jenis === 'tambah') {
        setMemuatLagiState(true);
      } else if (jenis === 'awal') {
        setMemuat(true);
      } else if (jenis === 'tarik') {
        setMenyegarkan(true);
      }
      if (jenis !== 'senyap') {
        setGalat(null);
      }
      try {
        const hasil = await daftarTugasSaya({
          scope: lingkup,
          ...keParam(filter),
          urut,
          selesai: tampilSelesai ? 'minggu-ini' : 'tidak',
          page: halamanBaru,
        });
        if (id !== permintaan.current) {
          return;
        }
        setHalaman(halamanBaru);
        setMeta(hasil.meta);
        setBasi(null);
        setGalat(null);
        setTasks((lama) => {
          if (jenis !== 'tambah') {
            return hasil.tasks;
          }
          const sudah = new Set(lama.map((t) => t.id));
          return [...lama, ...hasil.tasks.filter((t) => !sudah.has(t.id))];
        });
        if (jenis !== 'tambah') {
          cacheModul.set(kunciCache, { tasks: hasil.tasks, meta: hasil.meta, waktu: new Date() });
        }
        if (jumlahFilter({ ...filter, workspace: [] }) === 0 && filter.workspace.length === 0 && jenis !== 'tambah') {
          const hitung = new Map<string, number>();
          for (const t of hasil.tasks) {
            hitung.set(t.workspace.key, (hitung.get(t.workspace.key) ?? 0) + 1);
          }
          setChipWs([...hitung.entries()].map(([key, jumlah]) => ({ key, jumlah })));
        }
        sudahMuat.current = true;
      } catch (err) {
        if (id !== permintaan.current) {
          return;
        }
        const status = err instanceof ApiError ? err.status : -1;
        const cache = cacheModul.get(kunciCache);
        if (status === 0 && cache && jenis !== 'tambah') {
          setTasks(cache.tasks);
          setMeta(cache.meta);
          setBasi(cache.waktu);
          setGalat(null);
        } else if (jenis !== 'senyap') {
          setGalat({ pesan: pesanGalat(err, 'Tidak dapat memuat tugas.'), status });
          if (jenis === 'awal') {
            setTasks([]);
          }
        }
      } finally {
        if (id === permintaan.current) {
          setMemuat(false);
          setMemuatLagiState(false);
          setMenyegarkan(false);
        }
      }
    },
    [lingkup, filter, urut, tampilSelesai, kunciCache],
  );

  const ambilRencana = useCallback(async (jenis: 'awal' | 'tarik' | 'senyap'): Promise<void> => {
    const id = ++permintaan.current;
    if (jenis === 'awal') {
      setMemuat(true);
    } else if (jenis === 'tarik') {
      setMenyegarkan(true);
    }
    if (jenis !== 'senyap') {
      setGalat(null);
    }
    try {
      const hasil = await rencanaSaya();
      if (id !== permintaan.current) {
        return;
      }
      setPerencana(hasil);
      setGalat(null);
    } catch (err) {
      if (id !== permintaan.current) {
        return;
      }
      if (jenis !== 'senyap') {
        setGalat({ pesan: pesanGalat(err, 'Tidak dapat memuat rencana.'), status: err instanceof ApiError ? err.status : -1 });
      }
    } finally {
      if (id === permintaan.current) {
        setMemuat(false);
        setMenyegarkan(false);
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat parameter berubah
    void (mode === 'rencana' ? ambilRencana('awal') : ambil(1, 'awal'));
  }, [mode, ambil, ambilRencana]);

  const setLingkup = useCallback((l: LingkupTugas): void => {
    setChipWs([]);
    setLingkupState(l);
  }, []);

  const setFilter = useCallback((f: FilterTugas): void => {
    setFilterState(f);
  }, []);

  const segarkan = useCallback((): void => {
    void (mode === 'rencana' ? ambilRencana('tarik') : ambil(1, 'tarik'));
  }, [mode, ambil, ambilRencana]);

  const muatLagi = useCallback((): void => {
    void ambil(halaman + 1, 'tambah');
  }, [ambil, halaman]);

  /** Muat ulang senyap — dipanggil layar saat kembali fokus (setelah detail). */
  const segarkanSenyapRef = useRef<() => void>(() => undefined);
  const segarkanSenyap = useCallback((): void => segarkanSenyapRef.current(), []);
  useEffect(() => {
    segarkanSenyapRef.current = () => {
      if (!sudahMuat.current) {
        return;
      }
      void (mode === 'rencana' ? ambilRencana('senyap') : ambil(1, 'senyap'));
    };
  }, [mode, ambil, ambilRencana]);

  const ubahLokal = useCallback((id: string, fn: (b: BarisTugas) => BarisTugas | null): void => {
    setTasks((lama) =>
      lama.flatMap((t) => {
        if (t.id !== id) {
          return [t];
        }
        const baru = fn(t);
        return baru ? [baru] : [];
      }),
    );
  }, []);

  return {
    lingkup,
    setLingkup,
    filter,
    setFilter,
    kelompok,
    setKelompok,
    tampilSelesai,
    setTampilSelesai,
    mode,
    setMode,
    tasks,
    meta,
    perencana,
    memuat,
    memuatLagi: memuatLagiState,
    menyegarkan,
    galat,
    basi,
    masihAda: meta !== null && halaman < meta.last_page,
    chipWorkspace: chipWs,
    muatLagi,
    segarkan,
    ubahLokal,
    setPerencana,
    aktifFilter: jumlahFilter(filter),
    segarkanSenyap,
  };
}
