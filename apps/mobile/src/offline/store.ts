/**
 * Store kecil berbasis `useSyncExternalStore` untuk modul offline. Pembaca
 * memilih potongan state lewat selector sehingga komponen hanya dirender ulang
 * saat potongan itu berubah (tanpa Context yang merender ulang seluruh pohon).
 *
 * Aturan selector: kembalikan nilai primitif atau referensi yang stabil
 * (mis. `s => s.items`); jangan membuat objek/array baru di dalam selector.
 */
import { useSyncExternalStore } from 'react';

export interface Store<T> {
  get: () => T;
  /** Ganti state (objek baru) atau perbarui dari state lama. Pendengar dipanggil hanya bila referensinya berubah. */
  set: (berikut: T | ((lama: T) => T)) => void;
  subscribe: (pendengar: () => void) => () => void;
}

export function buatStore<T>(awal: T): Store<T> {
  let nilai = awal;
  const pendengar = new Set<() => void>();
  return {
    get: () => nilai,
    set: (berikut) => {
      const baru = typeof berikut === 'function' ? (berikut as (lama: T) => T)(nilai) : berikut;
      if (Object.is(baru, nilai)) {
        return;
      }
      nilai = baru;
      pendengar.forEach((p) => p());
    },
    subscribe: (p) => {
      pendengar.add(p);
      return () => {
        pendengar.delete(p);
      };
    },
  };
}

export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get()),
  );
}
