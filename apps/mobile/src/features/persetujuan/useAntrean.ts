/**
 * Antrean Persetujuan per tab (`GET /persetujuan/daftar`) dengan paginasi,
 * tembolok memori (dibaca saat offline: "Daftar terakhir dimuat 09.14") dan
 * penanda offline yang mematikan semua aksi tulis (spec 04 D15).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import { daftarPersetujuan, type HalamanPersetujuan, type ItemAntrean, type TabPersetujuan } from '@/api/persetujuan';

interface Tembolok {
  halaman: HalamanPersetujuan;
  items: ItemAntrean[];
  dimuat: number;
}

/** Tembolok per tab, bertahan selama aplikasi hidup (bukan disimpan ke disk). */
const tembolok = new Map<string, Tembolok>();

/** Hapus tembolok (mis. setelah keluar akun: dipanggil saat pengguna berganti). */
export function bersihkanTembolokPersetujuan(): void {
  tembolok.clear();
}

export interface KeadaanAntrean {
  status: 'memuat' | 'ok' | 'galat';
  halaman: HalamanPersetujuan | null;
  items: ItemAntrean[];
  page: number;
  lastPage: number;
  galat: string | null;
  galatStatus: number | null;
  /** Permintaan terakhir gagal karena jaringan; daftar dari tembolok. */
  offline: boolean;
  /** Waktu (ms) daftar terakhir berhasil dimuat. */
  dimuat: number | null;
}

function awal(kunci: string): KeadaanAntrean {
  const t = tembolok.get(kunci);
  return t
    ? { status: 'ok', halaman: t.halaman, items: t.items, page: t.halaman.meta.current_page, lastPage: t.halaman.meta.last_page, galat: null, galatStatus: null, offline: false, dimuat: t.dimuat }
    : { status: 'memuat', halaman: null, items: [], page: 1, lastPage: 1, galat: null, galatStatus: null, offline: false, dimuat: null };
}

/** `pemilik` = id pengguna: tembolok tidak pernah bocor ke akun lain di perangkat yang sama. */
export function useAntrean(tab: TabPersetujuan, pemilik: string): {
  state: KeadaanAntrean;
  menyegarkan: boolean;
  memuatLagi: boolean;
  muatUlang: (senyap?: boolean) => Promise<void>;
  muatBerikut: () => Promise<void>;
  /** Ubah daftar lokal (keluarkan/kembalikan kartu) tanpa ke server. */
  ubahItems: (fn: (lama: ItemAntrean[]) => ItemAntrean[]) => void;
  /** Ganti hitungan "menunggu" dari respons keputusan. */
  aturMenunggu: (n: number) => void;
} {
  const kunci = `${pemilik}:${tab}`;
  const [state, setState] = useState<KeadaanAntrean>(() => awal(kunci));
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const nomor = useRef(0);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  });

  const simpanTembolok = useCallback(
    (s: KeadaanAntrean): void => {
      if (s.halaman) {
        tembolok.set(kunci, { halaman: s.halaman, items: s.items, dimuat: s.dimuat ?? Date.now() });
      }
    },
    [kunci],
  );

  const muat = useCallback(
    async (mode: 'awal' | 'segarkan' | 'senyap' | 'berikut'): Promise<void> => {
      const id = ++nomor.current;
      const hal = mode === 'berikut' ? stateRef.current.page + 1 : 1;
      if (mode === 'awal') {
        setState(awal(kunci));
      } else if (mode === 'segarkan') {
        setMenyegarkan(true);
      } else if (mode === 'berikut') {
        setMemuatLagi(true);
      }
      try {
        const hasil = await daftarPersetujuan(tab, hal);
        if (id !== nomor.current) {
          return;
        }
        setState((lama) => {
          const items = mode === 'berikut' ? [...lama.items, ...hasil.items.filter((x) => !lama.items.some((y) => y.id === x.id))] : hasil.items;
          const baru: KeadaanAntrean = {
            status: 'ok',
            halaman: hasil,
            items,
            page: hal,
            lastPage: hasil.meta.last_page,
            galat: null,
            galatStatus: null,
            offline: false,
            dimuat: Date.now(),
          };
          simpanTembolok(baru);
          return baru;
        });
      } catch (err) {
        if (id !== nomor.current) {
          return;
        }
        const pesan = err instanceof ApiError ? err.message : 'Tidak dapat memuat persetujuan.';
        const kode = err instanceof ApiError ? err.status : null;
        setState((lama) =>
          lama.halaman !== null
            ? { ...lama, status: 'ok', galat: kode === 0 ? null : pesan, galatStatus: kode, offline: kode === 0 }
            : { ...lama, status: 'galat', galat: pesan, galatStatus: kode, offline: kode === 0 },
        );
      } finally {
        if (id === nomor.current) {
          setMenyegarkan(false);
          setMemuatLagi(false);
        }
      }
    },
    [tab, kunci, simpanTembolok],
  );

  useEffect(() => {
    const ada = tembolok.has(kunci);
    if (ada) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tampilkan tembolok tab ini lebih dulu
      setState(awal(kunci));
    }
    void muat(ada ? 'senyap' : 'awal');
  }, [kunci, muat]);

  const muatUlang = useCallback((senyap = false) => muat(senyap ? 'senyap' : 'segarkan'), [muat]);
  const muatBerikut = useCallback(async () => {
    const s = stateRef.current;
    if (s.status === 'ok' && !s.offline && s.page < s.lastPage) {
      await muat('berikut');
    }
  }, [muat]);

  const ubahItems = useCallback(
    (fn: (lama: ItemAntrean[]) => ItemAntrean[]): void => {
      setState((lama) => {
        const baru = { ...lama, items: fn(lama.items) };
        simpanTembolok(baru);
        return baru;
      });
    },
    [simpanTembolok],
  );

  const aturMenunggu = useCallback(
    (n: number): void => {
      setState((lama) => {
        if (!lama.halaman) {
          return lama;
        }
        const baru = { ...lama, halaman: { ...lama.halaman, counts: { ...lama.halaman.counts, menunggu: n } } };
        simpanTembolok(baru);
        return baru;
      });
    },
    [simpanTembolok],
  );

  return { state, menyegarkan, memuatLagi, muatUlang, muatBerikut, ubahItems, aturMenunggu };
}
