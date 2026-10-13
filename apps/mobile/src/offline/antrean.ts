/**
 * Antrean tulis offline (outbox).
 *
 * Fitur menaruh perubahan yang dibuat saat offline lewat `enqueue()`; mesin ini
 * menyimpannya di basis data terenkripsi (selamat dari proses yang dimatikan),
 * lalu mengirimnya otomatis begitu jaringan kembali — berurutan per
 * `urutanKunci`, dengan header `Idempotency-Key: <id item>` sehingga kirim ulang
 * (mis. proses mati di tengah jalan) tidak menggandakan data di server.
 *
 * Status item: `menunggu` (akan/ sedang diulang) · `mengirim` (hanya di memori)
 * · `gagal` (batas percobaan habis, perlu "Coba lagi" manual) · `konflik`
 * (server menolak 4xx; pesan server ditampilkan, pengguna memilih ubah/coba
 * lagi/hapus). 401 menjeda seluruh antrean sampai masuk ulang.
 *
 * Pemicu otomatis: jaringan kembali, aplikasi kembali aktif, setelah `enqueue`,
 * dan satu pewaktu (maks. 30 dtk) selama ada item menunggu — tanpa polling saat
 * offline/di latar belakang/antrean kosong.
 *
 * API publik ada di `src/offline/index.ts`; dokumentasi lengkap di
 * `docs/sesi/ponsel-b7-offline.md` (bagian "Aplikasi — fondasi").
 */
import { File, Paths } from 'expo-file-system';
import { AppState } from 'react-native';

import { ApiError, apiRequest, type HasilPermintaan, type RequestOptions } from '@/api/client';

import { denganDb, denganTransaksi } from './db';
import { adalahForeground, adalahOnline, periksaSegera, saatOnline } from './jaringan';
import { buatStore, useStore } from './store';
import { buatUlid } from './ulid';

// ── Tipe publik ──────────────────────────────────────────────────────────────

export type MetodeAntrean = 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type StatusItem = 'menunggu' | 'mengirim' | 'gagal' | 'konflik';

/** Berkas yang ikut dikirim sebagai bagian multipart (selfie, lampiran ≤ 5 MB). */
export interface BerkasMasuk {
  /** Nama field multipart ('selfie', 'file', …). */
  field: string;
  nama: string;
  mime: string;
  /** Sumber: URI berkas lokal (dibaca lalu, bila di folder cache, dihapus)… */
  uri?: string;
  /** …atau byte langsung. */
  bytes?: Uint8Array;
}

export interface BerkasItem {
  id: number;
  field: string;
  nama: string;
  mime: string;
  ukuran: number;
}

export interface MasukanAntrean {
  /** Jenis item; kunci penangan (`daftarkanPenangan`) mis. 'absensi.masuk', 'tugas.komentar'. */
  jenis: string;
  /** Judul di layar Antrean sinkron, mis. "Absen masuk 07.50". */
  label: string;
  /** Baris kedua opsional, mis. 'GPS di luar radius · selfie 180 KB'. */
  ringkas?: string;
  method: MetodeAntrean;
  /** Path relatif API ('tugas/12/komentar'). */
  path: string;
  json?: unknown;
  /** Bagian teks multipart (dipakai bersama `berkas`). */
  formFields?: Record<string, string>;
  berkas?: BerkasMasuk[];
  /** Id klien = `Idempotency-Key`. Bawaan: ULID baru. Beri sendiri bila id itu juga dipakai sebagai id sementara di UI. */
  clientId?: string;
  /** Item dengan kunci sama dijalankan satu per satu menurut urutan masuk. Bawaan: `jenis`. */
  urutanKunci?: string;
  /** Item menunggu/konflik/gagal dengan kunci ini digantikan (hasil akhir menang), mis. `tugas:12:status`. */
  dedupeKunci?: string;
  /** JSON bebas milik fitur (id sementara, id tugas, dll.). */
  meta?: Record<string, unknown>;
  /** Waktu kejadian di perangkat (ISO atau Date). Bawaan: sekarang. */
  dibuatPada?: string | Date;
  /** Bila terisi, item lebih tua dari ini tidak dikirim otomatis (status konflik). Mis. 72 untuk absensi. */
  kedaluwarsaJam?: number;
  /** Nama field yang diisi `dibuatPada` saat dikirim (mis. 'offline_at'), di json atau formFields. */
  waktuOfflineKey?: string;
  /** Hapus berkas sumber (`uri`) setelah disalin ke antrean. Bawaan: true bila berada di folder cache. */
  hapusSumber?: boolean;
}

export interface GalatItem {
  pesan: string;
  status: number | null;
  kode: string | null;
}

