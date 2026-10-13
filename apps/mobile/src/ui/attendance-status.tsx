/**
 * Status absensi hari ini untuk tombol tengah tab bar. Sumber utama = payload
 * `state.center` dari `GET absensi/hari-ini` (`{action, badge, flipsAt}`): tombol
 * berganti Workspace → Absen (berlencana) tepat pada `flipsAt` lewat satu timer,
 * tanpa polling. Bila server lama tidak mengirim `state`, keadaan diturunkan
 * lokal dari `today.action` + jam pulang (`centerAction`).
 *
 * Dimuat saat tabs dibuka, saat aplikasi aktif kembali, dan saat pengguna
 * berpindah tab (`refresh`). Layar Absen yang sudah memuat data sendiri memakai
 * `terapkan(data)` supaya tidak ada permintaan ganda.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { absensiHariIniLengkap, type HariIni } from '@/api/absensi';
import { useSession } from '@/session/SessionProvider';

import { centerAction, nextCenterBoundary, type AttendanceActionState, type CenterAction } from './centerAction';

interface AttendanceStatusValue {
  action: AttendanceActionState;
  center: CenterAction;
  /** Lencana "!" pada tombol Absen: sudah waktunya check-out. */
  badge: boolean;
  /** Muat ulang (mis. setelah check-in/out dari layar Absen). */
  refresh: () => Promise<void>;
  /** Pakai data hari-ini yang baru dimuat layar lain (tanpa permintaan ulang). */
  terapkan: (data: HariIni) => void;
}

const AttendanceStatusContext = createContext<AttendanceStatusValue>({
  action: null,
  center: 'absen',
  badge: false,
  refresh: async () => undefined,
  terapkan: () => undefined,
});

function hitungPusat(hari: HariIni | null, now: Date): { center: CenterAction; badge: boolean } {
  const c = hari?.state?.center;
  if (c) {
    if (c.flipsAt && Date.parse(c.flipsAt) <= now.getTime()) {
      return { center: 'absen', badge: true };
    }
    return { center: c.action, badge: c.badge };
  }
  const action = hari?.today.action ?? null;
  const center = centerAction(action, hari?.today.schedule.end, now);
  return { center, badge: action === 'check_out' && center === 'absen' };
}

export function AttendanceStatusProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { status } = useSession();
  const [hari, setHari] = useState<HariIni | null>(null);
  const [now, setNow] = useState(() => new Date());
  const hidup = useRef(true);

  const terapkan = useCallback((data: HariIni): void => {
    if (hidup.current) {
      setHari(data);
      setNow(new Date());
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      terapkan(await absensiHariIniLengkap());
    } catch {
      // Gagal/offline: pertahankan keadaan terakhir (awal: Absen).
    }
  }, [terapkan]);

  useEffect(() => {
    if (status !== 'masuk') {
      return undefined;
    }
    hidup.current = true;
    void refresh();
    const langganan = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
      }
    });
    return () => {
      hidup.current = false;
      langganan.remove();
      setHari(null);
    };
  }, [status, refresh]);

  // Satu timer ke pergantian berikutnya (`flipsAt`, atau jam pulang − 60 menit untuk server lama).
  useEffect(() => {
    const flips = hari?.state?.center.flipsAt;
    const batas = flips ? new Date(flips) : hari?.state ? null : nextCenterBoundary(hari?.today.action ?? null, hari?.today.schedule.end, new Date());
    if (!batas || Number.isNaN(batas.getTime()) || batas.getTime() <= Date.now()) {
      return undefined;
    }
    const timer = setTimeout(() => setNow(new Date()), Math.max(1000, batas.getTime() - Date.now() + 500));
    return () => clearTimeout(timer);
  }, [hari, now]);

  const value = useMemo<AttendanceStatusValue>(() => {
    const { center, badge } = hitungPusat(hari, now);
    return { action: hari?.today.action ?? null, center, badge, refresh, terapkan };
  }, [hari, now, refresh, terapkan]);

  return <AttendanceStatusContext.Provider value={value}>{children}</AttendanceStatusContext.Provider>;
}

export function useAttendanceStatus(): AttendanceStatusValue {
  return useContext(AttendanceStatusContext);
}
