/**
 * Profil lengkap terbaru: tampil dari sesi tersimpan, lalu disegarkan lewat
 * `GET /auth/saya` setiap layar mendapat fokus (peran & flag fitur). Galat
 * jaringan (status 0) = offline: data tersimpan tetap dipakai.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { ApiError } from '@/api/client';
import { saya } from '@/api/endpoints';
import { useSession } from '@/session/SessionProvider';

import { bacaPeran, bacaProfil, type Peran, type ProfilLengkap } from './profile';

export interface ProfilState {
  profil: ProfilLengkap;
  peran: Peran;
  memuat: boolean;
  offline: boolean;
  galat: string | null;
  muatUlang: () => Promise<void>;
}

export function useProfilLengkap(): ProfilState {
  const { user, perbaruiProfil } = useSession();
  const [segar, setSegar] = useState<typeof user>(null);
  const [memuat, setMemuat] = useState(true);
  const [offline, setOffline] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const muatUlang = useCallback(async (): Promise<void> => {
    setMemuat(true);
    try {
      const terbaru = await saya();
      setSegar(terbaru);
      perbaruiProfil(terbaru);
      setOffline(false);
      setGalat(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setOffline(true);
        setGalat(null);
      } else {
        setGalat(err instanceof ApiError ? err.message : 'Profil gagal dimuat.');
      }
    } finally {
      setMemuat(false);
    }
  }, [perbaruiProfil]);

  useFocusEffect(
    useCallback(() => {
      void muatUlang();
    }, [muatUlang]),
  );

  const profil = useMemo(() => bacaProfil(segar ?? user), [segar, user]);
  const peran = useMemo(() => bacaPeran(profil), [profil]);

  return { profil, peran, memuat, offline, galat, muatUlang };
}
