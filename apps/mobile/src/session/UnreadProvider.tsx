/**
 * Jumlah inbox belum dibaca — dipakai lencana tab Lainnya dan baris Inbox
 * di layar Lainnya; diperbarui saat aplikasi kembali aktif dan setelah
 * menandai dibaca. Dipasang di _layout akar supaya layar Inbox di stack
 * (di luar tabs) juga bisa memakai konteks ini.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { inbox } from '@/api/endpoints';
import { useSession } from '@/session/SessionProvider';

interface UnreadValue {
  jumlah: number;
  perbarui: (nilai: number) => void;
  muatUlang: () => Promise<void>;
}

const UnreadContext = createContext<UnreadValue | null>(null);

export function UnreadProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [jumlah, setJumlah] = useState(0);
  const hidup = useRef(true);
  const { status } = useSession();

  const muatUlang = useCallback(async (): Promise<void> => {
    try {
      const hasil = await inbox(1, false);
      if (hidup.current) {
        setJumlah(hasil.unread);
      }
    } catch {
      // Tab tetap tampil; lencana dicoba lagi lain waktu.
    }
  }, []);

  // Hanya memuat jumlah saat benar-benar ada sesi (provider kini selalu
  // terpasang, termasuk sebelum login). Bergantung pada `status` supaya
  // lencana dimuat setelah login dan dikosongkan saat keluar.
  useEffect(() => {
    if (status !== 'masuk') {
      hidup.current = false;
      return;
    }
    hidup.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat jumlah saat sesi aktif
    void muatUlang();

    const langganan = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void muatUlang();
      }
    });

    return () => {
      hidup.current = false;
      langganan.remove();
      // Keluar / ganti akun: jangan bawa lencana pengguna sebelumnya.
      setJumlah(0);
    };
  }, [status, muatUlang]);

  const value = useMemo<UnreadValue>(
    () => ({ jumlah: status === 'masuk' ? jumlah : 0, perbarui: setJumlah, muatUlang }),
    [status, jumlah, muatUlang],
  );

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread(): UnreadValue {
  const nilai = useContext(UnreadContext);
  if (!nilai) {
    throw new Error('useUnread harus di dalam UnreadProvider');
  }
  return nilai;
}
