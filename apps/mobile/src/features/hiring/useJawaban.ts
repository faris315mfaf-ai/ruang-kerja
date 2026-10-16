/**
 * Simpan otomatis jawaban kandidat (HR) per pertanyaan: debounce 1,5 detik
 * (limiter API 60/menit untuk seluruh aplikasi), ketikan digabung, `PUT`
 * idempoten. Offline → "Menunggu jaringan…" dan dicoba ulang tiap 10 detik.
 * Antrean hanya di memori (data pelamar tidak pernah ditulis ke disk); saat
 * layar ditutup, jawaban yang belum terkirim dikirim sekali lagi.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import { simpanJawaban } from '@/api/hiring';

export const JEDA_SIMPAN_MS = 1500;
const JEDA_ULANG_MS = 10_000;

export type StatusJawaban = 'diubah' | 'menyimpan' | 'tersimpan' | 'menunggu' | 'gagal';

export interface KeadaanJawaban {
  teks: string;
  status: StatusJawaban;
  pesan?: string;
}

export interface Jawaban {
  keadaan: Record<string, KeadaanJawaban>;
  ubah: (questionId: string, teks: string) => void;
  cobaLagi: (questionId: string) => void;
  /** Jumlah jawaban yang belum tersimpan di server. */
  tertunda: number;
}

export function useJawaban(kandidatId: string | null, onTersimpan?: (questionId: string, answer: string | null) => void): Jawaban {
  const [keadaan, setKeadaan] = useState<Record<string, KeadaanJawaban>>({});
  const teksRef = useRef<Map<string, string>>(new Map());
  const timer = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const terkirimRef = useRef<Map<string, string>>(new Map());
  const idRef = useRef(kandidatId);
  const onTersimpanRef = useRef(onTersimpan);
  const kirimRef = useRef<((qid: string) => Promise<void>) | null>(null);
  useEffect(() => {
    idRef.current = kandidatId;
    onTersimpanRef.current = onTersimpan;
  }, [kandidatId, onTersimpan]);

  const pasang = useCallback((qid: string, k: Partial<KeadaanJawaban>) => {
    setKeadaan((lama) => ({ ...lama, [qid]: { teks: teksRef.current.get(qid) ?? '', status: 'diubah', ...lama[qid], ...k } }));
  }, []);

  const kirim = useCallback(
    async (qid: string): Promise<void> => {
      const id = idRef.current;
      if (id === null) {
        return;
      }
      const t = timer.current.get(qid);
      if (t) {
        clearTimeout(t);
        timer.current.delete(qid);
      }
      const teks = teksRef.current.get(qid) ?? '';
      pasang(qid, { status: 'menyimpan', pesan: undefined });
      try {
        const hasil = await simpanJawaban(id, qid, teks.trim() === '' ? null : teks);
        terkirimRef.current.set(qid, teks);
        onTersimpanRef.current?.(qid, hasil.answer);
        if ((teksRef.current.get(qid) ?? '') === teks) {
          pasang(qid, { status: 'tersimpan' });
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 0) {
          pasang(qid, { status: 'menunggu' });
          timer.current.set(
            qid,
            setTimeout(() => void kirimRef.current?.(qid), JEDA_ULANG_MS),
          );
        } else {
          pasang(qid, { status: 'gagal', pesan: err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Gagal menyimpan.' });
        }
      }
    },
    [pasang],
  );

  useEffect(() => {
    kirimRef.current = kirim;
  }, [kirim]);

  const ubah = useCallback(
    (qid: string, teks: string) => {
      teksRef.current.set(qid, teks);
      setKeadaan((lama) => ({ ...lama, [qid]: { teks, status: lama[qid]?.status === 'menunggu' ? 'menunggu' : 'diubah' } }));
      const t = timer.current.get(qid);
      if (t) {
        clearTimeout(t);
      }
      timer.current.set(
        qid,
        setTimeout(() => void kirim(qid), JEDA_SIMPAN_MS),
      );
    },
    [kirim],
  );

  const cobaLagi = useCallback((qid: string) => void kirim(qid), [kirim]);

  // Saat layar ditutup: kirim sekali jawaban yang belum tersimpan (tanpa menyimpan ke disk).
  useEffect(() => {
    const peta = timer.current;
    const teks = teksRef.current;
    const terkirim = terkirimRef.current;
    return () => {
      const id = idRef.current;
      for (const [qid, t] of peta) {
        clearTimeout(t);
        const isi = teks.get(qid) ?? '';
        if (id !== null && terkirim.get(qid) !== isi) {
          void simpanJawaban(id, qid, isi.trim() === '' ? null : isi).catch(() => undefined);
        }
      }
      peta.clear();
    };
  }, []);

  const tertunda = Object.values(keadaan).filter((k) => k.status !== 'tersimpan').length;

  return { keadaan, ubah, cobaLagi, tertunda };
}