export interface ItemAntrean {
  id: string;
  /** Nilai header `Idempotency-Key`. Sama dengan `id` sampai item `konflik` dicoba ulang (kunci baru; server memutar ulang penolakan 4xx dengan kunci yang sama). */
  kunciIdem: string;
  seq: number;
  jenis: string;
  label: string;
  ringkas: string | null;
  method: MetodeAntrean;
  path: string;
  json: unknown;
  formFields: Record<string, string> | undefined;
  berkas: BerkasItem[];
  urutanKunci: string;
  dedupeKunci: string | null;
  meta: Record<string, unknown>;
  /** ISO waktu kejadian di perangkat. */
  dibuatPada: string;
  dibuatMs: number;
  kedaluwarsaJam: number | null;
  waktuOfflineKey: string | null;
  status: StatusItem;
  percobaan: number;
  /** Epoch ms paling awal item boleh dicoba lagi. */
  berikutnya: number;
  galat: GalatItem | null;
}

/** Hasil `bangunPermintaan`: bagian yang menimpa isi tersimpan. */
export interface PermintaanKirim {
  method?: MetodeAntrean;
  path?: string;
  json?: unknown;
  formFields?: Record<string, string>;
}

export interface Penangan {
  /**
   * Dipanggil tepat sebelum kirim. Tulis ulang isi (mis. ganti id sementara
   * dengan id asli dari item sebelumnya) atau kembalikan 'lewati' untuk
   * membuang item tanpa mengirim (sudah tidak relevan).
   */
  bangunPermintaan?: (item: ItemAntrean) => PermintaanKirim | 'lewati' | void | Promise<PermintaanKirim | 'lewati' | void>;
  /** Berhasil dikirim (item sudah dihapus dari antrean). Perbarui state lokal/ganti id sementara di sini. */
  sesudahSukses?: (item: ItemAntrean, respons: unknown, info: { replayed: boolean }) => void | Promise<void>;
  /** Ditolak server (4xx) atau kedaluwarsa; item tetap di antrean berstatus `konflik`. */
  sesudahKonflik?: (item: ItemAntrean, galat: GalatItem) => void | Promise<void>;
  /** Pengguna menghapus item dari layar Antrean sinkron: kembalikan state lokal optimistis. */
  sesudahDibuang?: (item: ItemAntrean) => void | Promise<void>;
  /** Mengaktifkan tombol "Ubah" di layar Antrean sinkron (buka layar ubah; simpan lewat `cobaLagi(id, patch)`). */
  ubah?: (item: ItemAntrean) => void;
  /** Teks snackbar saat item ini tersinkron, mis. "Absen masuk 07.52 tersinkron" (bila semua item putaran punya pesan khusus, pesan ini menggantikan "N item tersinkron"). */
  pesanSukses?: (item: ItemAntrean) => string | null;
  /** Catatan kecil di baris Antrean sinkron (mis. peringatan "hampir 72 jam"). */
  catatan?: (item: ItemAntrean) => { teks: string; nada: 'info' | 'warn' | 'bad' } | null;
  /** Tombol tambahan di baris yang `konflik` (mis. "Ajukan koreksi absensi"). */
  aksiKonflik?: (item: ItemAntrean, galat: GalatItem) => { label: string; onPress: () => void } | null;
}

export type PeristiwaAntrean =
  | { tipe: 'diantrekan'; item: ItemAntrean }
  | { tipe: 'sukses'; item: ItemAntrean; respons: unknown }
  | { tipe: 'konflik'; item: ItemAntrean; galat: GalatItem }
  | { tipe: 'dibuang'; item: ItemAntrean }
  /** Satu putaran sinkron selesai (tidak ada lagi yang bisa dikirim sekarang). */
  | { tipe: 'selesai'; sukses: number; konflik: number };

export interface PatchItem {
  label?: string;
  ringkas?: string | null;
  path?: string;
  json?: unknown;
  formFields?: Record<string, string>;
  meta?: Record<string, unknown>;
}

export interface StateAntrean {
  /** Antrean sudah dimuat dari basis data untuk pengguna aktif. */
  siap: boolean;
  /** Urut waktu masuk (seq). Referensi baru tiap perubahan. */
  items: readonly ItemAntrean[];
  /** Ada item yang sedang dikirim. */
  sinkron: boolean;
  /** Epoch ms putaran sinkron sukses terakhir. */
  terakhirSinkron: number | null;
  /** Dijeda karena 401 (sesi berakhir) — lanjut otomatis setelah masuk ulang. */
  jeda: boolean;
}

// ── Konstanta ────────────────────────────────────────────────────────────────

const MAKS_PARALEL = 2;
const MAKS_PERCOBAAN = 12;
const BACKOFF_AWAL_MS = 5000;
const BACKOFF_MAKS_MS = 15 * 60_000;
const TICK_MAKS_MS = 30_000;
const MAKS_BERKAS_BYTE = 5 * 1024 * 1024;
const MAKS_TOTAL_BERKAS_BYTE = 20 * 1024 * 1024;

// ── State ────────────────────────────────────────────────────────────────────

const store = buatStore<StateAntrean>({ siap: false, items: [], sinkron: false, terakhirSinkron: null, jeda: false });
const penangan = new Map<string, Penangan>();
const pendengar = new Set<(p: PeristiwaAntrean) => void>();

let uidAntrean: string | null = null;
let muatPromise: Promise<void> | null = null;
let daftarMemori: ItemAntrean[] = [];
const sedangJalan = new Set<string>();
let suksesRun = 0;
let konflikRun = 0;
let timerBerikut: ReturnType<typeof setTimeout> | null = null;
let hentikanPemicu: (() => void) | null = null;

