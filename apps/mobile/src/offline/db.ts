/**
 * Basis data lokal offline (cache baca + antrean tulis).
 *
 * - `expo-sqlite` dengan SQLCipher (config plugin `useSQLCipher` di app.json):
 *   kunci acak 256-bit dibuat sekali, disimpan di `expo-secure-store`
 *   (Android Keystore), dipasang lewat `PRAGMA key`. Bila build tidak memuat
 *   SQLCipher (`PRAGMA cipher_version` kosong) basis data tetap dipakai tanpa
 *   enkripsi tingkat berkas — `statusEnkripsi()` melaporkan 'polos'.
 * - Dibuka MALAS (setelah frame pertama / saat pertama dibutuhkan) agar jalur
 *   buka dingin tetap ringan; modul native dimuat lewat `import()` dinamis.
 * - Semua akses diserialisasi lewat satu antrean (mutex) karena koneksi tunggal
 *   dipakai bersama; transaksi = BEGIN IMMEDIATE … COMMIT di dalam mutex.
 * - Skema berversi lewat `PRAGMA user_version` (daftar `MIGRASI`).
 * - Berkas biner (selfie ≤ 5 MB) disimpan sebagai BLOB di tabel `berkas`
 *   sehingga ikut terenkripsi; tidak ada berkas telanjang di penyimpanan.
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';

type ModulSqlite = typeof import('expo-sqlite');

const NAMA_DB = 'rk-offline.db';
const KUNCI_SECURE_STORE = 'rk.offline.kunci.v1';

export type StatusEnkripsi = 'sqlcipher' | 'polos';

let dbPromise: Promise<SQLiteDatabase> | null = null;
let enkripsi: StatusEnkripsi | null = null;

/** 'sqlcipher' (terenkripsi), 'polos' (fallback), atau null bila basis data belum dibuka. */
export function statusEnkripsi(): StatusEnkripsi | null {
  return enkripsi;
}

function heks(bytes: Uint8Array): string {
  let hasil = '';
  for (const b of bytes) {
    hasil += b.toString(16).padStart(2, '0');
  }
  return hasil;
}

/**
 * Migrasi skema berurutan: indeks i = versi i + 1. Jangan ubah yang sudah
 * dirilis — tambahkan entri baru di akhir.
 */
const MIGRASI: string[] = [
  `
  CREATE TABLE cache (
    uid TEXT NOT NULL,
    k TEXT NOT NULL,
    body TEXT NOT NULL,
    ts INTEGER NOT NULL,
    atime INTEGER NOT NULL,
    ukuran INTEGER NOT NULL,
    PRIMARY KEY (uid, k)
  );
  CREATE INDEX cache_atime ON cache (atime);
  CREATE TABLE antrean (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    kunci_idem TEXT NOT NULL,
    uid TEXT NOT NULL,
    jenis TEXT NOT NULL,
    label TEXT NOT NULL,
    ringkas TEXT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    json TEXT,
    form_fields TEXT,
    urutan_kunci TEXT NOT NULL,
    dedupe_kunci TEXT,
    meta TEXT NOT NULL DEFAULT '{}',
    dibuat TEXT NOT NULL,
    dibuat_ms INTEGER NOT NULL,
    kedaluwarsa_jam INTEGER,
    waktu_offline_key TEXT,
    status TEXT NOT NULL DEFAULT 'menunggu',
    percobaan INTEGER NOT NULL DEFAULT 0,
    berikutnya_ms INTEGER NOT NULL DEFAULT 0,
    galat_pesan TEXT,
    galat_status INTEGER,
    galat_kode TEXT
  );
  CREATE INDEX antrean_uid ON antrean (uid, seq);
  CREATE TABLE berkas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    antrean_id TEXT NOT NULL,
    field TEXT NOT NULL,
    nama TEXT NOT NULL,
    mime TEXT NOT NULL,
    ukuran INTEGER NOT NULL,
    data BLOB NOT NULL
  );
  CREATE INDEX berkas_antrean ON berkas (antrean_id);
  CREATE TABLE meta (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL
  );
  `,
];

