/**
 * Status absensi hari ini untuk tombol tengah tab bar: memuat
 * `GET absensi/hari-ini` saat tabs dibuka, saat aplikasi aktif kembali dan
 * saat pengguna berpindah tab (`refresh`), lalu menjadwalkan pergantian
 * Workspace → Absen pada jam pulang − 60 menit tanpa menunggu data baru.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { absensiHariIni } from '@/api/endpoints';
import { useSession } from '@/session/SessionProvider';

import { centerAction, nextCenterBoundary, type AttendanceActionState, type CenterAction } from './centerAction';

interface AttendanceStatusValue {
  action: AttendanceActionState;
  center: CenterAction;
  /** Muat ulang (mis. setelah check-in/out dari layar Absen). */
  refresh: () => Promise<void>;
}

const AttendanceStatusContext = createContext<AttendanceStatusValue>({
  action: null,
  center: 'absen',
  refresh: async () => undefined,
});

export function AttendanceStatusProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { status } = useSession();
  const [action, setAction] = useState<AttendanceActionState>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const hidup = useRef(true);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const hasil = await absensiHariIni();
      if (hidup.current) {
        setAction(hasil.today.action);
        setEnd(hasil.today.schedule.end);
        setNow(new Date());
      }
    } catch {
      // Gagal/offline: pertahankan keadaan terakhir (awal: Absen).
    }
  }, []);

  useEffect(() => {
    if (status !== 'masuk') {
      return undefined;
    }
    hidup.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat status saat sesi aktif
    void refresh();
    const langganan = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
      }
    });
    return () => {
      hidup.current = false;
      langganan.remove();
      setAction(null);
      setEnd(null);
    };
  }, [status, refresh]);

  // Jadwalkan pergantian Workspace → Absen (jam pulang − 60 menit).
  useEffect(() => {
    const batas = nextCenterBoundary(action, end, new Date());
    if (!batas) {
      return undefined;
    }
    const timer = setTimeout(() => setNow(new Date()), Math.max(1000, batas.getTime() - Date.now() + 500));
    return () => clearTimeout(timer);
  }, [action, end, now]);

  const value = useMemo<AttendanceStatusValue>(
    () => ({ action, center: centerAction(action, end, now), refresh }),
    [action, end, now, refresh],
  );

  return <AttendanceStatusContext.Provider value={value}>{children}</AttendanceStatusContext.Provider>;
}

export function useAttendanceStatus(): AttendanceStatusValue {
  return useContext(AttendanceStatusContext);
}
