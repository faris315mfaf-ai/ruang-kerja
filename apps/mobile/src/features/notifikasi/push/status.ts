/**
 * Status push di perangkat ini (toko kecil di luar React) + permintaan
 * pendaftaran ulang token. Dibaca layar "Notifikasi di ponsel ini" lewat
 * `usePushStatus()`; ditulis `PushController` / `daftarkanTokenPush`.
 */
import { useSyncExternalStore } from 'react';

export type KodePush =
  /** Belum diperiksa pada sesi ini. */
  | 'memeriksa'
  /** Token FCM terdaftar di server untuk perangkat ini. */
  | 'aktif'
  /** Izin notifikasi Android belum/tidak diberikan. */
  | 'izin'
  /** Firebase tidak dikonfigurasi pada build ini (tanpa google-services.json) atau token FCM gagal diambil. */
  | 'firebase'
  /** Token ada tetapi belum terkirim ke server (tanpa koneksi); dicoba lagi saat aplikasi aktif. */
  | 'offline'
  /** Server menolak/galat, atau perangkat ini tidak ditemukan di daftar perangkat akun. */
  | 'server';

export interface StatusPush {
  kode: KodePush;
  detail: string | null;
}

let sekarang: StatusPush = { kode: 'memeriksa', detail: null };
const pendengar = new Set<() => void>();

export function setStatusPush(kode: KodePush, detail: string | null = null): StatusPush {
  if (sekarang.kode !== kode || sekarang.detail !== detail) {
    sekarang = { kode, detail };
    pendengar.forEach((f) => f());
  }
  return sekarang;
}

export function bacaStatusPush(): StatusPush {
  return sekarang;
}

export function usePushStatus(): StatusPush {
  return useSyncExternalStore(
    (f) => {
      pendengar.add(f);
      return () => {
        pendengar.delete(f);
      };
    },
    bacaStatusPush,
    bacaStatusPush,
  );
}

const peminta = new Set<() => void>();

/** Minta `PushController` mendaftarkan ulang token (mis. setelah izin diberikan). */
export function mintaDaftarUlangPush(): void {
  peminta.forEach((f) => f());
}

export function dengarkanDaftarUlangPush(f: () => void): () => void {
  peminta.add(f);
  return () => {
    peminta.delete(f);
  };
}
