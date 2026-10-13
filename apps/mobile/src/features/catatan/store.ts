/**
 * Penyimpan keadaan modul kecil (tanpa pustaka): satu nilai, langganan
 * `useSyncExternalStore`. Dipakai sesi mode catat, ukuran huruf, dan sesi
 * simpan catatan agar pil global bisa membacanya di layar mana pun.
 */
import { useSyncExternalStore } from 'react';

export interface Store<T> {
  get: () => T;
  set: (berikut: T | ((lama: T) => T)) => void;
  subscribe: (fn: () => void) => () => void;
  use: () => T;
}

export function createStore<T>(awal: T): Store<T> {
  let nilai = awal;
  const pelanggan = new Set<() => void>();
  const get = (): T => nilai;
  const subscribe = (fn: () => void): (() => void) => {
    pelanggan.add(fn);
    return () => {
      pelanggan.delete(fn);
    };
  };
  const set = (berikut: T | ((lama: T) => T)): void => {
    const baru = typeof berikut === 'function' ? (berikut as (lama: T) => T)(nilai) : berikut;
    if (Object.is(baru, nilai)) {
      return;
    }
    nilai = baru;
    pelanggan.forEach((fn) => fn());
  };
  return { get, set, subscribe, use: () => useSyncExternalStore(subscribe, get, get) };
}
