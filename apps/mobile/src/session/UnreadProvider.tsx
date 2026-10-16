/**
 * Jumlah inbox belum dibaca — dipakai lencana tab Lainnya dan baris Inbox
 * di layar Lainnya; diperbarui saat aplikasi kembali aktif dan setelah
 * menandai dibaca. Dipasang di _layout akar supaya layar Inbox di stack
 * (di luar tabs) juga bisa memakai konteks ini.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { jumlahBelumDibaca } from '@/api/inbox';
import { daftarObrolan } from '@/api/obrolan';
import { useSession } from '@/session/SessionProvider';

interface UnreadValue {
  jumlah: number;
  perbarui: (nilai: number) => void;
  muatUlang: () => Promise<void>;
  /** Jumlah KANAL obrolan berpesan belum dibaca (`unread_channels`) — lencana tab Obrolan. */
  obrolan: number;
  perbaruiObrolan: (nilai: number) => void;
}

const UnreadContext = createContext<UnreadValue | null>(null);

export function UnreadProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [jumlah, setJumlah] = useState(0);
  const [obrolan, setObrolan] = useState(0);
  const hidup = useRef(true);
  const { status, blokir } = useSession();
  // Selama server menolak sesi (wajib ganti sandi / setup 2FA) tidak ada yang dimuat.
  const terblokir = blokir !== null;

  const muatUlang = useCallback(async (): Promise<void> => {
    try {
      // GET /inbox?belum-dibaca=1&per_page=1 → meta.counts.belum_dibaca (hitungan global, bukan hanya halaman).
      const jumlahBaru = await jumlahBelumDibaca();
      if (hidup.current) {
        setJumlah(jumlahBaru);
      }
    } catch {
      // Tab tetap tampil; lencana dicoba lagi lain waktu.
    }
    try {
      const hasil = await daftarObrolan();
      if (hidup.current) {
        setObrolan(hasil.unread_channels);
      }
    } catch {
      // Obrolan mati (404) atau offline: lencana tab Obrolan tidak tampil.
    }
  }, []);

  // Hanya memuat jumlah saat benar-benar ada sesi (provider kini selalu
  // terpasang, termasuk sebelum login). Bergantung pada `status` supaya
  // lencana dimuat setelah login dan dikosongkan saat keluar.
  useEffect(() => {
    if (status !== 'masuk' || terblokir) {
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
      setObrolan(0);
    };
  }, [status, terblokir, muatUlang]);

  const value = useMemo<UnreadValue>(
    () => ({ jumlah: status === 'masuk' ? jumlah : 0, perbarui: setJumlah, muatUlang, obrolan: status === 'masuk' ? obrolan : 0, perbaruiObrolan: setObrolan }),
    [status, jumlah, obrolan, muatUlang],
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
