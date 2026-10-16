/**
 * Penyimpanan lokal kecil (SecureStore, tanpa paket baru) untuk Beranda:
 * tampilan dashboard terakhir per perangkat dan draf notulensi briefing.
 * Semua pembungkus aman: kegagalan penyimpanan tidak pernah mengganggu layar.
 */
import * as SecureStore from 'expo-secure-store';

import type { KunciTampilan, PeriodeBriefing } from '@/api/beranda';

const KUNCI_TAMPILAN = 'rk.beranda.tampilan.v1';
const DAFTAR_TAMPILAN: readonly KunciTampilan[] = ['saya', 'divisi', 'hr', 'direksi'];

/** Tampilan dashboard yang terakhir dibuka di perangkat ini (null bila belum ada). */
export async function bacaTampilanTerakhir(): Promise<KunciTampilan | null> {
  try {
    const nilai = await SecureStore.getItemAsync(KUNCI_TAMPILAN);
    return DAFTAR_TAMPILAN.find((k) => k === nilai) ?? null;
  } catch {
    return null;
  }
}

export async function simpanTampilanTerakhir(tampilan: KunciTampilan): Promise<void> {
  try {
    await SecureStore.setItemAsync(KUNCI_TAMPILAN, tampilan);
  } catch {
    // Diabaikan: hanya kenyamanan.
  }
}

// ── Draf briefing ────────────────────────────────────────────────────────────
// SecureStore menyarankan nilai ≤ 2 KB; notulensi bisa 10.000 karakter, jadi
// teks dipecah per 1.500 karakter: `<kunci>.n` = jumlah potongan.

const POTONG = 1500;

function kunciDraf(userId: string, tanggal: string, periode: PeriodeBriefing): string {
  // SecureStore hanya menerima [A-Za-z0-9._-].
  return `rk.briefing-draft.v1.${userId}.${tanggal}.${periode}`;
}

export async function bacaDrafBriefing(userId: string, tanggal: string, periode: PeriodeBriefing): Promise<string | null> {
  const dasar = kunciDraf(userId, tanggal, periode);
  try {
    const n = Number(await SecureStore.getItemAsync(`${dasar}.n`));
    if (!Number.isInteger(n) || n <= 0 || n > 10) {
      return null;
    }
    let teks = '';
    for (let i = 0; i < n; i += 1) {
      const bagian = await SecureStore.getItemAsync(`${dasar}.${i}`);
      if (bagian === null) {
        return null;
      }
      teks += bagian;
    }
    return teks;
  } catch {
    return null;
  }
}

export async function simpanDrafBriefing(userId: string, tanggal: string, periode: PeriodeBriefing, teks: string): Promise<boolean> {
  const dasar = kunciDraf(userId, tanggal, periode);
  try {
    if (teks === '') {
      await hapusDrafBriefing(userId, tanggal, periode);
      return true;
    }
    const bagian: string[] = [];
    for (let i = 0; i < teks.length && bagian.length < 10; i += POTONG) {
      bagian.push(teks.slice(i, i + POTONG));
    }
    for (let i = 0; i < bagian.length; i += 1) {
      await SecureStore.setItemAsync(`${dasar}.${i}`, bagian[i] ?? '');
    }
    await SecureStore.setItemAsync(`${dasar}.n`, String(bagian.length));
    return true;
  } catch {
    return false;
  }
}

export async function hapusDrafBriefing(userId: string, tanggal: string, periode: PeriodeBriefing): Promise<void> {
  const dasar = kunciDraf(userId, tanggal, periode);
  try {
    const n = Number(await SecureStore.getItemAsync(`${dasar}.n`));
    for (let i = 0; i < (Number.isInteger(n) ? Math.min(n, 10) : 0); i += 1) {
      await SecureStore.deleteItemAsync(`${dasar}.${i}`).catch(() => undefined);
    }
    await SecureStore.deleteItemAsync(`${dasar}.n`).catch(() => undefined);
  } catch {
    // Diabaikan.
  }
}
