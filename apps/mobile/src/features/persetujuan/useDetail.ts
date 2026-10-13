/**
 * Detail persetujuan (`GET /persetujuan/{id}`): dipakai layar detail dan
 * untuk memperkaya kartu tumpukan teratas (alasan, saldo non-staf, pengganti,
 * jumlah lampiran) — daftar antrean tidak membawa bidang itu.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import { detailPersetujuan, type DetailPersetujuan } from '@/api/persetujuan';

const tembolok = new Map<string, DetailPersetujuan>();
let pemilikTembolok: string | null = null;

/** Kosongkan tembolok bila pengguna berganti (perangkat bersama). */
export function aturPemilikDetail(userId: string | null): void {
  if (userId !== pemilikTembolok) {
    tembolok.clear();
    pemilikTembolok = userId;
  }
}

export function simpanDetail(d: DetailPersetujuan): void {
  tembolok.set(d.request.id, d);
}

export function lupakanDetail(id: string): void {
  tembolok.delete(id);
}

/** Muat diam-diam (prefetch kartu berikutnya). Galat diabaikan. */
export function prefetchDetail(id: string): void {
  if (tembolok.has(id)) {
    return;
  }
  void detailPersetujuan(id)
    .then(simpanDetail)
    .catch(() => undefined);
}

export interface KeadaanDetail {
  data: DetailPersetujuan | null;
  memuat: boolean;
  galat: string | null;
  galatStatus: number | null;
}

export function useDetailPersetujuan(id: string | null): KeadaanDetail & { muatUlang: () => Promise<void>; ganti: (d: DetailPersetujuan) => void } {
  const [state, setState] = useState<KeadaanDetail>(() => ({ data: id ? (tembolok.get(id) ?? null) : null, memuat: id !== null, galat: null, galatStatus: null }));
  const nomor = useRef(0);

  const muat = useCallback(async (): Promise<void> => {
    if (!id) {
      return;
    }
    const n = ++nomor.current;
    setState((lama) => ({ ...lama, data: lama.data?.request.id === id ? lama.data : (tembolok.get(id) ?? null), memuat: true, galat: null, galatStatus: null }));
    try {
      const d = await detailPersetujuan(id);
      simpanDetail(d);
      if (n === nomor.current) {
        setState({ data: d, memuat: false, galat: null, galatStatus: null });
      }
    } catch (err) {
      if (n === nomor.current) {
        setState((lama) => ({
          data: lama.data?.request.id === id ? lama.data : null,
          memuat: false,
          galat: err instanceof ApiError ? err.message : 'Tidak dapat memuat pengajuan.',
          galatStatus: err instanceof ApiError ? err.status : null,
        }));
      }
    }
  }, [id]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const ganti = useCallback((d: DetailPersetujuan): void => {
    simpanDetail(d);
    setState({ data: d, memuat: false, galat: null, galatStatus: null });
  }, []);

  return { ...state, muatUlang: muat, ganti };
}
