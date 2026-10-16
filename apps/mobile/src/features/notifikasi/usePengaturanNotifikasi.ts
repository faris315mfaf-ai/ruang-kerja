/**
 * Pengaturan notifikasi: muat sekali, simpan otomatis tiap perubahan lewat
 * PUT atomik berantai (satu per satu, berurutan), pembaruan optimistis,
 * pada kegagalan muat ulang dari server + snackbar ULANGI. Salinan terakhir
 * di memori dipakai saat offline (baca-saja).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  ambilPengaturanNotifikasi,
  simpanPengaturanNotifikasi,
  type KanalNotifikasi,
  type PengaturanNotifikasi,
  type UbahPengaturan,
} from '@/api/notifikasi';
import { useSnackbar } from '@/ui';

let salinan: PengaturanNotifikasi | null = null;

export type StatusSimpan = 'diam' | 'menyimpan' | 'tersimpan' | 'gagal';

function terapkan(data: PengaturanNotifikasi, ubah: UbahPengaturan): PengaturanNotifikasi {
  const baru: PengaturanNotifikasi = {
    ...data,
    settings: {
      digest_enabled: ubah.digest_enabled ?? data.settings.digest_enabled,
      digest_time: ubah.digest_time ?? data.settings.digest_time,
      quiet_hours: ubah.quiet_hours ?? data.settings.quiet_hours,
      pause_while_on_leave: ubah.pause_while_on_leave ?? data.settings.pause_while_on_leave,
    },
  };
  if (ubah.preferences) {
    baru.matrix = data.matrix.map((baris) => {
      const sel = ubah.preferences?.filter((p) => p.event === baris.event) ?? [];
      if (sel.length === 0) {
        return baris;
      }
      const kanal = { ...baris.channels };
      for (const p of sel) {
        const lama = kanal[p.channel];
        kanal[p.channel] = { ...lama, enabled: p.enabled };
      }
      return { ...baris, channels: kanal };
    });
  }
  return baru;
}

export function usePengaturanNotifikasi(): {
  data: PengaturanNotifikasi | null;
  memuat: boolean;
  galat: { pesan: string; status: number } | null;
  offline: boolean;
  status: StatusSimpan;
  muat: () => Promise<void>;
  ubah: (perubahan: UbahPengaturan) => void;
  ubahKanal: (event: string, kanal: KanalNotifikasi, aktif: boolean) => void;
} {
  const snackbar = useSnackbar();
  const [data, setData] = useState<PengaturanNotifikasi | null>(salinan);
  const [memuat, setMemuat] = useState(salinan === null);
  const [galat, setGalat] = useState<{ pesan: string; status: number } | null>(null);
  const [offline, setOffline] = useState(false);
  const [status, setStatus] = useState<StatusSimpan>('diam');
  const dataRef = useRef<PengaturanNotifikasi | null>(salinan);
  const antre = useRef<Promise<void>>(Promise.resolve());
  const tertunda = useRef(0);
  const ubahRef = useRef<((p: UbahPengaturan) => void) | null>(null);

  const pasang = useCallback((d: PengaturanNotifikasi): void => {
    dataRef.current = d;
    salinan = d;
    setData(d);
  }, []);

  const muat = useCallback(async (): Promise<void> => {
    if (dataRef.current === null) {
      setMemuat(true);
    }
    setGalat(null);
    try {
      pasang(await ambilPengaturanNotifikasi());
      setOffline(false);
    } catch (err) {
      const kode = err instanceof ApiError ? err.status : 0;
      setOffline(kode === 0);
      if (dataRef.current === null) {
        setGalat({ pesan: err instanceof ApiError ? err.message : 'Tidak dapat memuat pengaturan notifikasi.', status: kode });
      }
    } finally {
      setMemuat(false);
    }
  }, [pasang]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat layar dibuka
    void muat();
  }, [muat]);

  const ubah = useCallback(
    (perubahan: UbahPengaturan): void => {
      const sekarang = dataRef.current;
      if (!sekarang) {
        return;
      }
      pasang(terapkan(sekarang, perubahan));
      tertunda.current += 1;
      setStatus('menyimpan');
      antre.current = antre.current.then(async () => {
        try {
          const hasil = await simpanPengaturanNotifikasi(perubahan);
          tertunda.current -= 1;
          if (tertunda.current === 0) {
            pasang(hasil);
            setStatus('tersimpan');
          }
          setOffline(false);
        } catch (err) {
          tertunda.current -= 1;
          const mati = err instanceof ApiError && err.status === 0;
          setStatus('gagal');
          setOffline(mati);
          snackbar.show({
            message: mati ? 'Tidak ada koneksi. Perubahan belum tersimpan.' : err instanceof ApiError && err.firstValidationError ? err.firstValidationError : 'Gagal menyimpan pengaturan.',
            variant: mati ? 'offline' : 'bad',
            actionLabel: 'Ulangi',
            onAction: () => ubahRef.current?.(perubahan),
          });
          // Kembalikan tampilan ke keadaan server (yang tersimpan sebelumnya).
          try {
            pasang(await ambilPengaturanNotifikasi());
          } catch {
            // tetap tampilkan keadaan terakhir; pengguna bisa mengulang
          }
        }
      });
    },
    [pasang, snackbar],
  );

  useEffect(() => {
    ubahRef.current = ubah;
  }, [ubah]);

  const ubahKanal = useCallback((event: string, kanal: KanalNotifikasi, aktif: boolean): void => {
    ubah({ preferences: [{ event, channel: kanal, enabled: aktif }] });
  }, [ubah]);

  return { data, memuat, galat, offline, status, muat, ubah, ubahKanal };
}
