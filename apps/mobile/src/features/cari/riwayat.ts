/** Riwayat pencarian lokal (SecureStore, maks. 10, per perangkat). */
import * as SecureStore from 'expo-secure-store';

const KUNCI = 'rk.cari.riwayat';
export const MAKS_RIWAYAT = 10;

export async function bacaRiwayat(): Promise<string[]> {
  try {
    const mentah = await SecureStore.getItemAsync(KUNCI);
    if (!mentah) {
      return [];
    }
    const data: unknown = JSON.parse(mentah);
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string').slice(0, MAKS_RIWAYAT) : [];
  } catch {
    return [];
  }
}

async function tulis(daftar: string[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(KUNCI, JSON.stringify(daftar.slice(0, MAKS_RIWAYAT)));
  } catch {
    // Riwayat hanya kenyamanan; abaikan galat penyimpanan.
  }
}

/** Tambah ke depan (tanpa duplikat, tidak peka huruf besar/kecil); mengembalikan daftar baru. */
export async function tambahRiwayat(kata: string, lama: string[]): Promise<string[]> {
  const bersih = kata.trim();
  if (bersih.length < 2) {
    return lama;
  }
  const baru = [bersih, ...lama.filter((x) => x.toLowerCase() !== bersih.toLowerCase())].slice(0, MAKS_RIWAYAT);
  await tulis(baru);
  return baru;
}

export async function hapusRiwayat(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KUNCI);
  } catch {
    // abaikan
  }
}
