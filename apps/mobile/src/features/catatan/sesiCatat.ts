/**
 * Mode catat (notulensi berjalan): keadaan lokal per pengguna (padanan
 * `rk.notes.session.v1` web), tanpa endpoint. Disimpan di SecureStore supaya
 * pil "Kembali ke notulensi" bertahan setelah aplikasi dimatikan; satu-satunya
 * jalan keluar adalah "Selesai mencatat".
 */
import * as SecureStore from 'expo-secure-store';

import { createStore } from './store';

export interface SesiCatat {
  /** Catatan terakhir yang dibuka dalam dokumen sesi (tujuan tombol "Kembali"). */
  noteId: string;
  /** Dokumen induk (root tab) — semua tab dokumen ini termasuk sesi. */
  rootId: string;
  title: string;
  startedAt: number;
}

interface Keadaan {
  sesi: SesiCatat | null;
  userId: string | null;
  /** Editor milik dokumen sesi sedang terbuka (pil disembunyikan). */
  diDokumen: boolean;
}

export const sesiStore = createStore<Keadaan>({ sesi: null, userId: null, diDokumen: false });

const kunci = (userId: string): string => `rk.catatan.sesi.${userId}`;

function simpan(userId: string | null, sesi: SesiCatat | null): void {
  if (userId === null) {
    return;
  }
  if (sesi === null) {
    SecureStore.deleteItemAsync(kunci(userId)).catch(() => undefined);
    return;
  }
  SecureStore.setItemAsync(kunci(userId), JSON.stringify(sesi)).catch(() => undefined);
}

function valid(nilai: unknown): nilai is SesiCatat {
  if (typeof nilai !== 'object' || nilai === null) {
    return false;
  }
  const n = nilai as Record<string, unknown>;
  return typeof n.noteId === 'string' && typeof n.rootId === 'string' && typeof n.title === 'string' && typeof n.startedAt === 'number';
}

/** Dipanggil pil global saat pengguna berganti: muat sesi tersimpan milik pengguna itu. */
export async function ikatPengguna(userId: string | null): Promise<void> {
  if (sesiStore.get().userId === userId) {
    return;
  }
  sesiStore.set({ sesi: null, userId, diDokumen: false });
  if (userId === null) {
    return;
  }
  try {
    const mentah = await SecureStore.getItemAsync(kunci(userId));
    if (mentah !== null && sesiStore.get().userId === userId && sesiStore.get().sesi === null) {
      const nilai: unknown = JSON.parse(mentah);
      if (valid(nilai)) {
        sesiStore.set((lama) => ({ ...lama, sesi: nilai }));
      }
    }
  } catch {
    // Salinan rusak: abaikan, mode catat dianggap tidak berjalan.
  }
}

export function mulaiSesi(sesi: Omit<SesiCatat, 'startedAt'>): void {
  const baru: SesiCatat = { ...sesi, startedAt: Date.now() };
  sesiStore.set((lama) => ({ ...lama, sesi: baru }));
  simpan(sesiStore.get().userId, baru);
}

export function perbaruiSesi(ubah: Partial<Pick<SesiCatat, 'noteId' | 'title'>>): void {
  const lama = sesiStore.get().sesi;
  if (lama === null) {
    return;
  }
  const baru = { ...lama, ...ubah };
  if (baru.noteId === lama.noteId && baru.title === lama.title) {
    return;
  }
  sesiStore.set((s) => ({ ...s, sesi: baru }));
  simpan(sesiStore.get().userId, baru);
}

export function akhiriSesi(): void {
  sesiStore.set((lama) => ({ ...lama, sesi: null, diDokumen: false }));
  simpan(sesiStore.get().userId, null);
}

export function setDiDokumen(nilai: boolean): void {
  sesiStore.set((lama) => ({ ...lama, diDokumen: nilai }));
}
