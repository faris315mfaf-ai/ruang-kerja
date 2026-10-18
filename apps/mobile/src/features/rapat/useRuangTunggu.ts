/**
 * Ruang tunggu tamu eksternal untuk yang berwenang (penyelenggara, notulis,
 * peserta internal): polling `GET rapat/{id}/video/ruang-tunggu` tiap ±4 detik
 * HANYA saat aplikasi di latar depan dan layar yang memantau aktif (berhenti saat
 * keluar ruang/latar belakang, lanjut dan langsung segar saat kembali), backoff
 * saat gagal, berhenti total pada 403/404/410. Izinkan/Tolak hanya online.
 * Kanal realtime `lobby.updated` belum dipakai (aplikasi belum punya klien Echo).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError } from '@/api/client';
import { izinkanTamu, ruangTunggu, tolakTamu, type KeputusanTamu, type PenungguTamu } from '@/api/rapatTamu';
import { adalahOnline } from '@/offline';

import { bolehPantau, hentikanPantau, jedaRuangTunggu, pesanGalatTamu, tamuBaru, type AksiTamu } from './tamu';

export interface OpsiRuangTunggu {
  /** Layar sedang memantau (mis. tersambung di ruang / pra-gabung siap). */
  aktif: boolean;
  /** Dipanggil dengan tamu yang baru menunggu (termasuk yang sudah menunggu saat pertama dimuat). */
  onTamuBaru?: (baru: PenungguTamu[]) => void;
}

export type HasilKeputusan = { ok: true; tamu: KeputusanTamu } | { ok: false; pesan: string; offline: boolean };

export interface RuangTungguLive {
  menunggu: PenungguTamu[];
  jumlah: number;
  /** false setelah 403/404/410 — pengguna tidak berwenang atau rapat tutup; UI menyembunyikan lencana. */
  berwenang: boolean;
  /** Muat pertama selesai (berhasil atau tidak). */
  siap: boolean;
  /** Id tamu yang sedang diputuskan. */
  sibuk: string | null;
  izinkan: (tamuId: string) => Promise<HasilKeputusan>;
  tolak: (tamuId: string) => Promise<HasilKeputusan>;
  segarkan: () => Promise<void>;
}

export function useRuangTunggu(id: string, tanggal: string | null, opsi: OpsiRuangTunggu): RuangTungguLive {
  const { aktif } = opsi;
  const [menunggu, setMenunggu] = useState<PenungguTamu[]>([]);
  const [berwenang, setBerwenang] = useState(true);
  const [siap, setSiap] = useState(false);
  const [sibuk, setSibuk] = useState<string | null>(null);

  const hidup = useRef(true);
  const berjalan = useRef(false);
  const gagalBerturut = useRef(0);
  const diumumkan = useRef<Set<string>>(new Set());
  const berwenangRef = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTamuBaruRef = useRef(opsi.onTamuBaru);
  useEffect(() => {
    onTamuBaruRef.current = opsi.onTamuBaru;
  });

  const tik = useCallback(async (): Promise<void> => {
    if (berjalan.current || !hidup.current) {
      return;
    }
    berjalan.current = true;
    try {
      const r = await ruangTunggu(id, tanggal);
      if (!hidup.current) {
        return;
      }
      gagalBerturut.current = 0;
      setMenunggu(r.waiting);
      setSiap(true);
      const { baru, tercatat } = tamuBaru(diumumkan.current, r.waiting);
      diumumkan.current = tercatat;
      if (baru.length > 0) {
        try {
          onTamuBaruRef.current?.(baru);
        } catch {
          // Pemberitahuan tidak boleh menghentikan pemantauan.
        }
      }
    } catch (e) {
      if (!hidup.current) {
        return;
      }
      const s = e instanceof ApiError ? e.status : -1;
      if (hentikanPantau(s)) {
        berwenangRef.current = false;
        setBerwenang(false);
        setMenunggu([]);
        setSiap(true);
        return;
      }
      gagalBerturut.current += 1;
      setSiap(true);
    } finally {
      berjalan.current = false;
    }
  }, [id, tanggal]);

  // Pemantau: satu loop setTimeout (bukan interval) agar jeda bisa membesar saat gagal.
  useEffect(() => {
    hidup.current = true;
    berwenangRef.current = true;
    gagalBerturut.current = 0;
    diumumkan.current = new Set();
    if (!aktif) {
      return () => {
        hidup.current = false;
      };
    }
    const bersihkan = (): void => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
    const jadwalkan = (ms: number): void => {
      bersihkan();
      timer.current = setTimeout(() => void putaran(), ms);
    };
    const putaran = async (): Promise<void> => {
      if (!bolehPantau({ aktif, berwenang: berwenangRef.current, appAktif: AppState.currentState === 'active' }) || !hidup.current) {
        return;
      }
      await tik();
      if (hidup.current && bolehPantau({ aktif, berwenang: berwenangRef.current, appAktif: AppState.currentState === 'active' })) {
        jadwalkan(jedaRuangTunggu(gagalBerturut.current));
      }
    };

    const langganan = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        gagalBerturut.current = 0;
        bersihkan();
        void putaran();
      } else {
        bersihkan();
      }
    });
    void putaran();

    return () => {
      hidup.current = false;
      bersihkan();
      langganan.remove();
    };
  }, [aktif, tik]);

  const putuskan = useCallback(
    async (aksi: Extract<AksiTamu, 'izinkan' | 'tolak'>, tamuId: string): Promise<HasilKeputusan> => {
      if (!adalahOnline()) {
        return { ok: false, pesan: pesanGalatTamu(aksi, { status: 0 }), offline: true };
      }
      if (sibuk !== null) {
        return { ok: false, pesan: 'Tunggu sebentar, keputusan sebelumnya masih diproses.', offline: false };
      }
      setSibuk(tamuId);
      try {
        const tamu = aksi === 'izinkan' ? await izinkanTamu(id, tamuId, tanggal) : await tolakTamu(id, tamuId, tanggal);
        if (hidup.current) {
          setMenunggu((lama) => lama.filter((m) => m.id !== tamuId));
        }
        return { ok: true, tamu };
      } catch (e) {
        const status = e instanceof ApiError ? e.status : -1;
        // 409 status_berubah / 404: orang lain sudah memutuskan atau tamu dicabut — muat ulang daftar.
        if (status === 409 || status === 404 || status === 410) {
          void tik();
        }
        return {
          ok: false,
          pesan: pesanGalatTamu(aksi, { status, code: e instanceof ApiError ? e.code : null, message: e instanceof ApiError ? e.message : null }),
          offline: status === 0,
        };
      } finally {
        if (hidup.current) {
          setSibuk(null);
        }
      }
    },
    [id, tanggal, sibuk, tik],
  );

  const izinkan = useCallback((tamuId: string) => putuskan('izinkan', tamuId), [putuskan]);
  const tolak = useCallback((tamuId: string) => putuskan('tolak', tamuId), [putuskan]);
  const segarkan = useCallback(() => tik(), [tik]);

  return { menunggu, jumlah: menunggu.length, berwenang, siap, sibuk, izinkan, tolak, segarkan };
}