function publikasi(): void {
  const urut = [...daftarMemori].sort((a, b) => a.seq - b.seq);
  store.set((lama) => ({ ...lama, items: urut, sinkron: sedangJalan.size > 0 }));
}

function emit(p: PeristiwaAntrean): void {
  pendengar.forEach((l) => {
    try {
      l(p);
    } catch {
      // Pendengar tidak boleh mengganggu mesin.
    }
  });
}

/** Dengar peristiwa antrean (sukses/konflik/…); mengembalikan fungsi berhenti. */
export function onAntrean(l: (p: PeristiwaAntrean) => void): () => void {
  pendengar.add(l);
  return () => {
    pendengar.delete(l);
  };
}

/** Daftarkan penangan per `jenis` (panggil saat modul fitur dimuat). Mengembalikan fungsi pencabut. */
export function daftarkanPenangan(jenis: string, p: Penangan): () => void {
  penangan.set(jenis, p);
  return () => {
    if (penangan.get(jenis) === p) {
      penangan.delete(jenis);
    }
  };
}

export function penanganUntuk(jenis: string): Penangan | undefined {
  return penangan.get(jenis);
}

/** Hook: state antrean. Beri selector (nilai primitif/referensi stabil) agar tidak merender ulang berlebihan. */
export function useAntrean(): StateAntrean;
export function useAntrean<S>(selector: (s: StateAntrean) => S): S;
export function useAntrean<S>(selector?: (s: StateAntrean) => S): S | StateAntrean {
  return useStore(store, (selector ?? ((s: StateAntrean) => s)) as (s: StateAntrean) => S | StateAntrean);
}

/** Ringkasan untuk lencana/pil: jumlah total, menunggu kirim, dan yang perlu diperiksa pengguna. */
export function useRingkasanAntrean(): { total: number; menunggu: number; perluPeriksa: number; sinkron: boolean } {
  const total = useStore(store, (s) => s.items.length);
  const perluPeriksa = useStore(store, (s) => s.items.reduce((n, i) => n + (i.status === 'konflik' || i.status === 'gagal' ? 1 : 0), 0));
  const sinkron = useStore(store, (s) => s.sinkron);
  return { total, menunggu: total - perluPeriksa, perluPeriksa, sinkron };
}

export function stateAntrean(): StateAntrean {
  return store.get();
}

/** Jumlah item yang belum terkirim (sinkron, tanpa hook) — dipakai dialog keluar akun. */
export function jumlahTertunda(): number {
  return store.get().items.length;
}

export function ambilItem(id: string): ItemAntrean | undefined {
  return daftarMemori.find((i) => i.id === id);
}

/** Cari item menurut predikat (mis. `i => i.jenis === 'tugas.komentar' && i.meta.tugasId === id`). */
export function cariItem(predikat: (i: ItemAntrean) => boolean): ItemAntrean[] {
  return store.get().items.filter(predikat);
}

// ── Baris basis data ↔ item ─────────────────────────────────────────────────

interface BarisAntrean {
  seq: number;
  id: string;
  kunci_idem: string;
  jenis: string;
  label: string;
  ringkas: string | null;
  method: MetodeAntrean;
  path: string;
  json: string | null;
  form_fields: string | null;
  urutan_kunci: string;
  dedupe_kunci: string | null;
  meta: string;
  dibuat: string;
  dibuat_ms: number;
  kedaluwarsa_jam: number | null;
  waktu_offline_key: string | null;
  status: StatusItem;
  percobaan: number;
  berikutnya_ms: number;
  galat_pesan: string | null;
  galat_status: number | null;
  galat_kode: string | null;
}

function parseJson<T>(teks: string | null, awal: T): T {
  if (teks === null) {
    return awal;
  }
  try {
    return JSON.parse(teks) as T;
  } catch {
    return awal;
  }
}

function dariBaris(b: BarisAntrean, berkas: BerkasItem[]): ItemAntrean {
  return {
    id: b.id,
    kunciIdem: b.kunci_idem,
    seq: b.seq,
    jenis: b.jenis,
    label: b.label,
    ringkas: b.ringkas,
    method: b.method,
    path: b.path,
    json: b.json === null ? undefined : parseJson<unknown>(b.json, undefined),
    formFields: b.form_fields === null ? undefined : parseJson<Record<string, string>>(b.form_fields, {}),
    berkas,
    urutanKunci: b.urutan_kunci,
    dedupeKunci: b.dedupe_kunci,
    meta: parseJson<Record<string, unknown>>(b.meta, {}),
    dibuatPada: b.dibuat,
    dibuatMs: b.dibuat_ms,
    kedaluwarsaJam: b.kedaluwarsa_jam,
    waktuOfflineKey: b.waktu_offline_key,
    status: b.status === 'mengirim' ? 'menunggu' : b.status,
    percobaan: b.percobaan,
    berikutnya: b.berikutnya_ms,
    galat: b.galat_pesan === null ? null : { pesan: b.galat_pesan, status: b.galat_status, kode: b.galat_kode },
  };
}

