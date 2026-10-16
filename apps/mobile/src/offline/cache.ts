/**
 * Cache baca (stale-while-revalidate) untuk respons GET API.
 *
 * - Daftar putih per modul (`bolehCache`): hanya data yang boleh dibaca
 *   offline. Modul sensitif (hiring, data karyawan HR, selfie, auth, persetujuan,
 *   token perangkat, …) TIDAK pernah disimpan, meski path-nya kebetulan cocok.
 * - Disekat per pengguna (`uid`): satu akun tidak pernah membaca cache akun lain.
 * - Batas: 25 MB total (buang yang paling lama dipakai), 1,5 MB per entri,
 *   umur maks. 14 hari. Tulis dibuffer 500 ms lalu satu transaksi.
 * - Tidak dipakai untuk permintaan selain GET.
 *
 * Tidak mengimpor `client.ts` (dipakai olehnya).
 */
import { denganDb, denganTransaksi } from './db';

export const MAKS_TOTAL_BYTE = 25 * 1024 * 1024;
export const MAKS_ENTRI_BYTE = 1_500_000;
export const MAKS_UMUR_MS = 14 * 24 * 60 * 60 * 1000;

// ── Kebijakan: apa yang boleh disimpan ───────────────────────────────────────

/** Dicek lebih dulu; menang atas daftar putih. Cocok bila path (tanpa query) diawali salah satunya, atau memuat salah satu penggalan. */
const TOLAK_AWALAN: readonly string[] = [
  'hiring',
  'admin',
  'hr',
  'auth', // kecuali auth/saya (daftar putih eksplisit di bawah)
  'perangkat', // pendaftaran token push / biometrik
  'persetujuan', // keputusan butuh status segar
  'privasi', // ekspor data pribadi
  'saldo-cuti', // saldo semua karyawan
  'absensi/log', // selfie
  'absensi/tim', // data absensi karyawan lain
  'absensi/hari/', // absensi orang lain per tanggal
  'karyawan',
  'cari', // hasil pencarian: terlalu cepat basi
  'monitoring',
  'manajemen',
  'okr',
  'portofolio',
  'proyek',
  'organisasi',
  'laporan/tim',
  'laporan/orang',
  'laporan/cari',
  'catatan-tindakan',
  'tautan-desktop',
  'kebijakan-privasi',
];

const TOLAK_PENGGALAN: readonly string[] = ['selfie', '/video/', '/transkrip', '/notulen-otomatis', '/dibaca-oleh', '/versi', '/cari', '/lampiran', '/unduh'];

/** Awalan yang boleh (segmen penuh: `tugas` cocok `tugas` dan `tugas/12`, bukan `tugasan`). */
const IZIN_AWALAN: readonly string[] = [
  'beranda',
  'briefing',
  'tugas',
  'workspace',
  'catatan',
  'rapat',
  'kalender',
  'pengajuan',
  'inbox',
  'obrolan',
  'pengumuman',
  'kinerja',
  'dashboard/tampilan',
  'dashboard/saya',
  'dashboard/divisi',
  'komentar',
  'orang', // direktori nama untuk pemilih penanggung jawab/mention (nama & avatar saja)
];

/** Path persis yang boleh. */
const IZIN_PERSIS: readonly string[] = ['auth/saya', 'konfigurasi', 'absensi/hari-ini', 'absensi/riwayat', 'absensi/rekap', 'laporan', 'laporan/hari-ini'];

function awalan(path: string, daftar: readonly string[]): boolean {
  return daftar.some((a) => path === a || path.startsWith(a.endsWith('/') ? a : `${a}/`));
}

