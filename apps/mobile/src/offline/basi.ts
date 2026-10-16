/**
 * Penanda "data basi": respons GET yang dijawab dari cache karena jaringan
 * gagal. Layar tidak perlu diubah — `Screen` menampilkan chip "Offline · data
 * per 09.12" otomatis lewat `useDataBasi()`; layar khusus boleh memakai hook
 * yang sama.
 *
 * Entri dihapus saat permintaan yang sama berhasil dari jaringan.
 */
import { useState } from 'react';

import { buatStore, useStore } from './store';

interface EntriBasi {
  /** Epoch ms data tersimpan (jam "data per …"). */
  ts: number;
  /** Epoch ms respons basi itu diberikan ke layar. */
  sejak: number;
}

const store = buatStore<ReadonlyMap<string, EntriBasi>>(new Map());

/** Dipanggil klien API saat memberikan salinan cache. */
export function catatBasi(kunci: string, ts: number): void {
  store.set((lama) => {
    const baru = new Map(lama);
    baru.set(kunci, { ts, sejak: Date.now() });
    return baru;
  });
}

/** Dipanggil klien API saat permintaan itu berhasil dari jaringan. */
export function bersihBasi(kunci: string): void {
  if (!store.get().has(kunci)) {
    return;
  }
  store.set((lama) => {
    const baru = new Map(lama);
    baru.delete(kunci);
    return baru;
  });
}

export function bersihSemuaBasi(): void {
  if (store.get().size > 0) {
    store.set(new Map());
  }
}

export interface InfoDataBasi {
  /** Ada data yang ditampilkan dari cache sejak komponen ini dipasang. */
  basi: boolean;
  /** Epoch ms data tertua yang basi. */
  ts: number | null;
}

const TIDAK_BASI: InfoDataBasi = { basi: false, ts: null };

/**
 * Hook: adakah respons dari cache yang diberikan SETELAH komponen ini dipasang
 * (± 1,5 dtk sebelumnya, untuk permintaan yang dimulai bersamaan dengan render
 * pertama)? Mengembalikan `ts` data tertua. Dipasang di `Screen` sehingga tiap
 * layar mendapatkannya tanpa perubahan.
 */
export function useDataBasi(): InfoDataBasi {
  const [dipasang] = useState(() => Date.now() - 1500);
  const ts = useStore(store, (m) => {
    let tertua: number | null = null;
    for (const e of m.values()) {
      if (e.sejak >= dipasang && (tertua === null || e.ts < tertua)) {
        tertua = e.ts;
      }
    }
    return tertua;
  });
  return ts === null ? TIDAK_BASI : { basi: true, ts };
}