async function simpanKeadaan(item: ItemAntrean): Promise<void> {
  const status = item.status === 'mengirim' ? 'menunggu' : item.status;
  await denganDb((db) =>
    db.runAsync(
      `UPDATE antrean SET kunci_idem = ?, status = ?, percobaan = ?, berikutnya_ms = ?, galat_pesan = ?, galat_status = ?, galat_kode = ?,
         label = ?, ringkas = ?, path = ?, json = ?, form_fields = ?, meta = ? WHERE id = ?`,
      item.kunciIdem,
      status,
      item.percobaan,
      item.berikutnya,
      item.galat?.pesan ?? null,
      item.galat?.status ?? null,
      item.galat?.kode ?? null,
      item.label,
      item.ringkas,
      item.path,
      item.json === undefined ? null : JSON.stringify(item.json),
      item.formFields === undefined ? null : JSON.stringify(item.formFields),
      JSON.stringify(item.meta),
      item.id,
    ),
  );
}

function ganti(id: string, bagian: Partial<ItemAntrean>): ItemAntrean | null {
  const i = daftarMemori.findIndex((x) => x.id === id);
  const lama = daftarMemori[i];
  if (i < 0 || !lama) {
    return null;
  }
  const baru = { ...lama, ...bagian };
  daftarMemori = [...daftarMemori.slice(0, i), baru, ...daftarMemori.slice(i + 1)];
  publikasi();
  return baru;
}

async function hapusDariDb(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  await denganTransaksi(async (db) => {
    for (const id of ids) {
      await db.runAsync('DELETE FROM berkas WHERE antrean_id = ?', id);
      await db.runAsync('DELETE FROM antrean WHERE id = ?', id);
    }
  });
}

// ── Siklus hidup ─────────────────────────────────────────────────────────────

/**
 * Mulai antrean untuk pengguna `uid`: muat dari basis data, buang item milik
 * pengguna lain, lanjutkan bila sebelumnya dijeda karena 401, lalu coba kirim.
 * Aman dipanggil berulang untuk uid yang sama.
 */
export function mulaiAntrean(uid: string): Promise<void> {
  if (uidAntrean === uid && muatPromise) {
    store.set((lama) => (lama.jeda ? { ...lama, jeda: false } : lama));
    picu();
    return muatPromise;
  }
  uidAntrean = uid;
  daftarMemori = [];
  store.set({ siap: false, items: [], sinkron: false, terakhirSinkron: null, jeda: false });
  const janji = (async () => {
    const { baris, berkas, terakhir } = await denganTransaksi(async (db) => {
      const asing = await db.getAllAsync<{ id: string }>('SELECT id FROM antrean WHERE uid <> ?', uid);
      for (const a of asing) {
        await db.runAsync('DELETE FROM berkas WHERE antrean_id = ?', a.id);
      }
      await db.runAsync('DELETE FROM antrean WHERE uid <> ?', uid);
      await db.runAsync("UPDATE antrean SET status = 'menunggu' WHERE uid = ? AND status = 'mengirim'", uid);
      const b = await db.getAllAsync<BarisAntrean>('SELECT * FROM antrean WHERE uid = ? ORDER BY seq ASC', uid);
      const f = await db.getAllAsync<BerkasItem & { antrean_id: string }>('SELECT id, antrean_id, field, nama, mime, ukuran FROM berkas');
      const m = await db.getFirstAsync<{ v: string }>('SELECT v FROM meta WHERE k = ?', `terakhir_sinkron:${uid}`);
      return { baris: b, berkas: f, terakhir: m ? Number(m.v) : null };
    });
    if (uidAntrean !== uid) {
      return;
    }
    daftarMemori = baris.map((b) =>
      dariBaris(
        b,
        berkas.filter((f) => f.antrean_id === b.id).map(({ id, field, nama, mime, ukuran }) => ({ id, field, nama, mime, ukuran })),
      ),
    );
    store.set((lama) => ({ ...lama, siap: true, terakhirSinkron: Number.isFinite(terakhir) ? terakhir : null }));
    publikasi();
    pasangPemicu();
    picu();
  })();
  muatPromise = janji;
  janji.catch(() => {
    if (muatPromise === janji) {
      muatPromise = null;
      uidAntrean = null;
    }
  });
  return janji;
}

/** Hentikan mesin dan kosongkan memori; isi basis data TIDAK dihapus (item tetap utuh untuk masuk berikutnya). */
export function hentikanAntrean(): void {
  hentikanPemicu?.();
  hentikanPemicu = null;
  if (timerBerikut) {
    clearTimeout(timerBerikut);
    timerBerikut = null;
  }
  uidAntrean = null;
  muatPromise = null;
  daftarMemori = [];
  sedangJalan.clear();
  suksesRun = 0;
  konflikRun = 0;
  store.set({ siap: false, items: [], sinkron: false, terakhirSinkron: null, jeda: false });
}

