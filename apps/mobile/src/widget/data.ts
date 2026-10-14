/**
 * Pengambilan data widget di proses TANPA UI (task headless pustaka widget) maupun
 * di dalam aplikasi (saat `requestWidgetUpdate` dipanggil dari aplikasi).
 *
 * - Token & uid dibaca dari SecureStore (`bacaTokenTersimpan`) lalu dipasang sebagai
 *   token sementara klien API (pola `src/offline/latarKerja.ts`); getter sesi React,
 *   bila ada, tetap didahulukan. Token tidak ditulis ke tempat baru.
 * - Permintaan memakai `senyap: true` (401/426/503 tidak memicu dialog atau keluar akun
 *   dari proses tanpa layar) dan `cache: false` (tidak menyentuh keadaan cache baca
 *   aplikasi); salinan "data lama" disimpan sendiri di `meta` (`setelan.ts`).
 * - Hasil memo 15 detik per permintaan: tiga widget yang diperbarui bersamaan memakai
 *   satu panggilan `absensi/hari-ini`, `tugas/hari-ini`, dst.
 *
 * Endpoint (semua sudah ada, tanpa perubahan backend): GET absensi/hari-ini,
 * GET tugas/hari-ini, GET tugas?scope=ditugaskan&tenggat=overdue, GET rapat?rentang=…
 */
import type { HariIni } from '@/api/absensi';
import { ApiError, apiRequest, setTokenSementara, tokenSaatIni } from '@/api/client';
import type { MeetingAgenda } from '@/api/types';
import { denganDb } from '@/offline/db';
import { sesiDitolak } from '@/offline/latarMeta';
import { bacaTokenTersimpan } from '@/session/tokenTersimpan';

import {
  pilihRapat,
  type ItemAntreAbsen,
  type MasukanCheckIn,
  type MasukanRapat,
  type MasukanTugas,
  type SetelanTugas,
  type TugasHariIniApi,
  type TugasTerlambatApi,
} from './keadaan';
import { bacaSnap, simpanSnap } from './setelan';

const BATAS_WAKTU_MS = 12_000;
const MEMO_MS = 15_000;

export interface Sesi {
  uid: string;
}

/** Hasil satu pengambilan: data segar, salinan lama, atau alasan gagal. */
export interface Ambil<T> {
  data: T | null;
  /** Data = salinan lama (jaringan/server gagal). */
  dariCache: boolean;
  /** Epoch ms data dimuat dari server (segar: sekarang). */
  ts: number | null;
  status: 'ok' | 'lama' | 'sesi' | 'mati' | 'gagal';
}

// ── Sesi sementara ───────────────────────────────────────────────────────────

let pemakai = 0;
let pakaiTokenSementara = false;

/** Jalankan `fn` dengan token sesi tersimpan terpasang; null bila tak ada sesi / sesi ditolak server. */
export async function denganSesi<T>(fn: (sesi: Sesi) => Promise<T>): Promise<T | null> {
  const tersimpan = await bacaTokenTersimpan();
  if (tersimpan === null) {
    return null;
  }
  try {
    if (await sesiDitolak(tersimpan.uid)) {
      return null;
    }
  } catch {
    // Basis data tak terbaca: tetap coba; 401 dari server yang memutuskan.
  }
  pemakai += 1;
  if (pemakai === 1 && tokenSaatIni() === null) {
    setTokenSementara(tersimpan.token);
    pakaiTokenSementara = true;
  }
  try {
    return await fn({ uid: tersimpan.uid });
  } finally {
    pemakai -= 1;
    if (pemakai === 0 && pakaiTokenSementara) {
      setTokenSementara(null);
      pakaiTokenSementara = false;
    }
  }
}

// ── Pengambilan + memo ───────────────────────────────────────────────────────

const memo = new Map<string, { t: number; p: Promise<Ambil<unknown>> }>();

async function ambilBaru<T>(uid: string, nama: string, path: string, query: Record<string, string | number> | undefined, fiturOpsional: boolean): Promise<Ambil<T>> {
  try {
    const data = await apiRequest<T>(path, { query, cache: false, senyap: true, timeoutMs: BATAS_WAKTU_MS });
    if (data === null) {
      return { data: null, dariCache: false, ts: null, status: 'gagal' };
    }
    const ts = Date.now();
    void simpanSnap(uid, nama, data, ts);
    return { data, dariCache: false, ts, status: 'ok' };
  } catch (galat) {
    if (galat instanceof ApiError) {
      if (galat.status === 401) {
        return { data: null, dariCache: false, ts: null, status: 'sesi' };
      }
      if (fiturOpsional && galat.status === 404) {
        return { data: null, dariCache: false, ts: null, status: 'mati' };
      }
    }
    const snap = await bacaSnap<T>(uid, nama);
    return snap ? { data: snap.data, dariCache: true, ts: snap.ts, status: 'lama' } : { data: null, dariCache: false, ts: null, status: 'gagal' };
  }
}

