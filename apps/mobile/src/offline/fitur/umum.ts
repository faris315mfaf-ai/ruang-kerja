/** Pembantu bersama penangan offline tugas / catatan / laporan. */
import { ApiError } from '@/api/client';

import { adalahOnline } from '../jaringan';

export const PESAN_DISIMPAN_HP = 'Disimpan di HP · akan dikirim otomatis';

export type HasilTulis<T> = { antre: false; nilai: T } | { antre: true };

/**
 * Jalankan `fn` ke server bila online; hanya galat jaringan (ApiError status 0)
 * yang berubah jadi `null` (= "antrekan"). Galat server (4xx/5xx) dilempar ulang.
 */
export async function cobaOnline<T>(fn: () => Promise<T>): Promise<{ nilai: T } | null> {
  if (!adalahOnline()) {
    return null;
  }
  try {
    return { nilai: await fn() };
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      return null;
    }
    throw err;
  }
}

/** Tanggal kantor (Asia/Jakarta) sebuah instan, `YYYY-MM-DD`. */
export function tanggalKantor(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta' }).format(d);
}
