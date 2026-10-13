/**
 * Data Inbox: daftar bertab + chip, paginasi `page`, pembaruan optimistis
 * (dibaca / belum dibaca / arsip / kembalikan) dengan rollback + snackbar,
 * antrean sederhana untuk aksi saat offline, dan salinan terakhir di memori.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  aksiInbox,
  aksiMassal,
  ambilInbox,
  bacaSemua as bacaSemuaApi,
  type AksiInbox,
  type EntriInbox,
  type HitungInbox,
  type JenisInbox,
  type TabInbox,
} from '@/api/inbox';
import { useUnread } from '@/session/UnreadProvider';
import { useSnackbar } from '@/ui';

import { jamKantor } from './waktu';

interface Salinan {
  items: EntriInbox[];
  page: number;
  lastPage: number;
  counts: HitungInbox;
  at: number;
}

const salinan = new Map<string, Salinan>();

type Status = 'memuat' | 'ok' | 'galat';

interface Keadaan {
  items: EntriInbox[];
  page: number;
  lastPage: number;
  counts: HitungInbox | null;
  status: Status;
  galat: string | null;
  galatStatus: number | null;
  /** Jam salinan terakhir yang ditampilkan saat offline. */
  offlineSejak: string | null;
}

const AWAL: Keadaan = { items: [], page: 1, lastPage: 1, counts: null, status: 'memuat', galat: null, galatStatus: null, offlineSejak: null };

function dalamArsip(item: EntriInbox): boolean {
  return item.archived_at !== null;
}

function sesuaikanHitung(counts: HitungInbox, items: EntriInbox[], aksi: AksiInbox): HitungInbox {
  const baru = { ...counts };
  for (const item of items) {
    const belum = item.read_at === null;
    switch (aksi) {
      case 'baca':
        if (belum && !dalamArsip(item)) baru.belum_dibaca -= 1;
        break;
      case 'belum-baca':
        if (!belum && !dalamArsip(item)) baru.belum_dibaca += 1;
        break;
      case 'arsip':
        if (!dalamArsip(item)) {
          baru.semua -= 1;
          baru.diarsipkan += 1;
          if (item.action_required) baru.perlu_tindakan -= 1;
          if (belum) baru.belum_dibaca -= 1;
        }
        break;
      case 'batal-arsip':
        if (dalamArsip(item)) {
          baru.semua += 1;
          baru.diarsipkan -= 1;
          if (item.action_required) baru.perlu_tindakan += 1;
        }
        break;
    }
  }
  return {
    semua: Math.max(0, baru.semua),
    perlu_tindakan: Math.max(0, baru.perlu_tindakan),
    diarsipkan: Math.max(0, baru.diarsipkan),
    belum_dibaca: Math.max(0, baru.belum_dibaca),
  };
}

const LABEL_GALAT: Record<AksiInbox, string> = {
  baca: 'Gagal menandai dibaca',
  'belum-baca': 'Gagal menandai belum dibaca',
  arsip: 'Gagal mengarsipkan notifikasi',
  'batal-arsip': 'Gagal mengembalikan notifikasi',
};

export interface UseInbox {
  tab: TabInbox;
  setTab: (tab: TabInbox) => void;
  belum: boolean;
  setBelum: (nilai: boolean) => void;
  jenis: JenisInbox | null;
  setJenis: (jenis: JenisInbox | null) => void;
  state: Keadaan;
  menyegarkan: boolean;
  memuatLagi: boolean;
  punyaBerikut: boolean;
  tertunda: number;
  muatUlang: () => Promise<void>;
  muatBerikut: () => Promise<void>;
  aksi: (items: EntriInbox[], aksi: AksiInbox) => Promise<boolean>;
  tandaiSemua: () => Promise<number | null>;
}

