/**
 * Setelan per widget (segmen, tampilkan selesai, latar transparan) dan salinan data
 * terakhir yang berhasil dimuat widget ("data lama"). Disimpan di tabel `meta` basis
 * data terenkripsi aplikasi (`src/offline/db.ts`) — BUKAN SecureStore, dan token tidak
 * pernah disalin ke mana pun. Keluar akun menghapus seluruh `meta` (`kosongkanSemua`),
 * jadi setelan dan salinan ikut hilang.
 */
import { denganDb } from '@/offline/db';

import { SETELAN_BAWAAN, normalisasiSetelan, type SetelanTugas } from './keadaan';

const kunciSetelan = (widgetId: number): string => `widget_setelan:${widgetId}`;
const kunciSnap = (uid: string, nama: string): string => `widget_snap:${uid}:${nama}`;

export async function bacaSetelan(widgetId: number): Promise<SetelanTugas> {
  try {
    const baris = await denganDb((db) => db.getFirstAsync<{ v: string }>('SELECT v FROM meta WHERE k = ?', kunciSetelan(widgetId)));
    return baris ? normalisasiSetelan(JSON.parse(baris.v)) : SETELAN_BAWAAN;
  } catch {
    return SETELAN_BAWAAN;
  }
}

export async function simpanSetelan(widgetId: number, setelan: SetelanTugas): Promise<void> {
  await denganDb((db) => db.runAsync('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', kunciSetelan(widgetId), JSON.stringify(setelan)));
}

export async function hapusSetelan(widgetId: number): Promise<void> {
  try {
    await denganDb((db) => db.runAsync('DELETE FROM meta WHERE k = ?', kunciSetelan(widgetId)));
  } catch {
    // Widget sudah dihapus: setelan yatim tak berbahaya.
  }
}

export interface Snap<T> {
  data: T;
  /** Epoch ms data dimuat dari server. */
  ts: number;
}

/** Salinan terakhir yang berhasil dimuat (null bila belum ada / rusak). */
export async function bacaSnap<T>(uid: string, nama: string): Promise<Snap<T> | null> {
  try {
    const baris = await denganDb((db) => db.getFirstAsync<{ v: string }>('SELECT v FROM meta WHERE k = ?', kunciSnap(uid, nama)));
    if (!baris) {
      return null;
    }
    const nilai = JSON.parse(baris.v) as { ts?: unknown; data?: unknown };
    return typeof nilai.ts === 'number' && nilai.data !== undefined ? { data: nilai.data as T, ts: nilai.ts } : null;
  } catch {
    return null;
  }
}

export async function simpanSnap(uid: string, nama: string, data: unknown, ts: number): Promise<void> {
  try {
    await denganDb((db) => db.runAsync('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', kunciSnap(uid, nama), JSON.stringify({ ts, data })));
  } catch {
    // Salinan hanya akselerator tampilan "data lama".
  }
}
