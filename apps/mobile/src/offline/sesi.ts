/**
 * Menyambungkan siklus sesi ke modul offline. Dipanggil `SessionProvider`:
 *
 *  - `mulaiSesiOffline(uid)` — sesi aktif (dipulihkan dari SecureStore, atau baru
 *    masuk): cache baca langsung aktif untuk `uid` (sinkron, supaya permintaan
 *    pertama sudah bisa memakainya); basis data dibuka & antrean dimuat sesudah
 *    interaksi awal selesai (jalur buka dingin tetap ringan).
 *  - `akhiriSesiOffline('keluar' | 'akun_nonaktif')` — keluar akun disengaja atau
 *    akun dinonaktifkan: hapus SEMUA data offline (cache, antrean, berkas).
 *  - `akhiriSesiOffline('sesi_berakhir')` — 401: hapus cache baca, tetapi antrean
 *    perubahan yang belum terkirim dipertahankan agar bisa dikirim setelah
 *    masuk ulang dengan akun yang sama (item akun lain dibuang saat sesi berikut).
 */
import { InteractionManager } from 'react-native';

import { bersihSemuaBasi } from './basi';
import { aturPenggunaCache, hapusCache, hapusCacheSelain } from './cache';
import { kosongkanSemua } from './db';
import { hentikanAntrean, mulaiAntrean } from './antrean';

export type AlasanAkhirSesi = 'keluar' | 'akun_nonaktif' | 'sesi_berakhir';

export function mulaiSesiOffline(uid: string): void {
  aturPenggunaCache(uid);
  void InteractionManager.runAfterInteractions(() => {
    void hapusCacheSelain(uid).catch(() => undefined);
    void mulaiAntrean(uid).catch(() => undefined);
  });
}

export async function akhiriSesiOffline(alasan: AlasanAkhirSesi): Promise<void> {
  aturPenggunaCache(null);
  bersihSemuaBasi();
  hentikanAntrean();
  try {
    if (alasan === 'sesi_berakhir') {
      await hapusCache();
    } else {
      await kosongkanSemua();
    }
  } catch {
    // Penghapusan terbaik-usaha; data tetap terpartisi per pengguna & terenkripsi.
  }
}
