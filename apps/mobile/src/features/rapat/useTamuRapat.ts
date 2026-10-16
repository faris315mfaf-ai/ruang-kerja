/**
 * Daftar tamu eksternal rapat video untuk penyelenggara (detail rapat): muat,
 * segarkan berkala saat layar fokus dan aplikasi di latar depan, tambah, putar
 * ulang tautan, cabut. Semua aksi hanya online (tidak pernah diantrekan —
 * "Butuh koneksi"), jawaban tidak masuk cache (tautan rahasia), dan galat
 * dipetakan ke pesan Indonesia (`pesanGalatTamu`).
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError } from '@/api/client';
import { cabutTamu, daftarTamu, putarTautanTamu, tambahTamu, type DaftarTamu, type HasilTambahTamu, type TamuRapat } from '@/api/rapatTamu';
import { adalahOnline } from '@/offline';
import { buatUlid } from '@/offline/ulid';

import { hentikanPantau, pesanGalatTamu, type AksiTamu } from './tamu';

export type StatusDaftarTamu = 'diam' | 'memuat' | 'siap' | 'galat' | 'offline' | 'terlarang';

export type HasilAksiTamu<T> = { ok: true; nilai: T } | { ok: false; pesan: string; offline: boolean; status: number };

export interface TamuRapatLive {
  data: DaftarTamu | null;
  status: StatusDaftarTamu;
  /** Pesan galat muat (bukan galat aksi). */
  galat: string | null;
  /** Id tamu yang sedang diproses, atau 'tambah'. */
  sibuk: string | null;
  muat: (diam?: boolean) => Promise<void>;
  tambah: (email: string, nama: string | null) => Promise<HasilAksiTamu<HasilTambahTamu>>;
  putar: (tamuId: string) => Promise<HasilAksiTamu<TamuRapat>>;
  cabut: (tamuId: string) => Promise<HasilAksiTamu<null>>;
}

const JEDA_SEGAR_MS = 20_000;

function gagal<T>(aksi: AksiTamu, e: unknown): HasilAksiTamu<T> {
  if (e instanceof ApiError) {
    return { ok: false, pesan: pesanGalatTamu(aksi, { status: e.status, code: e.code, message: e.firstValidationError ?? e.message }), offline: e.status === 0, status: e.status };
  }
  return { ok: false, pesan: pesanGalatTamu(aksi, { status: -1 }), offline: false, status: -1 };
}

function butuhKoneksi<T>(aksi: AksiTamu): HasilAksiTamu<T> {
  return { ok: false, pesan: pesanGalatTamu(aksi, { status: 0 }), offline: true, status: 0 };
}

export function useTamuRapat(id: string, tanggal: string | null, aktif: boolean): TamuRapatLive {
  const [data, setData] = useState<DaftarTamu | null>(null);
  const [status, setStatus] = useState<StatusDaftarTamu>('diam');
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const hidup = useRef(true);
  const terkunci = useRef(false);
  const ada = useRef(false);

  useEffect(() => {
    hidup.current = true;
    return () => {
      hidup.current = false;
    };
  }, []);

  const muat = useCallback(
    async (diam = false): Promise<void> => {
      if (!aktif) {
        return;
      }
      if (!diam && !ada.current) {
        setStatus('memuat');
      }
      try {
        const hasil = await daftarTamu(id, tanggal);
        if (!hidup.current) {
          return;
        }
        ada.current = true;
        setData(hasil);
        setStatus('siap');
        setGalat(null);
      } catch (e) {
        if (!hidup.current) {
          return;
        }
        const s = e instanceof ApiError ? e.status : -1;
        if (hentikanPantau(s)) {
          setData(null);
          ada.current = false;
          setStatus('terlarang');
        } else if (s === 0) {
          // Tanpa jaringan: daftar yang sudah ada tetap tampil; tautan tidak pernah disimpan di cache.
          setStatus(ada.current ? 'siap' : 'offline');
        } else if (!diam || !ada.current) {
          setStatus(ada.current ? 'siap' : 'galat');
          setGalat(pesanGalatTamu('memuat', { status: s, code: e instanceof ApiError ? e.code : null, message: e instanceof ApiError ? e.message : null }));
        }
      }
    },
    [id, tanggal, aktif],
  );

  // Muat saat layar fokus + segarkan berkala (status ruang tunggu tamu berubah sendiri).
  useFocusEffect(
    useCallback(() => {
      if (!aktif) {
        return undefined;
      }
      void muat(true);
      const t = setInterval(() => {
        if (AppState.currentState === 'active') {
          void muat(true);
        }
      }, JEDA_SEGAR_MS);
      return () => clearInterval(t);
    }, [aktif, muat]),
  );

  const jalankan = useCallback(
    async <T,>(aksi: AksiTamu, kunci: string, kerja: () => Promise<T>): Promise<HasilAksiTamu<T>> => {
      if (!adalahOnline()) {
        return butuhKoneksi(aksi);
      }
      if (terkunci.current) {
        return { ok: false, pesan: 'Tunggu sebentar, aksi sebelumnya masih berjalan.', offline: false, status: -1 };
      }
      terkunci.current = true;
      setSibuk(kunci);
      try {
        const nilai = await kerja();
        return { ok: true, nilai };
      } catch (e) {
        const hasil = gagal<T>(aksi, e);
        // Status tamu berubah di sisi lain / tamu hilang: segarkan agar daftar jujur.
        if (!hasil.ok && (hasil.status === 404 || hasil.status === 409)) {
          void muat(true);
        }
        return hasil;
      } finally {
        terkunci.current = false;
        if (hidup.current) {
          setSibuk(null);
        }
      }
    },
    [muat],
  );

  const tambah = useCallback(
    (email: string, nama: string | null) =>
      jalankan('tambah', 'tambah', async () => {
        const hasil = await tambahTamu(id, email, nama, buatUlid(), tanggal);
        if (hidup.current) {
          setData((lama) => {
            if (!lama) {
              return lama;
            }
            const ada2 = lama.guests.some((g) => g.id === hasil.guest.id);
            return { ...lama, guests: ada2 ? lama.guests.map((g) => (g.id === hasil.guest.id ? hasil.guest : g)) : [...lama.guests, hasil.guest] };
          });
        }
        return hasil;
      }),
    [id, tanggal, jalankan],
  );

  const putar = useCallback(
    (tamuId: string) =>
      jalankan('putar', tamuId, async () => {
        const tamu = await putarTautanTamu(id, tamuId, buatUlid(), tanggal);
        if (hidup.current) {
          setData((lama) => (lama ? { ...lama, guests: lama.guests.map((g) => (g.id === tamu.id ? tamu : g)) } : lama));
        }
        return tamu;
      }),
    [id, tanggal, jalankan],
  );

  const cabut = useCallback(
    (tamuId: string) =>
      jalankan('cabut', tamuId, async () => {
        await cabutTamu(id, tamuId, buatUlid());
        if (hidup.current) {
          setData((lama) => (lama ? { ...lama, guests: lama.guests.filter((g) => g.id !== tamuId) } : lama));
        }
        return null;
      }),
    [id, jalankan],
  );

  return { data, status, galat, sibuk, muat, tambah, putar, cabut };
}
