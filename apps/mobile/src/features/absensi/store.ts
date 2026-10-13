/**
 * Keadaan form Absen yang dipakai bersama layar Absen (tab) dan layar anak
 * (selfie, pemindai QR, hasil): metode, rencana kerja (masuk), laporan kerja (pulang), catatan, selfie, hasil
 * terakhir. Disimpan di memori (satu proses); dikosongkan saat pengguna ganti
 * akun. Tidak pernah menulis koordinat/selfie ke log atau penyimpanan.
 */
import { useSyncExternalStore } from 'react';

import type { AttendanceResult } from '@/api/types';
import type { GagalAbsen } from '@/api/absensi';

export type Metode = 'gps' | 'qr' | 'wfh';
export type Arah = 'masuk' | 'pulang';

export interface PoinRencana {
  /** Kunci stabil (bukan indeks) agar fokus/IME tidak berpindah saat baris dihapus. */
  id: string;
  teks: string;
}

export interface Selfie {
  uri: string;
  /** Epoch ms saat diambil. */
  waktu: number;
  /** Penanda kualitas dari kamera (heuristik EXIF); server tetap memeriksa sendiri. */
  gelap: boolean;
}

/** Titik lokasi yang dikirim bersama permintaan terakhir (untuk "Kirim ulang"). */
export interface TitikKirim {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  mocked: boolean;
}

export interface PermintaanTerakhir {
  arah: Arah;
  metode: Metode;
  titik: TitikKirim;
  selfieUri: string;
  catatan: string;
  workPlan: string[];
  /** Laporan kerja (check-out GPS/WFH); kosong untuk check-in. */
  workReport: string[];
  /** Ringkasan lokasi untuk layar hasil (mis. jarak ke titik). */
  jarakM: number | null;
}

/** Data jadwal hari ini yang dibutuhkan layar hasil (batas terlambat, jam pulang). */
export interface InfoJadwal {
  batasTerlambat: string | null;
  jadwalMulai: string | null;
  jamPulangTerjadwal: string | null;
  /** Untuk ringkasan check-out: kapan & di mana masuk. */
  masukPada: string | null;
  masukLokasi: string | null;
}

export type HasilAbsen =
  | {
      jenis: 'sukses';
      arah: Arah;
      metode: Metode;
      hasil: AttendanceResult;
      jumlahRencana: number;
      /** Jumlah poin laporan kerja yang terkirim saat check-out. */
      jumlahLaporan: number;
      catatan: string;
    } & InfoJadwal
  | { jenis: 'gagal'; arah: Arah; metode: Metode; gagal: GagalAbsen; diterimaPada: number; retryQr: boolean };

interface State {
  userId: string | null;
  metode: Metode;
  poin: PoinRencana[];
  /** Laporan kerja pulang (hanya di memori, tidak disimpan ke penyimpanan). */
  laporan: PoinRencana[];
  catatan: string;
  selfie: Selfie | null;
  hasil: HasilAbsen | null;
  permintaan: PermintaanTerakhir | null;
  /** Layar Absen perlu membaca lokasi lagi saat fokus (mis. dari "Perbarui lokasi"). */
  segarkanLokasi: boolean;
  jadwal: InfoJadwal | null;
  /** Pengguna memilih "Check-out lebih awal" dari kartu "Sedang bekerja". */
  pulangAwal: boolean;
}

let nomor = 0;
export function poinBaru(teks = ''): PoinRencana {
  nomor += 1;
  return { id: `p${nomor}`, teks };
}

function awal(userId: string | null): State {
  return {
    userId,
    metode: 'gps',
    poin: [poinBaru()],
    laporan: [poinBaru()],
    catatan: '',
    selfie: null,
    hasil: null,
    permintaan: null,
    segarkanLokasi: false,
    jadwal: null,
    pulangAwal: false,
  };
}

let state: State = awal(null);
const pendengar = new Set<() => void>();

function set(patch: Partial<State> | ((s: State) => Partial<State>)): void {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  pendengar.forEach((l) => l());
}

export const absenStore = {
  get: (): State => state,
  subscribe(l: () => void): () => void {
    pendengar.add(l);
    return () => pendengar.delete(l);
  },
  /** Kosongkan bila pengguna berganti (keluar → masuk akun lain). */
  ikatPengguna(userId: string | null): void {
    if (state.userId !== userId) {
      state = awal(userId);
      pendengar.forEach((l) => l());
    }
  },
  setMetode: (metode: Metode): void => set({ metode }),
  ubahPoin: (id: string, teks: string): void => set((s) => ({ poin: s.poin.map((p) => (p.id === id ? { ...p, teks } : p)) })),
  /** Menambah poin kosong di akhir (maks. 8); mengembalikan id-nya (null bila penuh). */
  tambahPoin(): string | null {
    if (state.poin.length >= 8) {
      return null;
    }
    const baru = poinBaru();
    set((s) => ({ poin: [...s.poin, baru] }));
    return baru.id;
  },
  hapusPoin: (id: string): void => set((s) => ({ poin: s.poin.length > 1 ? s.poin.filter((p) => p.id !== id) : s.poin })),
  ubahLaporan: (id: string, teks: string): void => set((s) => ({ laporan: s.laporan.map((p) => (p.id === id ? { ...p, teks } : p)) })),
  tambahLaporan(): string | null {
    if (state.laporan.length >= 8) {
      return null;
    }
    const baru = poinBaru();
    set((s) => ({ laporan: [...s.laporan, baru] }));
    return baru.id;
  },
  hapusLaporan: (id: string): void => set((s) => ({ laporan: s.laporan.length > 1 ? s.laporan.filter((p) => p.id !== id) : s.laporan })),
  setCatatan: (catatan: string): void => set({ catatan }),
  setSelfie: (selfie: Selfie | null): void => set({ selfie }),
  setHasil: (hasil: HasilAbsen | null): void => set({ hasil }),
  setPermintaan: (permintaan: PermintaanTerakhir | null): void => set({ permintaan }),
  mintaSegarkanLokasi: (nilai: boolean): void => set({ segarkanLokasi: nilai }),
  setJadwal: (jadwal: InfoJadwal | null): void => set({ jadwal }),
  setPulangAwal: (pulangAwal: boolean): void => set({ pulangAwal }),
  /** Setelah kirim berhasil: bersihkan isian hari ini. */
  selesaiKirim(): void {
    set({ selfie: null, poin: [poinBaru()], laporan: [poinBaru()], catatan: '', permintaan: null, pulangAwal: false });
  },
};

export function useAbsenStore(): State {
  return useSyncExternalStore(absenStore.subscribe, absenStore.get, absenStore.get);
}
