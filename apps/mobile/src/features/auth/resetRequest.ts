/**
 * Permintaan "Lupa kata sandi" yang masih berjalan, disimpan di SecureStore
 * (`rk.reset.request`) supaya aplikasi yang ditutup bisa melanjutkan:
 * kartu "Lanjutkan permintaan" di layar Masuk.
 */
import * as SecureStore from 'expo-secure-store';

const KEY = 'rk.reset.request';

export interface PermintaanReset {
  token: string;
  email: string;
  /** Epoch ms permintaan kedaluwarsa (24 jam; dari `expires_at` server). */
  kedaluwarsaPada: number;
  /** Epoch ms permintaan dikirim. */
  diajukanPada: number;
}

export async function bacaPermintaanReset(): Promise<PermintaanReset | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) {
      return null;
    }
    const p = JSON.parse(raw) as PermintaanReset;
    if (!p.token || typeof p.kedaluwarsaPada !== 'number' || p.kedaluwarsaPada <= Date.now()) {
      await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export async function simpanPermintaanReset(p: PermintaanReset): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(p)).catch(() => undefined);
}

export async function hapusPermintaanReset(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
}

/** Setup token sekali pakai (30 menit) setelah HR menyetujui — hanya di memori, tidak pernah disimpan. */
export interface SetupMemori {
  setupToken: string;
  /** Epoch ms setup token kedaluwarsa. */
  kedaluwarsaPada: number;
  email: string;
  hint: string | null;
}

let setupMemori: SetupMemori | null = null;

export function simpanSetup(s: SetupMemori | null): void {
  setupMemori = s;
}

export function bacaSetup(): SetupMemori | null {
  if (setupMemori && setupMemori.kedaluwarsaPada <= Date.now()) {
    setupMemori = null;
  }
  return setupMemori;
}
