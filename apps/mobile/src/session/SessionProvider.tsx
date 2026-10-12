/**
 * Sesi ponsel: token + profil pengguna di SecureStore, konteks React, dan
 * validasi saat aplikasi dibuka (GET /auth/saya). 401 dari endpoint mana pun
 * memakses handler di sini → sesi dibersihkan otomatis.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import { login as apiLogin, logout as apiLogout, saya } from '@/api/endpoints';
import { ApiError, setAccountBlockedHandler, setTokenGetter, setUnauthorizedHandler, type BlokirAkun } from '@/api/client';
import type { UserProfile } from '@/api/types';
import { deviceInfo } from '@/lib/device';

const SESI_KEY = 'rk.sesi';

type StatusSesi = 'memuat' | 'masuk' | 'keluar';

interface SesiTersimpan {
  token: string;
  user: UserProfile;
}

interface SessionValue {
  status: StatusSesi;
  user: UserProfile | null;
  /** Set when the server refuses this session until the user acts on the web (403 code). */
  blokir: BlokirAkun | null;
  /** Clears the block and re-checks the session (GET /auth/saya). */
  periksaUlang: () => Promise<void>;
  masuk: (email: string, password: string) => Promise<void>;
  keluar: () => Promise<void>;
  perbaruiProfil: (user: UserProfile) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

async function bacaSesi(): Promise<SesiTersimpan | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESI_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as SesiTersimpan;
    return parsed.token && parsed.user ? parsed : null;
  } catch {
    return null;
  }
}

async function simpanSesi(sesi: SesiTersimpan | null): Promise<void> {
  if (sesi === null) {
    await SecureStore.deleteItemAsync(SESI_KEY);
  } else {
    await SecureStore.setItemAsync(SESI_KEY, JSON.stringify(sesi));
  }
}

/**
 * Terjemahan pesan galat login ke Bahasa Indonesia yang siap tampil.
 * Melempar Error dengan .message ramah; kode 403 dibedakan lewat ApiError.code.
 */
export async function masukDenganKredensial(email: string, password: string): Promise<SesiTersimpan> {
  try {
    const hasil = await apiLogin(email, password, await deviceInfo());
    return { token: hasil.token, user: hasil.user };
  } catch (err) {
    if (err instanceof ApiError) {
      throw err; // pesan server sudah berbahasa Indonesia
    }
    throw new Error('Tidak dapat masuk. Coba lagi.');
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<StatusSesi>('memuat');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [blokir, setBlokir] = useState<BlokirAkun | null>(null);
  const tokenRef = useRef<string | null>(null);

  const bersihkan = useCallback(async (): Promise<void> => {
    tokenRef.current = null;
    setBlokir(null);
    setUser(null);
    setStatus('keluar');
    await simpanSesi(null);
  }, []);

  // Token untuk klien API + reaksi 401 (sesi habis / dicabut di server).
  useEffect(() => {
    setTokenGetter(() => tokenRef.current);
    setUnauthorizedHandler(() => {
      void bersihkan();
    });
    // Only meaningful with an active session; a blocked login is shown by the login screen.
    setAccountBlockedHandler((info) => {
      if (tokenRef.current !== null) {
        setBlokir((lama) => (lama?.code === info.code && lama.message === info.message ? lama : info));
      }
    });
    return () => {
      setTokenGetter(null);
      setUnauthorizedHandler(null);
      setAccountBlockedHandler(null);
    };
  }, [bersihkan]);

  // Validasi sesi tersimpan saat aplikasi dibuka.
  useEffect(() => {
    let dibatalkan = false;

    (async () => {
      const tersimpan = await bacaSesi();
      if (!tersimpan) {
        if (!dibatalkan) {
          setStatus('keluar');
        }
        return;
      }

      tokenRef.current = tersimpan.token;
      setUser(tersimpan.user);
      setStatus('masuk');

      try {
        const profil = await saya();
        if (!dibatalkan) {
          setUser(profil);
          await simpanSesi({ token: tersimpan.token, user: profil });
        }
      } catch {
        // 401 sudah men-trigger bersihkan; galat lain: biarkan sesi lokal.
      }
    })();

    return () => {
      dibatalkan = true;
    };
  }, []);

  const masuk = useCallback(async (email: string, password: string) => {
    const sesi = await masukDenganKredensial(email, password);
    tokenRef.current = sesi.token;
    setBlokir(null);
    setUser(sesi.user);
    setStatus('masuk');
    await simpanSesi(sesi);
  }, []);

  const periksaUlang = useCallback(async (): Promise<void> => {
    const token = tokenRef.current;
    if (token === null) {
      return;
    }
    try {
      // A 403 block re-sets `blokir` through the handler before this throws.
      const profil = await saya();
      setBlokir(null);
      setUser(profil);
      await simpanSesi({ token, user: profil });
    } catch {
      // Still blocked, offline, or 401 (handled by bersihkan).
    }
  }, []);

  const keluar = useCallback(async () => {
    const token = tokenRef.current;
    try {
      if (token) {
        await apiLogout();
      }
    } catch {
      // Keluar tetap dilanjutkan walau server tak terjangkau.
    }
    await bersihkan();
  }, [bersihkan]);

  const perbaruiProfil = useCallback((profil: UserProfile) => {
    setUser(profil);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ status, user, blokir, periksaUlang, masuk, keluar, perbaruiProfil }),
    [status, user, blokir, periksaUlang, masuk, keluar, perbaruiProfil],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const sesi = useContext(SessionContext);
  if (!sesi) {
    throw new Error('useSession harus di dalam SessionProvider');
  }
  return sesi;
}