async function inisialisasi(sqlite: ModulSqlite, kunci: string): Promise<SQLiteDatabase> {
  const db = await sqlite.openDatabaseAsync(NAMA_DB);
  try {
    // PRAGMA key harus perintah pertama; pada build tanpa SQLCipher ini tak berefek.
    await db.execAsync(`PRAGMA key = "x'${kunci}'";`);
    const versiCipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
    enkripsi = versiCipher?.cipher_version ? 'sqlcipher' : 'polos';
    // Membaca halaman pertama: gagal di sini bila kunci salah / berkas rusak.
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = OFF;');
    const baris = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    let versi = baris?.user_version ?? 0;
    while (versi < MIGRASI.length) {
      await db.execAsync(`BEGIN IMMEDIATE; ${MIGRASI[versi]} PRAGMA user_version = ${versi + 1}; COMMIT;`);
      versi += 1;
    }
    return db;
  } catch (galat) {
    await db.closeAsync().catch(() => undefined);
    throw galat;
  }
}

async function buka(): Promise<SQLiteDatabase> {
  const sqlite = await import('expo-sqlite');
  let kunci = await SecureStore.getItemAsync(KUNCI_SECURE_STORE);
  if (!kunci) {
    kunci = heks(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(KUNCI_SECURE_STORE, kunci);
  }
  try {
    return await inisialisasi(sqlite, kunci);
  } catch {
    // Kunci hilang/ganti (mis. backup dipulihkan tanpa Keystore) atau berkas rusak:
    // data offline hanyalah salinan, jadi buat ulang dari awal.
    await sqlite.deleteDatabaseAsync(NAMA_DB).catch(() => undefined);
    return inisialisasi(sqlite, kunci);
  }
}

/** Basis data (dibuka sekali, malas). Gagal → promise ditolak dan percobaan berikutnya mencoba lagi. */
export function ambilDb(): Promise<SQLiteDatabase> {
  if (dbPromise === null) {
    dbPromise = buka().catch((galat: unknown) => {
      dbPromise = null;
      throw galat;
    });
  }
  return dbPromise;
}

let ekor: Promise<unknown> = Promise.resolve();

/** Jalankan `fn` secara berurutan terhadap koneksi bersama (tidak pernah menyelip di tengah transaksi). */
export function denganDb<T>(fn: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const giliran = ekor.then(async () => fn(await ambilDb()));
  ekor = giliran.catch(() => undefined);
  return giliran;
}

/** Seperti `denganDb` tetapi dibungkus transaksi atomik (rollback bila `fn` melempar). */
export function denganTransaksi<T>(fn: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  return denganDb(async (db) => {
    await db.execAsync('BEGIN IMMEDIATE');
    try {
      const hasil = await fn(db);
      await db.execAsync('COMMIT');
      return hasil;
    } catch (galat) {
      await db.execAsync('ROLLBACK').catch(() => undefined);
      throw galat;
    }
  });
}

/** Hapus seluruh isi tabel data (cache, antrean, berkas, meta). Skema tetap. */
export async function kosongkanSemua(): Promise<void> {
  await denganTransaksi(async (db) => {
    await db.execAsync('DELETE FROM cache; DELETE FROM antrean; DELETE FROM berkas; DELETE FROM meta;');
  });
  await denganDb((db) => db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);')).catch(() => undefined);
}

/** Ukuran berkas basis data di disk (byte), 0 bila tak diketahui. */
export async function ukuranBerkasDb(): Promise<number> {
  try {
    const { File, Paths } = await import('expo-file-system');
    const dir = Paths.document.uri.replace(/\/+$/, '');
    let total = 0;
    for (const akhiran of ['', '-wal']) {
      const f = new File(`${dir}/SQLite/${NAMA_DB}${akhiran}`);
      if (f.exists) {
        total += f.size ?? 0;
      }
    }
    return total;
  } catch {
    return 0;
  }
}
