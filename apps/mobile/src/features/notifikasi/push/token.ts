/**
 * Token push perangkat: ambil token FCM native (`getDevicePushTokenAsync`) dan
 * daftarkan ke server untuk perangkat ini (`PUT /perangkat/{device}/push-token`).
 *
 * Tidak pernah melempar galat. Tanpa Firebase (build tanpa google-services.json)
 * pengambilan token gagal → status `firebase`, bukan crash; Inbox, notifikasi
 * lokal, dan semua fitur lain tetap berjalan. Token tidak pernah dicatat ke log.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ApiError } from '@/api/client';
import { daftarPerangkat, simpanTokenPush } from '@/api/perangkat';

import { bacaStatusPush, setStatusPush, type StatusPush } from './status';

/** Token terakhir yang diketahui pada proses ini (event token mengulang token yang baru saja kita ambil). */
let tokenDiketahui = '';

/** `perangkat:token` yang terakhir berhasil dikirim pada proses ini (hindari PUT berulang). */
let terakhir = '';

/** Lupakan pendaftaran terakhir (keluar/ganti akun) agar masuk berikutnya mendaftar lagi. */
export function lupakanPendaftaranPush(): void {
  terakhir = '';
  tokenDiketahui = '';
}

function ringkas(err: unknown): string {
  const teks = err instanceof Error ? err.message : String(err);
  return teks.replace(/\s+/g, ' ').slice(0, 140);
}

/** Izin POST_NOTIFICATIONS sudah diberikan (Android 12 ke bawah selalu `true`). */
export async function izinNotifikasiDiberikan(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Pendaftaran yang sedang berjalan untuk token tertentu (pengambilan token memicu `onDevicePushToken` juga). */
let berjalan: { token: string; janji: Promise<StatusPush> } | null = null;

async function kirimKeServer(token: string): Promise<StatusPush> {
  try {
    const { devices } = await daftarPerangkat();
    const ini = devices.find((d) => d.is_current);
    if (!ini) {
      return setStatusPush('server', 'Perangkat ini tidak ditemukan di daftar perangkat akun.');
    }
    const kunci = `${ini.id}:${token}`;
    if (terakhir !== kunci || !ini.has_push_token) {
      await simpanTokenPush(ini.id, token);
      terakhir = kunci;
    }
    return setStatusPush('aktif');
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      return setStatusPush('offline');
    }
    return setStatusPush('server', err instanceof ApiError ? err.message : ringkas(err));
  }
}

/**
 * Daftarkan token push perangkat ini. `tokenBaru` dari event `addPushTokenListener`
 * (jangan mengambil token lagi: pengambilan token memancarkan event yang sama).
 */
export async function daftarkanTokenPush(tokenBaru?: string): Promise<StatusPush> {
  if (Platform.OS !== 'android') {
    return setStatusPush('firebase', 'Hanya tersedia di Android.');
  }
  if (!(await izinNotifikasiDiberikan())) {
    return setStatusPush('izin');
  }

  // Event token yang hanya menggemakan token yang baru kita ambil: tidak perlu kerja ulang.
  if (tokenBaru !== undefined && tokenBaru === tokenDiketahui) {
    return bacaStatusPush();
  }

  let token = tokenBaru ?? '';
  if (token === '') {
    try {
      const hasil = await Notifications.getDevicePushTokenAsync();
      token = typeof hasil.data === 'string' ? hasil.data : '';
    } catch (err) {
      // Biasanya: Firebase belum dikonfigurasi di build ini (docs/deploy/ANDROID-FCM.md).
      return setStatusPush('firebase', ringkas(err));
    }
    if (token === '') {
      return setStatusPush('firebase', 'Token FCM kosong.');
    }
  }

  tokenDiketahui = token;
  if (berjalan?.token === token) {
    return berjalan.janji;
  }
  const janji = kirimKeServer(token).finally(() => {
    if (berjalan?.janji === janji) {
      berjalan = null;
    }
  });
  berjalan = { token, janji };
  return janji;
}
