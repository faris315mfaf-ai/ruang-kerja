/**
 * Konektivitas untuk mode offline.
 *
 * Dua sinyal digabung:
 *  1. OS (`expo-network`): `terhubung` — ada jaringan (Wi-Fi/seluler) atau tidak.
 *  2. Jangkauan server (`terjangkau`) — dipelajari dari permintaan nyata:
 *     permintaan gagal tanpa jawaban (status 0) menandai server tak terjangkau,
 *     jawaban HTTP apa pun (termasuk 4xx/5xx) menandainya terjangkau lagi.
 *     Selama `terhubung` tapi tak terjangkau, probe murah (`GET /konfigurasi`)
 *     dicoba dengan backoff 3 → 30 detik, hanya saat aplikasi di latar depan.
 *
 * `online = terhubung && terjangkau`. Tidak ada polling saat OS melaporkan tak
 * ada jaringan (menunggu event) atau saat aplikasi di latar belakang.
 *
 * Tidak mengimpor `client.ts` (dipakai olehnya).
 */
import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { API_URL, APP_VERSION } from '@/api/config';

import { buatStore, useStore } from './store';

interface StatusJaringan {
  /** OS: ada jaringan aktif. */
  terhubung: boolean;
  /** Server terjangkau menurut permintaan/probe terakhir. */
  terjangkau: boolean;
}

const store = buatStore<StatusJaringan>({ terhubung: true, terjangkau: true });

let terakhirOnlineMs: number | null = null;
let gagalSejakMs: number | null = null;
let mulai = false;
let foreground = AppState.currentState === 'active';
let timerProbe: ReturnType<typeof setTimeout> | null = null;
let backoffProbe = 3000;
let probeBerjalan: Promise<boolean> | null = null;
let terakhirProbeMs = 0;

const pendengarOnline = new Set<() => void>();

/** Status tersimpan: semua yang perlu diketahui UI/antrean. */
export function adalahOnline(): boolean {
  const s = store.get();
  return s.terhubung && s.terjangkau;
}

/** Hook: `true` bila perangkat terhubung dan server terjangkau. Dirender ulang hanya saat nilainya berubah. */
export function useOnline(): boolean {
  return useStore(store, (s) => s.terhubung && s.terjangkau);
}

/** Epoch ms terakhir kali server menjawab (permintaan nyata atau probe); null bila belum pernah sejak aplikasi dibuka. */
export function terakhirOnline(): number | null {
  return terakhirOnlineMs;
}

/**
 * Perlu gagal cepat tanpa menyentuh jaringan? Benar bila OS melaporkan tak ada
 * jaringan, atau server baru saja gagal dijangkau (< 10 dtk lalu). Di luar itu
 * permintaan tetap dicoba (dengan batas waktu lebih pendek) supaya kesalahan
 * deteksi tidak membuat aplikasi "terkunci offline".
 */
export function gagalCepat(): boolean {
  const s = store.get();
  if (!s.terhubung) {
    return true;
  }
  return !s.terjangkau && gagalSejakMs !== null && Date.now() - gagalSejakMs < 10_000;
}

/** Batas waktu efektif: lebih pendek (8 dtk) bila server dicurigai tak terjangkau. */
export function timeoutEfektif(timeoutMs: number): number {
  return store.get().terjangkau ? timeoutMs : Math.min(timeoutMs, 8000);
}

/** Dipanggil saat tepat satu transisi tidak-online → online terjadi. Mengembalikan fungsi berhenti. */
export function saatOnline(pendengar: () => void): () => void {
  pendengarOnline.add(pendengar);
  return () => {
    pendengarOnline.delete(pendengar);
  };
}

function ubah(bagian: Partial<StatusJaringan>): void {
  const sebelum = adalahOnline();
  store.set((lama) => {
    const baru = { ...lama, ...bagian };
    return baru.terhubung === lama.terhubung && baru.terjangkau === lama.terjangkau ? lama : baru;
  });
  if (!sebelum && adalahOnline()) {
    backoffProbe = 3000;
    pendengarOnline.forEach((p) => {
      try {
        p();
      } catch {
        // Pendengar tidak boleh merusak pelaporan jaringan.
      }
    });
  }
}

/** Dipanggil klien API: server menjawab (status HTTP apa pun). */
export function laporBerhasil(): void {
  terakhirOnlineMs = Date.now();
  gagalSejakMs = null;
  hentikanProbe();
  const s = store.get();
  if (!s.terjangkau || !s.terhubung) {
    // Ada jawaban nyata → jaringan jelas ada, walau OS belum melaporkannya.
    ubah({ terjangkau: true, terhubung: true });
  }
}