function ambil<T>(uid: string, nama: string, path: string, query?: Record<string, string | number>, fiturOpsional = false): Promise<Ambil<T>> {
  const kunci = `${uid}|${nama}`;
  const ada = memo.get(kunci);
  if (ada && Date.now() - ada.t < MEMO_MS) {
    return ada.p as Promise<Ambil<T>>;
  }
  const p = ambilBaru<T>(uid, nama, path, query, fiturOpsional);
  memo.set(kunci, { t: Date.now(), p: p as Promise<Ambil<unknown>> });
  return p;
}

/** Lupakan memo (segarkan paksa dari ketukan pengguna / perubahan data di aplikasi). */
export function lupakanMemo(): void {
  memo.clear();
}

// ── Antrean absen ────────────────────────────────────────────────────────────

/** Item antrean absen (`jenis` `absensi.*`) yang belum terkirim — dari tabel `antrean` langsung (mesin antrean tidak berjalan di proses tanpa UI). */
export async function bacaAntreAbsen(uid: string): Promise<ItemAntreAbsen[]> {
  try {
    const baris = await denganDb((db) =>
      db.getAllAsync<{ jenis: string; dibuat: string }>("SELECT jenis, dibuat FROM antrean WHERE uid = ? AND jenis LIKE 'absensi.%' AND status IN ('menunggu', 'mengirim') ORDER BY seq", uid),
    );
    return baris.map((b) => ({ arah: b.jenis.startsWith('absensi.pulang') ? 'pulang' : 'masuk', waktu: b.dibuat }));
  } catch {
    return [];
  }
}

// ── Masukan keadaan ──────────────────────────────────────────────────────────

const TANPA_SESI_ABSEN = (sekarang: number): MasukanCheckIn => ({ sekarang, adaSesi: false, absen: null, dariCache: false, cachedAt: null, antre: [] });

export async function muatCheckIn(sekarang: number): Promise<MasukanCheckIn> {
  const hasil = await denganSesi(async ({ uid }) => {
    const [absen, antre] = await Promise.all([ambil<HariIni>(uid, 'absen', 'absensi/hari-ini'), bacaAntreAbsen(uid)]);
    return { absen, antre };
  });
  if (hasil === null || hasil.absen.status === 'sesi') {
    return TANPA_SESI_ABSEN(sekarang);
  }
  return { sekarang, adaSesi: true, absen: hasil.absen.data, dariCache: hasil.absen.dariCache, cachedAt: hasil.absen.ts, antre: hasil.antre };
}

interface HalamanTugas {
  tasks: TugasTerlambatApi[];
}

export async function muatTugas(setelan: SetelanTugas, sekarang: number): Promise<MasukanTugas> {
  const hasil = await denganSesi(async ({ uid }) => {
    const [hari, telat] = await Promise.all([
      ambil<TugasHariIniApi>(uid, 'tugas-hari', 'tugas/hari-ini'),
      ambil<HalamanTugas>(uid, 'tugas-terlambat', 'tugas', { scope: 'ditugaskan', tenggat: 'overdue', selesai: 'tidak', urut: 'tenggat', arah: 'asc', per_page: 6 }),
    ]);
    return { hari, telat };
  });
  if (hasil === null || hasil.hari.status === 'sesi') {
    return { sekarang, adaSesi: false, hari: null, terlambat: [], dariCache: false, cachedAt: null, setelan };
  }
  return {
    sekarang,
    adaSesi: true,
    hari: hasil.hari.data,
    // Daftar terlambat hanya pelengkap: gagal/kosong → tidak ada baris terlambat, widget tetap tampil.
    terlambat: hasil.telat.data?.tasks ?? [],
    dariCache: hasil.hari.dariCache,
    cachedAt: hasil.hari.ts,
    setelan,
  };
}

export async function muatRapat(sekarang: number): Promise<MasukanRapat> {
  const hasil = await denganSesi(async ({ uid }) => {
    const hariIni = await ambil<MeetingAgenda>(uid, 'rapat-hari-ini', 'rapat', { rentang: 'hari-ini' }, true);
    const perluBerikut = hariIni.status !== 'sesi' && hariIni.status !== 'mati' && hariIni.data !== null && pilihRapat(hariIni.data.items, sekarang) === null;
    const akanDatang = perluBerikut ? await ambil<MeetingAgenda>(uid, 'rapat-akan-datang', 'rapat', { rentang: 'akan-datang' }, true) : null;
    return { hariIni, akanDatang };
  });
  if (hasil === null || hasil.hariIni.status === 'sesi') {
    return { sekarang, adaSesi: false, hariIni: null, akanDatang: null, fiturMati: false, dariCache: false, cachedAt: null };
  }
  return {
    sekarang,
    adaSesi: true,
    hariIni: hasil.hariIni.data?.items ?? null,
    akanDatang: hasil.akanDatang?.data?.items ?? null,
    fiturMati: hasil.hariIni.status === 'mati',
    dariCache: hasil.hariIni.dariCache,
    cachedAt: hasil.hariIni.ts,
  };
}
