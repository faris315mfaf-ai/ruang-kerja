/**
 * Ukuran huruf isi catatan (A−/A+): 90–160% langkah 10, diingat di perangkat
 * ini (padanan `rk.notes.scale.v1` web) — disimpan di SecureStore.
 */
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';

import { createStore } from './store';

const KUNCI = 'rk.catatan.skala';
export const SKALA_MIN = 90;
export const SKALA_MAX = 160;
export const SKALA_LANGKAH = 10;

const store = createStore<{ skala: number; dimuat: boolean }>({ skala: 100, dimuat: false });
let sedangMuat = false;

function jepit(nilai: number): number {
  const bulat = Math.round(nilai / SKALA_LANGKAH) * SKALA_LANGKAH;
  return Math.min(SKALA_MAX, Math.max(SKALA_MIN, bulat));
}

async function muatSekali(): Promise<void> {
  if (store.get().dimuat || sedangMuat) {
    return;
  }
  sedangMuat = true;
  try {
    const mentah = await SecureStore.getItemAsync(KUNCI);
    const angka = mentah === null ? NaN : Number(mentah);
    store.set({ skala: Number.isFinite(angka) ? jepit(angka) : 100, dimuat: true });
  } catch {
    store.set((lama) => ({ ...lama, dimuat: true }));
  } finally {
    sedangMuat = false;
  }
}

export function aturSkala(nilai: number): void {
  const baru = jepit(nilai);
  store.set({ skala: baru, dimuat: true });
  SecureStore.setItemAsync(KUNCI, String(baru)).catch(() => undefined);
}

export function useUkuranHuruf(): { skala: number; naik: () => void; turun: () => void; set: (nilai: number) => void } {
  const { skala } = store.use();
  useEffect(() => {
    void muatSekali();
  }, []);
  return {
    skala,
    naik: () => aturSkala(store.get().skala + SKALA_LANGKAH),
    turun: () => aturSkala(store.get().skala - SKALA_LANGKAH),
    set: aturSkala,
  };
}