/** Dipanggil klien API: permintaan gagal tanpa jawaban (jaringan/batas waktu). */
export function laporGagal(): void {
  gagalSejakMs = Date.now();
  ubah({ terjangkau: false });
  jadwalkanProbe();
}

function hentikanProbe(): void {
  if (timerProbe) {
    clearTimeout(timerProbe);
    timerProbe = null;
  }
}

async function probe(): Promise<boolean> {
  const kontrol = new AbortController();
  const timer = setTimeout(() => kontrol.abort(), 6000);
  try {
    // Jawaban HTTP apa pun berarti server terjangkau.
    await fetch(`${API_URL}/konfigurasi`, { method: 'GET', headers: { Accept: 'application/json', 'X-App-Version': APP_VERSION }, signal: kontrol.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Periksa jangkauan server sekarang (maks. sekali per 2 dtk; panggilan serentak
 * berbagi satu probe). Mengembalikan `true` bila server menjawab.
 */
export function periksaSegera(): Promise<boolean> {
  if (!store.get().terhubung) {
    return Promise.resolve(false);
  }
  if (probeBerjalan) {
    return probeBerjalan;
  }
  if (Date.now() - terakhirProbeMs < 2000) {
    return Promise.resolve(adalahOnline());
  }
  terakhirProbeMs = Date.now();
  hentikanProbe();
  probeBerjalan = probe()
    .then((ok) => {
      if (ok) {
        laporBerhasil();
      } else {
        gagalSejakMs = Date.now();
        ubah({ terjangkau: false });
        backoffProbe = Math.min(backoffProbe * 2, 30_000);
        jadwalkanProbe();
      }
      return ok;
    })
    .finally(() => {
      probeBerjalan = null;
    });
  return probeBerjalan;
}

function jadwalkanProbe(): void {
  const s = store.get();
  // Tanpa jaringan OS → tunggu event; di latar belakang → tunggu foreground.
  if (timerProbe || !foreground || !s.terhubung || s.terjangkau) {
    return;
  }
  timerProbe = setTimeout(() => {
    timerProbe = null;
    void periksaSegera();
  }, backoffProbe);
}

function terapkanKeadaanOs(state: Network.NetworkState): void {
  const terhubung = state.isConnected !== false;
  if (!terhubung) {
    hentikanProbe();
    ubah({ terhubung: false });
    return;
  }
  const sebelumTerhubung = store.get().terhubung;
  ubah({ terhubung: true });
  // OS bilang jaringan kembali, atau "terhubung tapi tak ada internet" → pastikan lewat probe.
  if (!sebelumTerhubung || state.isInternetReachable === false || !store.get().terjangkau) {
    void periksaSegera();
  }
}

/**
 * Baca ulang keadaan jaringan dari OS lalu pastikan server terjangkau. Dipakai
 * sinkron latar belakang, yang berjalan tanpa `mulaiJaringan()` (proses tanpa UI)
 * atau dengan status basi (aplikasi di latar belakang tidak memeriksa server).
 */
export async function segarkanJaringan(): Promise<boolean> {
  try {
    terapkanKeadaanOs(await Network.getNetworkStateAsync());
  } catch {
    // Keadaan OS tak terbaca: andalkan permintaan nyata / probe.
  }
  if (!store.get().terhubung) {
    return false;
  }
  return adalahOnline() || (await periksaSegera());
}

/**
 * Mulai memantau (idempoten). Dipanggil `OfflineProvider` setelah frame
 * pertama. Mengembalikan fungsi berhenti (untuk pengujian).
 */
export function mulaiJaringan(): () => void {
  if (mulai) {
    return () => undefined;
  }
  mulai = true;
  void Network.getNetworkStateAsync()
    .then(terapkanKeadaanOs)
    .catch(() => undefined);
  const langgananOs = Network.addNetworkStateListener(terapkanKeadaanOs);
  const langgananApp = AppState.addEventListener('change', (state) => {
    foreground = state === 'active';
    if (!foreground) {
      hentikanProbe();
      return;
    }
    void Network.getNetworkStateAsync()
      .then(terapkanKeadaanOs)
      .catch(() => undefined);
    jadwalkanProbe();
  });
  return () => {
    langgananOs.remove();
    langgananApp.remove();
    hentikanProbe();
    mulai = false;
  };
}

/** Apakah aplikasi sedang di latar depan (dipakai antrean untuk menunda kirim). */
export function adalahForeground(): boolean {
  return foreground;
}
