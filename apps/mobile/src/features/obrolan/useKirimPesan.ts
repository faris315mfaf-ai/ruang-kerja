/**
 * Alur kirim/sunting pesan bersama layar kanal dan thread: antrean lokal
 * ("mengirim" / "gagal terkirim" + coba lagi / hapus), galat 429 dengan jeda,
 * 422 (teks dipertahankan), 403 (dialog bukan anggota), dan sunting.
 * Tanpa antrean offline persisten (Fase 3, PLATFORM §2.1 butir 5): pesan gagal
 * hidup selama layar terbuka.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import { kirimKePesan, suntingPesan, type MuatanKirim, type Pesan } from '@/api/obrolan';
import { useDialog } from '@/ui';

import { pesanGalat, tanpaKoneksi } from './util';

export interface PesanAntrean {
  localId: string;
  muatan: MuatanKirim;
  status: 'mengirim' | 'gagal';
  pesan: Pesan;
}

let urutan = 0;

function pesanLokal(saya: string, kanalId: string, muatan: MuatanKirim): Pesan {
  urutan += 1;
  return {
    id: `lokal-${urutan}`,
    channel_id: kanalId,
    user_id: saya,
    parent_id: muatan.parent_id ?? null,
    body: null,
    body_text: muatan.body,
    created_at: new Date().toISOString(),
    edited_at: null,
    deleted_at: null,
    reactions: [],
    attachments: [],
  };
}

export function useKirimPesan({
  kanalId,
  saya,
  parentId,
  onTerkirim,
  onTersunting,
  onSelesaiSunting,
}: {
  kanalId: string;
  saya: string | null;
  parentId?: string | null;
  onTerkirim: (pesan: Pesan) => void;
  onTersunting: (pesan: Pesan) => void;
  onSelesaiSunting: () => void;
}) {
  const dialog = useDialog();
  const [antrean, setAntrean] = useState<PesanAntrean[]>([]);
  const [galat, setGalat] = useState<string | null>(null);
  const pewaktu = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (pewaktu.current) {
        clearTimeout(pewaktu.current);
      }
    },
    [],
  );

  const tampilGalat = useCallback((teks: string, detik?: number | null) => {
    setGalat(teks);
    if (pewaktu.current) {
      clearTimeout(pewaktu.current);
    }
    if (detik && detik > 0) {
      pewaktu.current = setTimeout(() => setGalat(null), detik * 1000);
    }
  }, []);

  /** Kirim ke server; mengembalikan `true` bila isian komposer boleh dikosongkan. */
  const proses = useCallback(
    async (item: PesanAntrean): Promise<boolean> => {
      try {
        const hasil = await kirimKePesan(kanalId, item.muatan);
        setAntrean((lama) => lama.filter((a) => a.localId !== item.localId));
        onTerkirim(hasil.message);
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 429) {
          setAntrean((lama) => lama.filter((a) => a.localId !== item.localId));
          tampilGalat(pesanGalat(err, ''), err.retryAfter ?? 10);
          return false;
        }
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setAntrean((lama) => lama.filter((a) => a.localId !== item.localId));
          void dialog.alert({
            title: err.status === 404 ? 'Obrolan tidak ditemukan' : 'Tidak bisa mengirim pesan',
            message: err.status === 404 ? 'Obrolan ini sudah tidak tersedia untuk Anda.' : err.message,
          });
          return false;
        }
        if (err instanceof ApiError && err.status === 422) {
          setAntrean((lama) => lama.filter((a) => a.localId !== item.localId));
          tampilGalat(pesanGalat(err, 'Pesan tidak valid.'));
          return false;
        }
        // Tanpa koneksi / galat server: pesan tetap di daftar dengan "Coba lagi".
        setAntrean((lama) => lama.map((a) => (a.localId === item.localId ? { ...a, status: 'gagal' } : a)));
        if (!tanpaKoneksi(err)) {
          tampilGalat(pesanGalat(err, 'Pesan gagal terkirim.'));
        }
        return true;
      }
    },
    [kanalId, onTerkirim, tampilGalat, dialog],
  );

  const kirim = useCallback(
    async (muatan: MuatanKirim, editId: string | null): Promise<boolean> => {
      setGalat(null);
      if (editId !== null) {
        try {
          const hasil = await suntingPesan(kanalId, editId, { body: muatan.body, mentions: muatan.mentions, task_refs: muatan.task_refs });
          onTersunting(hasil.message);
          onSelesaiSunting();
          return true;
        } catch (err) {
          tampilGalat(pesanGalat(err, 'Perubahan gagal disimpan.'), err instanceof ApiError && err.status === 429 ? (err.retryAfter ?? 10) : null);
          return false;
        }
      }
      if (saya === null) {
        return false;
      }
      const dasar: MuatanKirim = { ...muatan, parent_id: parentId ?? null };
      const item: PesanAntrean = { localId: `a-${Date.now()}-${urutan}`, muatan: dasar, status: 'mengirim', pesan: pesanLokal(saya, kanalId, dasar) };
      setAntrean((lama) => [...lama, item]);
      return proses(item);
    },
    [kanalId, saya, parentId, proses, onTersunting, onSelesaiSunting, tampilGalat],
  );

  const cobaLagi = useCallback(
    (localId: string): void => {
      const item = antrean.find((a) => a.localId === localId);
      if (!item) {
        return;
      }
      setGalat(null);
      const baru: PesanAntrean = { ...item, status: 'mengirim' };
      setAntrean((lama) => lama.map((a) => (a.localId === localId ? baru : a)));
      void proses(baru);
    },
    [antrean, proses],
  );

  const hapusLokal = useCallback((localId: string): void => {
    setAntrean((lama) => lama.filter((a) => a.localId !== localId));
  }, []);

  return { antrean, galat, kirim, cobaLagi, hapusLokal, bersihGalat: () => setGalat(null) };
}