/** Hapus SEMUA item antrean dan berkasnya (keluar akun). */
export async function hapusSemuaAntrean(): Promise<void> {
  hentikanAntrean();
  await denganTransaksi(async (db) => {
    await db.execAsync('DELETE FROM berkas; DELETE FROM antrean; DELETE FROM meta;');
  });
}

async function pastikanSiap(): Promise<void> {
  if (!uidAntrean || !muatPromise) {
    throw new Error('Antrean offline belum siap: belum ada sesi masuk.');
  }
  await muatPromise;
}

function pasangPemicu(): void {
  hentikanPemicu?.();
  const lepasOnline = saatOnline(() => picu());
  const lepasApp = AppState.addEventListener('change', (s) => {
    if (s === 'active') {
      picu();
    }
  });
  hentikanPemicu = () => {
    lepasOnline();
    lepasApp.remove();
  };
}

// ── Antre ────────────────────────────────────────────────────────────────────

async function bacaBerkasMasuk(daftar: BerkasMasuk[], hapusSumber: boolean | undefined): Promise<{ field: string; nama: string; mime: string; data: Uint8Array }[]> {
  const hasil: { field: string; nama: string; mime: string; data: Uint8Array }[] = [];
  let total = 0;
  for (const b of daftar) {
    let data = b.bytes;
    if (!data) {
      if (!b.uri) {
        throw new Error(`Berkas "${b.nama}" tidak punya uri atau bytes.`);
      }
      data = await new File(b.uri).bytes();
      const bersihkan = hapusSumber ?? b.uri.startsWith(Paths.cache.uri);
      if (bersihkan) {
        try {
          new File(b.uri).delete();
        } catch {
          // Berkas sumber sudah hilang — abaikan.
        }
      }
    }
    if (data.byteLength > MAKS_BERKAS_BYTE) {
      throw new Error(`Berkas "${b.nama}" lebih dari 5 MB dan tidak bisa diantrekan.`);
    }
    total += data.byteLength;
    if (total > MAKS_TOTAL_BERKAS_BYTE) {
      throw new Error('Total lampiran antrean melebihi 20 MB.');
    }
    hasil.push({ field: b.field, nama: b.nama, mime: b.mime, data });
  }
  return hasil;
}

/**
 * Simpan perubahan ke antrean dan (bila online) segera coba kirim.
 * Mengembalikan item yang tersimpan. Melempar bila belum ada sesi, berkas
 * terlalu besar, atau basis data gagal — fitur harus menampilkan galat itu.
 */
