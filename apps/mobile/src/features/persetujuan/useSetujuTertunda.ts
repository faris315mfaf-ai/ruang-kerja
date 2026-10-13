/**
 * "Setujui" lewat geser/tombol di tumpukan: keputusan baru dikirim ke server
 * setelah 6 detik tanpa "Urungkan" (keputusan pemilik Bagian 4 — urungkan
 * sepenuhnya di sisi aplikasi, server tidak berubah).
 *
 * Keputusan tidak boleh hilang: bila pengguna meninggalkan layar, aplikasi ke
 * latar belakang, atau menyetujui kartu lain selama jendela 6 detik, yang
 * tertunda langsung dikirim (dan snackbar global menyebutkannya).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError } from '@/api/client';
import { putuskan, type HasilKeputusan, type ItemAntrean } from '@/api/persetujuan';
import { useSnackbar } from '@/ui';

import { judulKeputusan } from './format';

export const JEDA_URUNGKAN_MS = 6000;

export type AlasanKirim = 'waktu' | 'tinggal' | 'berikutnya';

export interface PenanganTertunda {
  /** Server menerima persetujuan. */
  onTerkirim?: (hasil: HasilKeputusan, item: ItemAntrean, alasan: AlasanKirim) => void;
  /** Gagal terkirim (jaringan/galat lain): kartu dikembalikan ke tumpukan. */
  onGagal?: (item: ItemAntrean, err: unknown) => void;
  /** 409 sudah_diputus: kartu tetap keluar dari tumpukan. */
  onKonflik?: (item: ItemAntrean, err: ApiError) => void;
}

export function useSetujuTertunda(penangan: PenanganTertunda): {
  tertunda: ItemAntrean | null;
  jadwalkan: (item: ItemAntrean) => void;
  urungkan: () => ItemAntrean | null;
  kirimSekarang: (alasan: AlasanKirim) => void;
} {
  const snackbar = useSnackbar();
  const [tertunda, setTertunda] = useState<ItemAntrean | null>(null);
  const ref = useRef<{ item: ItemAntrean; timer: ReturnType<typeof setTimeout> } | null>(null);
  const penanganRef = useRef(penangan);
  const hidup = useRef(true);

  useEffect(() => {
    penanganRef.current = penangan;
  });

  const kirim = useCallback(
    (item: ItemAntrean, alasan: AlasanKirim): void => {
      const judul = judulKeputusan(item);
      putuskan(item.id, 'setujui')
        .then((hasil) => {
          penanganRef.current.onTerkirim?.(hasil, item, alasan);
          if (alasan === 'tinggal') {
            snackbar.show({ message: `${judul} disetujui. Dikirim langsung karena Anda meninggalkan layar Persetujuan.`, variant: 'ok', duration: 5000 });
          }
        })
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 409) {
            penanganRef.current.onKonflik?.(item, err);
            snackbar.show({ message: err.message || 'Pengajuan ini sudah diputuskan.', variant: 'warn', duration: 6000 });
            return;
          }
          penanganRef.current.onGagal?.(item, err);
          if (err instanceof ApiError && err.status === 0) {
            snackbar.show({ message: `Tidak ada koneksi. Persetujuan ${judul} belum terkirim.`, variant: 'offline', duration: 6000 });
          } else {
            snackbar.show({ message: err instanceof ApiError ? err.message : `Persetujuan ${judul} gagal dikirim.`, variant: 'bad', duration: 6000 });
          }
        });
    },
    [snackbar],
  );

  const kirimSekarang = useCallback(
    (alasan: AlasanKirim): void => {
      const p = ref.current;
      if (!p) {
        return;
      }
      clearTimeout(p.timer);
      ref.current = null;
      if (hidup.current) {
        setTertunda(null);
      }
      kirim(p.item, alasan);
    },
    [kirim],
  );

  const jadwalkan = useCallback(
    (item: ItemAntrean): void => {
      // Satu jendela urungkan saja: keputusan sebelumnya langsung dikirim.
      kirimSekarang('berikutnya');
      const timer = setTimeout(() => kirimSekarang('waktu'), JEDA_URUNGKAN_MS);
      ref.current = { item, timer };
      setTertunda(item);
    },
    [kirimSekarang],
  );

  const urungkan = useCallback((): ItemAntrean | null => {
    const p = ref.current;
    if (!p) {
      return null;
    }
    clearTimeout(p.timer);
    ref.current = null;
    setTertunda(null);
    return p.item;
  }, []);

  // Aplikasi ke latar belakang → kirim sekarang (proses bisa dihentikan OS).
  useEffect(() => {
    const langganan = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        kirimSekarang('tinggal');
      }
    });
    return () => langganan.remove();
  }, [kirimSekarang]);

  // Layar dilepas (kembali/keluar akun) → kirim sekarang.
  useEffect(() => {
    hidup.current = true;
    return () => {
      hidup.current = false;
      kirimSekarang('tinggal');
    };
  }, [kirimSekarang]);

  return { tertunda, jadwalkan, urungkan, kirimSekarang };
}