/** `path` = path API relatif ('tugas/12'), tanpa query/hash/awal garis miring. */
export function bolehCache(path: string): boolean {
  const p = path.replace(/^\/+/, '').split(/[?#]/)[0] ?? '';
  if (p === '') {
    return false;
  }
  if (IZIN_PERSIS.includes(p)) {
    return true;
  }
  if (awalan(p, TOLAK_AWALAN) || TOLAK_PENGGALAN.some((g) => p.includes(g))) {
    return false;
  }
  if (p.startsWith('pengajuan/pratinjau')) {
    return false;
  }
  return awalan(p, IZIN_AWALAN);
}

/** Kunci cache: metode + path + query terurut (urutan parameter tidak memengaruhi). */
export function kunciCache(pathRelatif: string, params: URLSearchParams): string {
  const pasangan = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = new URLSearchParams(pasangan).toString();
  return `GET ${pathRelatif.replace(/^\/+/, '')}${query ? `?${query}` : ''}`;
}

// ── Penyimpanan ──────────────────────────────────────────────────────────────

let uidAktif: string | null = null;

interface Tertunda {
  uid: string;
  k: string;
  body: string;
  ts: number;
}

const tertunda = new Map<string, Tertunda>();
const disentuh = new Map<string, { uid: string; k: string }>();
let timerFlush: ReturnType<typeof setTimeout> | null = null;

/** Pengguna yang cache-nya aktif; null = cache mati (tidak membaca/menulis). */
export function aturPenggunaCache(uid: string | null): void {
  if (uid !== uidAktif) {
    // Buang tulisan tertunda milik pengguna lain agar tidak bocor lintas akun.
    for (const [kunci, t] of tertunda) {
      if (t.uid !== uid) {
        tertunda.delete(kunci);
      }
    }
    disentuh.clear();
  }
  uidAktif = uid;
}

export function penggunaCache(): string | null {
  return uidAktif;
}

export function cacheAktif(): boolean {
  return uidAktif !== null;
}

function kunciTertunda(uid: string, k: string): string {
  return `${uid}\u0000${k}`;
}

export interface EntriCache {
  body: string;
  /** Epoch ms respons disimpan. */
  ts: number;
}

/** Baca salinan terakhir; null bila tak ada / kedaluwarsa / cache mati / basis data gagal. */
export async function bacaCache(k: string): Promise<EntriCache | null> {
  const uid = uidAktif;
  if (uid === null) {
    return null;
  }
  const buf = tertunda.get(kunciTertunda(uid, k));
  if (buf) {
    return { body: buf.body, ts: buf.ts };
  }
  try {
    const baris = await denganDb((db) => db.getFirstAsync<{ body: string; ts: number; atime: number }>('SELECT body, ts, atime FROM cache WHERE uid = ? AND k = ?', uid, k));
    if (!baris || uid !== uidAktif) {
      return null;
    }
    const sekarang = Date.now();
    if (sekarang - baris.ts > MAKS_UMUR_MS) {
      void denganDb((db) => db.runAsync('DELETE FROM cache WHERE uid = ? AND k = ?', uid, k)).catch(() => undefined);
      return null;
    }
    if (sekarang - baris.atime > 3_600_000) {
      disentuh.set(kunciTertunda(uid, k), { uid, k });
      jadwalkanFlush();
    }
    return { body: baris.body, ts: baris.ts };
  } catch {
    return null;
  }
}

/** Simpan respons (dibuffer; tidak menunggu). Abaikan bila terlalu besar atau cache mati. */
export function tulisCache(k: string, body: string): void {
  const uid = uidAktif;
  if (uid === null || body.length === 0 || body.length > MAKS_ENTRI_BYTE) {
    return;
  }
  tertunda.set(kunciTertunda(uid, k), { uid, k, body, ts: Date.now() });
  jadwalkanFlush();
}

function jadwalkanFlush(): void {
  if (timerFlush) {
    return;
  }
  timerFlush = setTimeout(() => {
    timerFlush = null;
    void flush();
  }, 500);
}

async function flush(): Promise<void> {
  const tulis = [...tertunda.values()];
  const sentuh = [...disentuh.values()];
  tertunda.clear();
  disentuh.clear();
  if (tulis.length === 0 && sentuh.length === 0) {
    return;
  }
  try {
    const sekarang = Date.now();
    await denganTransaksi(async (db) => {
      for (const t of tulis) {
        await db.runAsync('INSERT OR REPLACE INTO cache (uid, k, body, ts, atime, ukuran) VALUES (?, ?, ?, ?, ?, ?)', t.uid, t.k, t.body, t.ts, sekarang, t.body.length);
      }
      for (const s of sentuh) {
        await db.runAsync('UPDATE cache SET atime = ? WHERE uid = ? AND k = ?', sekarang, s.uid, s.k);
      }
    });
    if (tulis.length > 0) {
      await pangkas();
    }
  } catch {
    // Cache hanyalah akselerator: kegagalan tulis tidak boleh mengganggu aplikasi.
  }
}

/** Buang yang kedaluwarsa, lalu yang paling lama tak dipakai sampai ≤ 80% batas. */
export async function pangkas(): Promise<void> {
  await denganTransaksi(async (db) => {
    await db.runAsync('DELETE FROM cache WHERE ts < ?', Date.now() - MAKS_UMUR_MS);
    const baris = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(ukuran), 0) AS total FROM cache');
    let total = baris?.total ?? 0;
    if (total <= MAKS_TOTAL_BYTE) {
      return;
    }
    const target = MAKS_TOTAL_BYTE * 0.8;
    const lama = await db.getAllAsync<{ uid: string; k: string; ukuran: number }>('SELECT uid, k, ukuran FROM cache ORDER BY atime ASC');
    for (const entri of lama) {
      if (total <= target) {
        break;
      }
      await db.runAsync('DELETE FROM cache WHERE uid = ? AND k = ?', entri.uid, entri.k);
      total -= entri.ukuran;
    }
  });
}

/** Total byte isi cache untuk pengguna aktif (angka karakter ≈ byte). */
export async function ukuranCache(): Promise<{ byte: number; entri: number }> {
  const uid = uidAktif;
  if (uid === null) {
    return { byte: 0, entri: 0 };
  }
  await flushSegera();
  try {
    const baris = await denganDb((db) => db.getFirstAsync<{ byte: number; entri: number }>('SELECT COALESCE(SUM(ukuran), 0) AS byte, COUNT(*) AS entri FROM cache WHERE uid = ?', uid));
    return { byte: baris?.byte ?? 0, entri: baris?.entri ?? 0 };
  } catch {
    return { byte: 0, entri: 0 };
  }
}

async function flushSegera(): Promise<void> {
  if (timerFlush) {
    clearTimeout(timerFlush);
    timerFlush = null;
  }
  await flush();
}

/** Hapus seluruh cache baca (semua pengguna). Antrean tulis tidak disentuh. */
export async function hapusCache(): Promise<void> {
  tertunda.clear();
  disentuh.clear();
  if (timerFlush) {
    clearTimeout(timerFlush);
    timerFlush = null;
  }
  await denganDb((db) => db.execAsync('DELETE FROM cache;'));
}

/** Buang cache pengguna lain (dipanggil saat sesi dimulai). */
export async function hapusCacheSelain(uid: string): Promise<void> {
  await denganDb((db) => db.runAsync('DELETE FROM cache WHERE uid <> ?', uid));
}
