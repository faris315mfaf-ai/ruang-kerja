/**
 * Simpanan perangkat modul Pengajuan:
 * - draf isian form baru di SecureStore (`rk.pengajuan-draf.v1.<user>.<kategori>`),
 *   hanya nilai biasa (tanpa berkas), dibuang setelah kirim / draf server / buang;
 * - tembolok daftar "Pengajuan saya" terakhir (untuk dibaca saat offline);
 * - hasil kirim terakhir untuk layar "Pengajuan terkirim".
 */
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import type { HalamanPengajuan, ItemPengajuan, KategoriPengajuan } from '@/api/pengajuan';

import type { NilaiForm } from './nilaiForm';

export interface DrafPerangkat {
  typeId: string;
  nilai: NilaiForm;
  savedAt: string;
}

function kunci(userId: string, kategori: KategoriPengajuan): string {
  return `rk.pengajuan-draf.v1.${userId.replace(/[^A-Za-z0-9]/g, '')}.${kategori}`;
}

export async function bacaDrafPerangkat(userId: string, kategori: KategoriPengajuan): Promise<DrafPerangkat | null> {
  try {
    const mentah = await SecureStore.getItemAsync(kunci(userId, kategori));
    if (!mentah) {
      return null;
    }
    const isi = JSON.parse(mentah) as Partial<DrafPerangkat>;
    return typeof isi.typeId === 'string' && isi.nilai && typeof isi.savedAt === 'string' ? (isi as DrafPerangkat) : null;
  } catch {
    return null;
  }
}

export async function tulisDrafPerangkat(userId: string, kategori: KategoriPengajuan, draf: DrafPerangkat): Promise<void> {
  try {
    await SecureStore.setItemAsync(kunci(userId, kategori), JSON.stringify(draf));
  } catch {
    // Penyimpanan perangkat gagal — isian tetap ada di layar.
  }
}

export async function hapusDrafPerangkat(userId: string, kategori: KategoriPengajuan): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(kunci(userId, kategori));
  } catch {
    // abaikan
  }
}

// ── Tembolok daftar ──────────────────────────────────────────────────────────

interface Tembolok {
  userId: string;
  savedAt: string;
  halaman: HalamanPengajuan;
}

function berkasTembolok(): File {
  return new File(Paths.cache, 'pengajuan-saya.json');
}

export function bacaTembolok(userId: string): { savedAt: string; halaman: HalamanPengajuan } | null {
  try {
    const f = berkasTembolok();
    if (!f.exists) {
      return null;
    }
    const isi = JSON.parse(f.textSync()) as Partial<Tembolok>;
    return isi.userId === userId && isi.halaman && typeof isi.savedAt === 'string' ? { savedAt: isi.savedAt, halaman: isi.halaman } : null;
  } catch {
    return null;
  }
}

export function tulisTembolok(userId: string, halaman: HalamanPengajuan): void {
  try {
    const f = berkasTembolok();
    if (!f.exists) {
      f.create();
    }
    f.write(JSON.stringify({ userId, savedAt: new Date().toISOString(), halaman } satisfies Tembolok));
  } catch {
    // abaikan
  }
}

// ── Hasil kirim terakhir ─────────────────────────────────────────────────────

let terkirim: ItemPengajuan | null = null;

export function setTerkirim(item: ItemPengajuan): void {
  terkirim = item;
}

export function ambilTerkirim(id: string): ItemPengajuan | null {
  return terkirim?.id === id ? terkirim : null;
}

/** Penanda "daftar perlu dimuat ulang" setelah tindakan di layar lain. */
let versiDaftar = 0;

export function tandaiDaftarBerubah(): void {
  versiDaftar += 1;
}

export function versiDaftarSekarang(): number {
  return versiDaftar;
}
