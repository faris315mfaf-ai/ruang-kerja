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

  useEffect(() => {
    hidup.current = true;
  }, []);

  // Hanya memuat jumlah saat benar-benar ada sesi (provider kini selalu
  // terpasang, termasuk sebelum login).
  useEffect(() => {
    if (status !== 'masuk') {
      return;
    }
    void muatUlang();

    const langganan = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void muatUlang();
      }
    });

    return () => {
      hidup.current = false;
      langganan.remove();
    };
  }, [muatUlang]);

  const value = useMemo<UnreadValue>(
    () => ({ jumlah, perbarui: setJumlah, muatUlang }),
    [jumlah, muatUlang],
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
