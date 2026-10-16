/**
 * Isi task sinkron latar belakang (`latar.ts` memuatnya lewat `import()` saat task
 * berjalan, supaya titik masuk aplikasi tidak memuat seluruh mesin antrean dan
 * penangan fitur pada setiap buka dingin).
 *
 * Berjalan di proses tanpa UI: tidak ada SessionProvider, PemantauJaringan,
 * maupun penangan 401. Karena itu:
 *  - token dibaca dari SecureStore dan dipasang sebagai token sementara klien API
 *    (getter sesi React, bila ada, tetap didahulukan);
 *  - jaringan diperiksa dengan `segarkanJaringan()`;
 *  - galat 401 / blokir akun / versi tidak pernah menghapus sesi atau mengubah
 *    item — mesin hanya berhenti (lihat `sinkronkanLatar`).
 */
import { setTokenSementara, tokenSaatIni } from '@/api/client';
import { bacaTokenTersimpan } from '@/session/tokenTersimpan';

import './penanganFitur';
import { sinkronkanLatar } from './antrean';
import { segarkanJaringan } from './jaringan';
import { catatLatarTerakhir, jumlahMenungguDb, sesiDitolak } from './latarMeta';

/** Waktu minimal yang tersisa agar membuka jaringan masih ada artinya. */
const SISA_MINIMAL_MS = 3000;

export type HasilKerjaLatar = 'dilewati' | 'selesai';

/**
 * Kirim antrean tertunda bila ada. Urutan pemeriksaan murah → mahal:
 * sesi tersimpan → sesi tidak ditandai ditolak → ada item menunggu (query lokal)
 * → jaringan. Tanpa item/sesi keluar tanpa menyentuh jaringan.
 * Melempar bila basis data/mesin gagal (task mengembalikan `Failed`).
 */
export async function jalankanSinkronLatar(batasMs: number): Promise<HasilKerjaLatar> {
  const mulai = Date.now();
  const sesi = await bacaTokenTersimpan();
  if (sesi === null) {
    return 'dilewati';
  }
  if (await sesiDitolak(sesi.uid)) {
    return 'dilewati';
  }
  if ((await jumlahMenungguDb(sesi.uid)) === 0) {
    return 'dilewati';
  }
  if (!(await segarkanJaringan())) {
    return 'dilewati';
  }
  const sisa = batasMs - (Date.now() - mulai);
  if (sisa < SISA_MINIMAL_MS) {
    return 'dilewati';
  }
  const pakaiTokenSementara = tokenSaatIni() === null;
  if (pakaiTokenSementara) {
    setTokenSementara(sesi.token);
  }
  try {
    const hasil = await sinkronkanLatar(sesi.uid, sisa);
    await catatLatarTerakhir(sesi.uid, hasil.sukses).catch(() => undefined);
    return 'selesai';
  } finally {
    if (pakaiTokenSementara) {
      setTokenSementara(null);
    }
  }
}
