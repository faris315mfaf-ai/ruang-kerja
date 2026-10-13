/**
 * Catatan kecil sinkron latar belakang di tabel `meta` (basis data terenkripsi).
 * Modul ringan: hanya bergantung pada `db.ts` sehingga aman diimpor dari titik
 * masuk aplikasi dan dari mesin antrean tanpa membentuk siklus impor.
 *
 *  - `latar_terakhir:<uid>`  — "<epoch ms>|<jumlah terkirim>" putaran latar terakhir.
 *  - `latar_ditolak:<uid>`   — epoch ms server menolak token dari latar belakang
 *    (401). Selama ada, task latar tidak mencoba lagi; dihapus saat sesi dimulai
 *    ulang di aplikasi (`mulaiSesiOffline`), yang menangani 401 dengan benar
 *    (dialog "Sesi berakhir").
 */
import { denganDb } from './db';

export interface InfoLatarTerakhir {
  /** Epoch ms putaran latar terakhir. */
  pada: number;
  /** Jumlah item yang terkirim pada putaran itu. */
  terkirim: number;
}

const kunciTerakhir = (uid: string): string => `latar_terakhir:${uid}`;
const kunciDitolak = (uid: string): string => `latar_ditolak:${uid}`;

export async function catatLatarTerakhir(uid: string, terkirim: number): Promise<void> {
  await denganDb((db) => db.runAsync('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', kunciTerakhir(uid), `${Date.now()}|${terkirim}`));
}

export async function bacaLatarTerakhir(uid: string): Promise<InfoLatarTerakhir | null> {
  const baris = await denganDb((db) => db.getFirstAsync<{ v: string }>('SELECT v FROM meta WHERE k = ?', kunciTerakhir(uid)));
  if (!baris) {
    return null;
  }
  const [pada, terkirim] = baris.v.split('|').map(Number);
  return pada !== undefined && Number.isFinite(pada) ? { pada, terkirim: terkirim !== undefined && Number.isFinite(terkirim) ? terkirim : 0 } : null;
}

export async function tandaiSesiDitolak(uid: string): Promise<void> {
  await denganDb((db) => db.runAsync('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', kunciDitolak(uid), String(Date.now())));
}

export async function hapusTandaSesiDitolak(uid: string): Promise<void> {
  await denganDb((db) => db.runAsync('DELETE FROM meta WHERE k = ?', kunciDitolak(uid)));
}

export async function sesiDitolak(uid: string): Promise<boolean> {
  const baris = await denganDb((db) => db.getFirstAsync<{ v: string }>('SELECT v FROM meta WHERE k = ?', kunciDitolak(uid)));
  return baris !== null;
}

/**
 * Jumlah item antrean pengguna yang bisa dikirim sekarang: berstatus `menunggu` dan tidak tertahan item
 * `konflik`/`gagal` yang lebih awal dengan `urutan_kunci` sama (item itu menunggu keputusan pengguna).
 * Murah: satu query tanpa memuat antrean ke memori — dasar keputusan "task latar keluar tanpa jaringan".
 */
export async function jumlahMenungguDb(uid: string): Promise<number> {
  const baris = await denganDb((db) =>
    db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM antrean a
       WHERE a.uid = ? AND a.status = 'menunggu'
         AND NOT EXISTS (
           SELECT 1 FROM antrean b
           WHERE b.uid = a.uid AND b.urutan_kunci = a.urutan_kunci AND b.seq < a.seq AND b.status IN ('konflik', 'gagal')
         )`,
      uid,
    ),
  );
  return baris?.n ?? 0;
}