export async function enqueue(masukan: MasukanAntrean): Promise<ItemAntrean> {
  await pastikanSiap();
  const uid = uidAntrean as string;
  const id = masukan.clientId ?? buatUlid();
  if (ambilItem(id)) {
    throw new Error(`Item antrean ${id} sudah ada.`);
  }
  const berkasData = await bacaBerkasMasuk(masukan.berkas ?? [], masukan.hapusSumber);
  const dibuat = masukan.dibuatPada === undefined ? new Date() : new Date(masukan.dibuatPada);
  const dibuatIso = dibuat.toISOString();
  const urutanKunci = masukan.urutanKunci ?? masukan.jenis;
  const dedupe = masukan.dedupeKunci ?? null;
  const diganti = dedupe === null ? [] : daftarMemori.filter((i) => i.dedupeKunci === dedupe && i.status !== 'mengirim').map((i) => i.id);

  const seq = await denganTransaksi(async (db) => {
    for (const lama of diganti) {
      await db.runAsync('DELETE FROM berkas WHERE antrean_id = ?', lama);
      await db.runAsync('DELETE FROM antrean WHERE id = ?', lama);
    }
    const r = await db.runAsync(
      `INSERT INTO antrean (id, kunci_idem, uid, jenis, label, ringkas, method, path, json, form_fields, urutan_kunci, dedupe_kunci, meta, dibuat, dibuat_ms, kedaluwarsa_jam, waktu_offline_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      id,
      uid,
      masukan.jenis,
      masukan.label,
      masukan.ringkas ?? null,
      masukan.method,
      masukan.path,
      masukan.json === undefined ? null : JSON.stringify(masukan.json),
      masukan.formFields === undefined ? null : JSON.stringify(masukan.formFields),
      urutanKunci,
      dedupe,
      JSON.stringify(masukan.meta ?? {}),
      dibuatIso,
      dibuat.getTime(),
      masukan.kedaluwarsaJam ?? null,
      masukan.waktuOfflineKey ?? null,
    );
    for (const b of berkasData) {
      await db.runAsync('INSERT INTO berkas (antrean_id, field, nama, mime, ukuran, data) VALUES (?, ?, ?, ?, ?, ?)', id, b.field, b.nama, b.mime, b.data.byteLength, b.data);
    }
    return r.lastInsertRowId;
  });

  const berkasMeta: BerkasItem[] = berkasData.map((b, n) => ({ id: -(n + 1), field: b.field, nama: b.nama, mime: b.mime, ukuran: b.data.byteLength }));
  const item: ItemAntrean = {
    id,
    kunciIdem: id,
    seq,
    jenis: masukan.jenis,
    label: masukan.label,
    ringkas: masukan.ringkas ?? null,
    method: masukan.method,
    path: masukan.path,
    json: masukan.json,
    formFields: masukan.formFields,
    berkas: berkasMeta,
    urutanKunci,
    dedupeKunci: dedupe,
    meta: masukan.meta ?? {},
    dibuatPada: dibuatIso,
    dibuatMs: dibuat.getTime(),
    kedaluwarsaJam: masukan.kedaluwarsaJam ?? null,
    waktuOfflineKey: masukan.waktuOfflineKey ?? null,
    status: 'menunggu',
    percobaan: 0,
    berikutnya: 0,
    galat: null,
  };
  daftarMemori = [...daftarMemori.filter((i) => !diganti.includes(i.id)), item];
  publikasi();
  emit({ tipe: 'diantrekan', item });
  picu();
  return item;
}

// ── Aksi pengguna ────────────────────────────────────────────────────────────

/** Ubah isi item yang belum dikirim tanpa mengubah statusnya. Mengembalikan false bila item tak ada/sedang dikirim. */
export async function perbaruiItem(id: string, patch: PatchItem): Promise<boolean> {
  const item = ambilItem(id);
  if (!item || sedangJalan.has(id)) {
    return false;
  }
  const baru = ganti(id, {
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.ringkas !== undefined ? { ringkas: patch.ringkas } : {}),
    ...(patch.path !== undefined ? { path: patch.path } : {}),
    ...(patch.json !== undefined ? { json: patch.json } : {}),
    ...(patch.formFields !== undefined ? { formFields: patch.formFields } : {}),
    ...(patch.meta !== undefined ? { meta: patch.meta } : {}),
  });
  if (baru) {
    await simpanKeadaan(baru);
  }
  return baru !== null;
}

/** Ubah (opsional) lalu antre ulang item yang `konflik`/`gagal`/menunggu: percobaan di-nol-kan dan langsung dicoba. */
export async function cobaLagi(id: string, patch?: PatchItem): Promise<boolean> {
  const item = ambilItem(id);
  if (!item || sedangJalan.has(id)) {
    return false;
  }
  if (patch) {
    await perbaruiItem(id, patch);
  }
  // Penolakan 4xx deterministik diputar ulang server untuk kunci yang sama → konflik dicoba ulang dengan kunci baru.
  const baru = ganti(id, { status: 'menunggu', percobaan: 0, berikutnya: 0, galat: null, ...(item.status === 'konflik' ? { kunciIdem: buatUlid() } : {}) });
  if (baru) {
    await simpanKeadaan(baru);
  }
  picu();
  return baru !== null;
}

/** Buang item (dan berkasnya) dari antrean; memanggil `sesudahDibuang`. False bila sedang dikirim. */
export async function hapusItem(id: string): Promise<boolean> {
  const item = ambilItem(id);
  if (!item || sedangJalan.has(id)) {
    return false;
  }
  daftarMemori = daftarMemori.filter((i) => i.id !== id);
  publikasi();
  await hapusDariDb([id]);
  emit({ tipe: 'dibuang', item });
  try {
    await penangan.get(item.jenis)?.sesudahDibuang?.(item);
  } catch {
    // Pemulihan state lokal milik fitur tidak boleh menggagalkan penghapusan.
  }
  picu();
  return true;
}

/**
 * Tulis ulang item yang masih menunggu (belum dikirim) — untuk mengganti id
 * sementara dengan id asli setelah item sebelumnya berhasil. `ubah` mengembalikan
 * patch atau null (lewati).
 */
export async function tulisUlangMenunggu(predikat: (i: ItemAntrean) => boolean, ubah: (i: ItemAntrean) => PatchItem | null): Promise<number> {
  let n = 0;
  for (const item of store.get().items) {
    if (item.status === 'mengirim' || !predikat(item)) {
      continue;
    }
    const patch = ubah(item);
    if (patch && (await perbaruiItem(item.id, patch))) {
      n += 1;
    }
  }
  return n;
}

/**
 * "Sinkronkan sekarang": abaikan masa tunggu backoff, periksa jangkauan server,
 * lalu kirim. Mengembalikan false bila masih offline.
 */
export async function sinkronkanSekarang(): Promise<boolean> {
  for (const i of daftarMemori) {
    if (i.status === 'menunggu' && i.berikutnya > 0) {
      ganti(i.id, { berikutnya: 0 });
    }
  }
  const online = adalahOnline() || (await periksaSegera());
  if (online) {
    picu();
  }
  return online;
}

/** Berkas biner sebuah item (untuk kirim atau pratinjau). */
export async function bacaBerkasItem(id: string): Promise<{ id: number; field: string; nama: string; mime: string; ukuran: number; data: Uint8Array }[]> {
  return denganDb((db) => db.getAllAsync('SELECT id, field, nama, mime, ukuran, data FROM berkas WHERE antrean_id = ? ORDER BY id ASC', id));
}

// ── Mesin kirim ──────────────────────────────────────────────────────────────

function backoffMs(percobaan: number): number {
  const dasar = Math.min(BACKOFF_MAKS_MS, BACKOFF_AWAL_MS * 2 ** Math.max(0, percobaan - 1));
  return Math.round(dasar * (0.8 + Math.random() * 0.4));
}

function bolehJalan(): boolean {
  const s = store.get();
  return s.siap && !s.jeda && uidAntrean !== null && adalahOnline() && adalahForeground();
}

/** Pilih dan mulai item yang siap; atur pewaktu berikutnya. Aman dipanggil kapan saja & berulang. */
export function picu(): void {
  if (timerBerikut) {
    clearTimeout(timerBerikut);
    timerBerikut = null;
  }
  if (!bolehJalan()) {
    return;
  }
  const sekarang = Date.now();
  const terblokir = new Set<string>();
  const kunciJalan = new Set<string>();
  for (const i of daftarMemori) {
    if (sedangJalan.has(i.id)) {
      kunciJalan.add(i.urutanKunci);
    }
  }
  let berikutnyaTerdekat: number | null = null;
  const mulai: ItemAntrean[] = [];
  for (const item of store.get().items) {
    if (terblokir.has(item.urutanKunci)) {
      continue;
    }
    terblokir.add(item.urutanKunci); // item berikutnya dengan kunci sama menunggu yang ini selesai
    if (item.status !== 'menunggu' || sedangJalan.has(item.id) || kunciJalan.has(item.urutanKunci)) {
      continue;
    }
    if (item.berikutnya > sekarang) {
      berikutnyaTerdekat = berikutnyaTerdekat === null ? item.berikutnya : Math.min(berikutnyaTerdekat, item.berikutnya);
      continue;
    }
    if (sedangJalan.size + mulai.length < MAKS_PARALEL) {
      mulai.push(item);
    }
  }
  for (const item of mulai) {
    void kerjakan(item);
  }
  if (sedangJalan.size === 0) {
    selesaiPutaran();
  }
  // Pewaktu: hanya bila masih ada yang menunggu giliran (backoff / paralel penuh).
  const adaMenunggu = berikutnyaTerdekat !== null || mulai.length > 0 || sedangJalan.size > 0;
  if (adaMenunggu) {
    const tunggu = berikutnyaTerdekat === null ? TICK_MAKS_MS : Math.min(TICK_MAKS_MS, Math.max(1000, berikutnyaTerdekat - sekarang));
    timerBerikut = setTimeout(() => {
      timerBerikut = null;
      picu();
    }, tunggu);
  }
}

function selesaiPutaran(): void {
  if (suksesRun === 0 && konflikRun === 0) {
    return;
  }
  const sukses = suksesRun;
  const konflik = konflikRun;
  suksesRun = 0;
  konflikRun = 0;
  if (sukses > 0 && uidAntrean) {
    const sekarang = Date.now();
    store.set((lama) => ({ ...lama, terakhirSinkron: sekarang }));
    void denganDb((db) => db.runAsync('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', `terakhir_sinkron:${uidAntrean}`, String(sekarang))).catch(() => undefined);
  }
  emit({ tipe: 'selesai', sukses, konflik });
}

async function susunFormData(item: ItemAntrean, formFields: Record<string, string> | undefined): Promise<FormData> {
  const form = new FormData();
  for (const [k, v] of Object.entries(formFields ?? {})) {
    form.append(k, v);
  }
  if (item.berkas.length > 0) {
    for (const b of await bacaBerkasItem(item.id)) {
      // `bytes()` dibaca fetch Expo; `uri` semu dibutuhkan FormData React Native.
      form.append(b.field, { uri: `offline://${item.id}/${b.nama}`, name: b.nama, type: b.mime, bytes: () => Promise.resolve(b.data) } as unknown as Blob);
    }
  }
  return form;
}

function suntikWaktuOffline(item: ItemAntrean, json: unknown, formFields: Record<string, string> | undefined): { json: unknown; formFields: Record<string, string> | undefined } {
  const kunci = item.waktuOfflineKey;
  if (!kunci) {
    return { json, formFields };
  }
  if (formFields !== undefined || item.berkas.length > 0) {
    return { json, formFields: { ...(formFields ?? {}), [kunci]: item.dibuatPada } };
  }
  if (json !== null && typeof json === 'object' && !Array.isArray(json)) {
    return { json: { ...(json as Record<string, unknown>), [kunci]: item.dibuatPada }, formFields };
  }
  return { json: json === undefined ? { [kunci]: item.dibuatPada } : json, formFields };
}

async function kerjakan(awal: ItemAntrean): Promise<void> {
  sedangJalan.add(awal.id);
  ganti(awal.id, { status: 'mengirim' });
  let item = ambilItem(awal.id) ?? awal;
  try {
    if (item.kedaluwarsaJam !== null && Date.now() - item.dibuatMs > item.kedaluwarsaJam * 3_600_000) {
      await jadikanKonflik(item, { pesan: `Perubahan ini sudah lebih dari ${item.kedaluwarsaJam} jam dan tidak dikirim otomatis. Periksa lalu kirim ulang atau hapus.`, status: null, kode: 'kedaluwarsa' });
      return;
    }
    const p = penangan.get(item.jenis);
    let req: PermintaanKirim = { method: item.method, path: item.path, json: item.json, formFields: item.formFields };
    if (p?.bangunPermintaan) {
      const o = await p.bangunPermintaan(item);
      if (o === 'lewati') {
        await selesai(item, null, false);
        return;
      }
      if (o) {
        req = { ...req, ...o };
      }
    }
    const { json, formFields } = suntikWaktuOffline(item, req.json, req.formFields);
    const hasil: HasilPermintaan = {};
    const opsi: RequestOptions = { method: req.method ?? item.method, idempotencyKey: item.kunciIdem, cache: false, hasil, timeoutMs: 60_000 };
    if (formFields !== undefined || item.berkas.length > 0) {
      opsi.form = await susunFormData(item, formFields);
    } else if (json !== undefined) {
      opsi.json = json;
    }
    const respons = await apiRequest<unknown>(req.path ?? item.path, opsi);
    item = ambilItem(item.id) ?? item;
    await selesai(item, respons, hasil.replayed === true);
  } catch (galat) {
    await tanganiGalat(ambilItem(awal.id) ?? item, galat);
  } finally {
    sedangJalan.delete(awal.id);
    publikasi();
    picu();
  }
}

async function selesai(item: ItemAntrean, respons: unknown, replayed: boolean): Promise<void> {
  daftarMemori = daftarMemori.filter((i) => i.id !== item.id);
  await hapusDariDb([item.id]).catch(() => undefined);
  suksesRun += 1;
  publikasi();
  emit({ tipe: 'sukses', item, respons });
  try {
    await penangan.get(item.jenis)?.sesudahSukses?.(item, respons, { replayed });
  } catch {
    // Pembaruan state lokal milik fitur tidak boleh membatalkan item yang sudah terkirim.
  }
}

async function jadikanKonflik(item: ItemAntrean, galat: GalatItem): Promise<void> {
  const baru = ganti(item.id, { status: 'konflik', galat, berikutnya: 0 });
  if (baru) {
    await simpanKeadaan(baru).catch(() => undefined);
  }
  konflikRun += 1;
  emit({ tipe: 'konflik', item: baru ?? item, galat });
  try {
    await penangan.get(item.jenis)?.sesudahKonflik?.(baru ?? item, galat);
  } catch {
    // Diabaikan.
  }
}

async function tanganiGalat(item: ItemAntrean, galat: unknown): Promise<void> {
  if (!(galat instanceof ApiError)) {
    // Galat tak terduga (mis. di bangunPermintaan): coba lagi dengan backoff, dihitung sebagai percobaan.
    await jadwalUlang(item, { pesan: galat instanceof Error ? galat.message : 'Terjadi galat tak terduga.', status: null, kode: 'tak_terduga' }, true);
    return;
  }
  if (galat.status === 0) {
    // Jaringan: bukan salah item. Coba lagi segera setelah jaringan kembali (pemicu online) atau dalam 10 dtk.
    const baru = ganti(item.id, { status: 'menunggu', berikutnya: Date.now() + 10_000 });
    if (baru) {
      await simpanKeadaan(baru).catch(() => undefined);
    }
    return;
  }
  if (galat.status === 401) {
    store.set((lama) => ({ ...lama, jeda: true }));
    const baru = ganti(item.id, { status: 'menunggu', berikutnya: 0 });
    if (baru) {
      await simpanKeadaan(baru).catch(() => undefined);
    }
    return;
  }
  const sementara =
    galat.status === 408 ||
    galat.status === 425 ||
    galat.status === 429 ||
    galat.status >= 500 ||
    galat.reason === 'idempotency_in_progress' ||
    galat.code === 'idempotency_in_progress';
  if (sementara) {
    await jadwalUlang(item, { pesan: galat.message, status: galat.status, kode: galat.reason ?? galat.code }, true, galat.retryAfter);
    return;
  }
  await jadikanKonflik(item, { pesan: galat.message, status: galat.status, kode: galat.reason ?? galat.code });
}

async function jadwalUlang(item: ItemAntrean, galat: GalatItem, hitung: boolean, retryAfter: number | null = null): Promise<void> {
  const percobaan = item.percobaan + (hitung ? 1 : 0);
  if (percobaan >= MAKS_PERCOBAAN) {
    const baru = ganti(item.id, {
      status: 'gagal',
      percobaan,
      galat: { ...galat, pesan: `${galat.pesan} (gagal setelah ${percobaan} percobaan — tekan "Coba lagi")` },
      berikutnya: 0,
    });
    if (baru) {
      await simpanKeadaan(baru).catch(() => undefined);
    }
    konflikRun += 1;
    emit({ tipe: 'konflik', item: baru ?? item, galat });
    return;
  }
  const tunggu = Math.max(backoffMs(percobaan), (retryAfter ?? 0) * 1000);
  const baru = ganti(item.id, { status: 'menunggu', percobaan, galat, berikutnya: Date.now() + tunggu });
  if (baru) {
    await simpanKeadaan(baru).catch(() => undefined);
  }
}
