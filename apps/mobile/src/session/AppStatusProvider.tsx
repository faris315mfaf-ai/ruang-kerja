/**
 * Status tingkat-aplikasi dari server: versi minimal (426), pemeliharaan (503),
 * dan versi terbaru (banner "Update tersedia"). `GET /konfigurasi` dipanggil
 * sekali saat buka dingin tanpa memblokir; gagal = lanjut normal.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { APP_VERSION, setAppStatusHandler, type StatusAplikasi } from '@/api/client';
import { konfigurasi } from '@/api/endpoints';
import type { KonfigurasiApp } from '@/api/types';

/** Bandingkan "1.2.3" dengan "1.10.0": <0, 0, >0. Segmen non-numerik dianggap 0. */
export function bandingkanVersi(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const selisih = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (selisih !== 0) {
      return selisih;
    }
  }
  return 0;
}

interface AppStatusValue {
  config: KonfigurasiApp | null;
  /** Layar penuh yang menutup aplikasi: versi tidak didukung atau pemeliharaan. */
  blokir: StatusAplikasi | null;
  /** Versi terbaru bila lebih baru dari yang terpasang dan belum ditunda. */
  updateTersedia: string | null;
  tundaUpdate: () => void;
  /** Ambil ulang konfigurasi; true bila blokir sudah hilang. */
  periksaUlang: () => Promise<boolean>;
}

const AppStatusContext = createContext<AppStatusValue | null>(null);

export function AppStatusProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [config, setConfig] = useState<KonfigurasiApp | null>(null);
  const [blokir, setBlokir] = useState<StatusAplikasi | null>(null);
  const [update, setUpdate] = useState<string | null>(null);
  const [ditunda, setDitunda] = useState(false);

  const terapkan = useCallback((c: KonfigurasiApp): StatusAplikasi | null => {
    setConfig(c);
    if (bandingkanVersi(APP_VERSION, c.min_app_version) < 0) {
      return {
        kind: 'update_required',
        message: `Versi ${APP_VERSION} tidak lagi didukung. Perbarui ke versi ${c.latest_app_version} untuk melanjutkan.`,
        minVersion: c.min_app_version,
      };
    }
    if (c.maintenance.active) {
      return { kind: 'maintenance', message: c.maintenance.message };
    }
    setUpdate(bandingkanVersi(APP_VERSION, c.latest_app_version) < 0 ? c.latest_app_version : null);
    return null;
  }, []);

  useEffect(() => {
    setAppStatusHandler((s) => setBlokir(s));
    return () => setAppStatusHandler(null);
  }, []);

  useEffect(() => {
    let batal = false;
    konfigurasi()
      .then((c) => {
        if (batal) {
          return;
        }
        const s = terapkan(c);
        if (s) {
          setBlokir(s);
        }
      })
      .catch(() => undefined); // tidak memblokir: lanjut tanpa konfigurasi
    return () => {
      batal = true;
    };
  }, [terapkan]);

  const periksaUlang = useCallback(async (): Promise<boolean> => {
    try {
      const c = await konfigurasi();
      const s = terapkan(c);
      setBlokir(s);
      return s === null;
    } catch {
      return false;
    }
  }, [terapkan]);

  const value = useMemo<AppStatusValue>(
    () => ({
      config,
      blokir,
      updateTersedia: ditunda ? null : update,
      tundaUpdate: () => setDitunda(true),
      periksaUlang,
    }),
    [config, blokir, update, ditunda, periksaUlang],
  );

  return <AppStatusContext.Provider value={value}>{children}</AppStatusContext.Provider>;
}

export function useAppStatus(): AppStatusValue {
  const v = useContext(AppStatusContext);
  if (!v) {
    throw new Error('useAppStatus harus di dalam AppStatusProvider');
  }
  return v;
}