export function useInbox(): UseInbox {
  const { perbarui } = useUnread();
  const snackbar = useSnackbar();
  const [tab, setTabState] = useState<TabInbox>('semua');
  const [belum, setBelumState] = useState(false);
  const [jenis, setJenisState] = useState<JenisInbox | null>(null);
  const kunci = `${tab}|${belum ? 1 : 0}|${jenis ?? ''}`;

  const [state, setState] = useState<Keadaan>(() => {
    const s = salinan.get('semua|0|');
    return s ? { ...AWAL, items: s.items, page: s.page, lastPage: s.lastPage, counts: s.counts, status: 'ok' } : AWAL;
  });
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [tertunda, setTertunda] = useState(0);

  const permintaan = useRef(0);
  const stateRef = useRef(state);
  const kunciRef = useRef(kunci);
  const aksiRef = useRef<((target: EntriInbox[], jenisAksi: AksiInbox) => Promise<boolean>) | null>(null);
  const antrean = useRef<{ id: string; aksi: AksiInbox }[]>([]);

  useEffect(() => {
    stateRef.current = state;
    kunciRef.current = kunci;
  });

  const simpanSalinan = useCallback((k: string, s: Keadaan): void => {
    if (s.counts && s.status === 'ok') {
      salinan.set(k, { items: s.items, page: s.page, lastPage: s.lastPage, counts: s.counts, at: Date.now() });
    }
  }, []);

  const muat = useCallback(
    async (mode: 'awal' | 'segarkan' | 'senyap' | 'berikut'): Promise<void> => {
      const k = kunciRef.current;
      const id = ++permintaan.current;
      const halaman = mode === 'berikut' ? stateRef.current.page + 1 : 1;
      if (mode === 'awal') {
        const tersimpan = salinan.get(k);
        setState(tersimpan ? { ...AWAL, items: tersimpan.items, page: tersimpan.page, lastPage: tersimpan.lastPage, counts: tersimpan.counts, status: 'ok' } : { ...AWAL, counts: stateRef.current.counts });
      } else if (mode === 'segarkan') {
        setMenyegarkan(true);
      } else if (mode === 'berikut') {
        setMemuatLagi(true);
      }
      try {
        const [t, b, j] = k.split('|') as [TabInbox, string, string];
        const hasil = await ambilInbox({ tab: t, belumDibaca: b === '1', jenis: (j || null) as JenisInbox | null, page: halaman });
        if (id !== permintaan.current) {
          return;
        }
        perbarui(hasil.meta.counts.belum_dibaca);
        setState((lama) => {
          const daftar =
            mode === 'berikut'
              ? [...lama.items, ...hasil.items.filter((x) => !lama.items.some((y) => y.id === x.id))]
              : hasil.items;
          const baru: Keadaan = {
            items: daftar,
            page: halaman,
            lastPage: hasil.meta.last_page,
            counts: hasil.meta.counts,
            status: 'ok',
            galat: null,
            galatStatus: null,
            offlineSejak: null,
          };
          simpanSalinan(k, baru);
          return baru;
        });
      } catch (err) {
        if (id !== permintaan.current) {
          return;
        }
        const pesan = err instanceof ApiError ? err.message : 'Tidak dapat memuat inbox.';
        const kode = err instanceof ApiError ? err.status : null;
        setState((lama) => {
          const punyaIsi = lama.items.length > 0 && lama.status !== 'memuat';
          const tersimpan = salinan.get(k);
          if (punyaIsi || tersimpan) {
            return {
              ...lama,
              items: punyaIsi ? lama.items : (tersimpan?.items ?? []),
              counts: lama.counts ?? tersimpan?.counts ?? null,
              status: 'ok',
              galat: mode === 'berikut' || kode !== 0 ? pesan : null,
              galatStatus: kode,
              offlineSejak: kode === 0 ? jamKantor(new Date(tersimpan?.at ?? Date.now()).toISOString()) : null,
            };
          }
          return { ...lama, items: [], status: 'galat', galat: pesan, galatStatus: kode };
        });
      } finally {
        if (id === permintaan.current) {
          setMenyegarkan(false);
          setMemuatLagi(false);
        }
      }
    },
    [perbarui, simpanSalinan],
  );

  // Muat ulang saat tab/chip berubah.
  useEffect(() => {
    kunciRef.current = kunci;
    void muat('awal');
  }, [kunci, muat]);

  const kosongkanAntrean = useCallback(async (): Promise<void> => {
    while (antrean.current.length > 0) {
      const depan = antrean.current[0];
      if (!depan) break;
      try {
        await aksiInbox(depan.id, depan.aksi);
        antrean.current.shift();
      } catch (err) {
        if (err instanceof ApiError && err.status === 0) {
          break;
        }
        antrean.current.shift();
      }
    }
    setTertunda(antrean.current.length);
  }, []);

  const muatUlang = useCallback(async (): Promise<void> => {
    await kosongkanAntrean();
    await muat(stateRef.current.items.length > 0 ? 'segarkan' : 'awal');
  }, [kosongkanAntrean, muat]);

  const muatBerikut = useCallback(async (): Promise<void> => {
    const s = stateRef.current;
    if (s.status !== 'ok' || s.page >= s.lastPage) {
      return;
    }
    await muat('berikut');
  }, [muat]);

  const aksi = useCallback(
    async (target: EntriInbox[], jenisAksi: AksiInbox): Promise<boolean> => {
      if (target.length === 0) {
        return true;
      }
      const sebelum = stateRef.current;
      const ids = new Set(target.map((t) => t.id));
      const hapusDariDaftar = jenisAksi === 'arsip' || jenisAksi === 'batal-arsip' || (jenisAksi === 'baca' && belum);

      // Optimistis.
      const counts = sebelum.counts ? sesuaikanHitung(sebelum.counts, target, jenisAksi) : null;
      setState((lama) => ({
        ...lama,
        counts,
        items: hapusDariDaftar
          ? lama.items.filter((i) => !ids.has(i.id))
          : lama.items.map((i) =>
              ids.has(i.id) ? { ...i, read_at: jenisAksi === 'baca' ? new Date().toISOString() : jenisAksi === 'belum-baca' ? null : i.read_at } : i,
            ),
      }));
      if (counts) {
        perbarui(counts.belum_dibaca);
      }

      try {
        let hasilHitung: HitungInbox | undefined;
        if (target.length === 1 && target[0]) {
          hasilHitung = (await aksiInbox(target[0].id, jenisAksi)).counts;
        } else if (jenisAksi === 'batal-arsip') {
          const semua = await Promise.all(target.map((t) => aksiInbox(t.id, jenisAksi)));
          hasilHitung = semua[semua.length - 1]?.counts;
        } else {
          hasilHitung = (await aksiMassal(target.map((t) => t.id), jenisAksi)).counts;
        }
        if (hasilHitung) {
          const pasti = hasilHitung;
          perbarui(pasti.belum_dibaca);
          setState((lama) => ({ ...lama, counts: pasti }));
        }
        const jumlah = target.length;
        if (jenisAksi === 'arsip') {
          snackbar.show({
            message: jumlah > 1 ? `${jumlah} notifikasi diarsipkan` : 'Notifikasi diarsipkan',
            actionLabel: 'Urungkan',
            onAction: () => {
              void aksiRef.current?.(target, 'batal-arsip').then(() => muat('senyap'));
            },
          });
        } else if (jenisAksi === 'batal-arsip') {
          snackbar.show({ message: jumlah > 1 ? `${jumlah} notifikasi dikembalikan ke Inbox` : 'Dikembalikan ke Inbox', variant: 'ok' });
        }
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 0) {
          // Offline: biarkan hasil optimistis, kirim ulang saat tersambung.
          for (const t of target) {
            antrean.current.push({ id: t.id, aksi: jenisAksi });
          }
          setTertunda(antrean.current.length);
          snackbar.show({ message: 'Offline — perubahan akan dikirim saat tersambung', variant: 'offline' });
          return true;
        }
        // Rollback.
        setState((lama) => ({ ...lama, items: sebelum.items, counts: sebelum.counts }));
        if (sebelum.counts) {
          perbarui(sebelum.counts.belum_dibaca);
        }
        snackbar.show({
          message: err instanceof ApiError && err.status !== 422 ? `${LABEL_GALAT[jenisAksi]}. ${err.message}` : LABEL_GALAT[jenisAksi],
          variant: 'bad',
          actionLabel: 'Ulangi',
          onAction: () => {
            void aksiRef.current?.(target, jenisAksi);
          },
        });
        return false;
      }
    },
    [belum, muat, perbarui, snackbar],
  );

  useEffect(() => {
    aksiRef.current = aksi;
  }, [aksi]);

  const tandaiSemua = useCallback(async (): Promise<number | null> => {
    try {
      const hasil = await bacaSemuaApi();
      perbarui(hasil.unread);
      await muat('senyap');
      return hasil.marked;
    } catch (err) {
      snackbar.show({
        message: err instanceof ApiError && err.status === 0 ? 'Tidak ada koneksi. Coba lagi saat tersambung.' : 'Gagal menandai semua dibaca',
        variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad',
      });
      return null;
    }
  }, [muat, perbarui, snackbar]);

  const punyaBerikut = state.status === 'ok' && state.page < state.lastPage;

  return useMemo(
    () => ({
      tab,
      setTab: setTabState,
      belum,
      setBelum: setBelumState,
      jenis,
      setJenis: setJenisState,
      state,
      menyegarkan,
      memuatLagi,
      punyaBerikut,
      tertunda,
      muatUlang,
      muatBerikut,
      aksi,
      tandaiSemua,
    }),
    [tab, belum, jenis, state, menyegarkan, memuatLagi, punyaBerikut, tertunda, muatUlang, muatBerikut, aksi, tandaiSemua],
  );
}
