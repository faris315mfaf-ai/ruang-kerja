/**
 * Sesi ponsel: token + profil di SecureStore, konteks React, validasi saat
 * aplikasi dibuka (GET /auth/saya), alur masuk bertahap (kata sandi → TOTP →
 * wajib ganti sandi) dan gerbang akun.
 *
 * - 401 saat sesi berjalan: sesi DITAHAN (`sesiBerakhir`) agar dialog "Sesi
 *   berakhir" bisa tampil di atas layar yang sedang diisi; "Masuk lagi" lalu
 *   membersihkan sesi. 401 saat buka dingin / akun nonaktif: langsung keluar
 *   dengan alasan di layar Masuk.
 * - 403 `password_change_required` / `two_factor_setup_required` → `blokir`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import {
  duaFaktor,
  login as apiLogin,
  logout as apiLogout,
  saya,
} from '@/api/endpoints';
import { setAccountBlockedHandler, setTokenGetter, setUnauthorizedHandler, type BlokirAkun } from '@/api/client';
import { adalahTantangan, normalisasiProfil, type SesiDibuka, type UserProfile } from '@/api/types';
import { deviceInfo } from '@/lib/device';
import { akhiriSesiOffline, mulaiSesiOffline } from '@/offline/sesi';

const SESI_KEY = 'rk.sesi';

type StatusSesi = 'memuat' | 'masuk' | 'keluar';

interface SesiTersimpan {
  token: string;
  user: UserProfile;
}

/** Mengapa sesi berakhir — ditampilkan sebagai banner di layar Masuk. */
export interface AlasanKeluar {
  jenis: 'sesi_berakhir' | 'akun_nonaktif';
  message: string;
}

export interface Tantangan {
  token: string;
  /** Epoch ms tantangan kedaluwarsa (5 menit sejak diterbitkan). */
  kedaluwarsaPada: number;
}

export type HasilMasuk = { kind: 'sesi' } | { kind: 'dua_faktor' };

interface SessionValue {
  status: StatusSesi;
  user: UserProfile | null;
  /** Server menolak sesi ini sampai pengguna bertindak (ganti sandi / aktifkan 2FA di web). */
  blokir: BlokirAkun | null;
  /** 401 saat sesi berjalan: dialog "Sesi berakhir" tampil sampai pengguna memilih. */
  sesiBerakhir: boolean;
  /** Alasan sesi dibersihkan (tampil di layar Masuk), null bila keluar biasa. */
  alasanKeluar: AlasanKeluar | null;
  /** Tantangan TOTP yang sedang menunggu kode. */
  tantangan: Tantangan | null;
  /** Memeriksa ulang sesi (GET /auth/saya) dan membersihkan blokir bila sudah selesai. */
  periksaUlang: () => Promise<void>;
  masuk: (email: string, password: string) => Promise<HasilMasuk>;
  /** Buka sesi dari respons "sesi dibuka" (dua-faktor / lupa-sandi selesai). */
  bukaSesi: (sesi: SesiDibuka) => Promise<void>;
  mulaiTantangan: (token: string, expiresInDetik: number) => void;
  batalkanTantangan: () => void;
  verifikasiDuaFaktor: (input: { code?: string; recoveryCode?: string }) => Promise<void>;
  /** Ganti sandi wajib selesai: profil baru dari server, blokir dibersihkan. */
  sandiDiganti: (profil: UserProfile) => void;
  keluar: () => Promise<void>;
  perbaruiProfil: (user: UserProfile) => void;
  /** Dialog "Sesi berakhir" → "Masuk lagi": bersihkan sesi, tampilkan Masuk. */
  masukLagi: () => Promise<void>;
  /** Dialog "Sesi berakhir" → "Nanti": tutup dialog, sesi tetap ditahan. */
  tundaSesiBerakhir: () => void;
  hapusAlasanKeluar: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

async function bacaSesi(): Promise<SesiTersimpan | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESI_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { token?: string; user?: Parameters<typeof normalisasiProfil>[0] };
    return parsed.token && parsed.user ? { token: parsed.token, user: normalisasiProfil(parsed.user) } : null;
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

const PESAN_SANDI_WAJIB = 'Akun Anda masih memakai kata sandi bawaan atau kata sandi dari HR. Buat kata sandi sendiri untuk melanjutkan ke aplikasi.';

export function SessionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<StatusSesi>('memuat');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [blokir, setBlokir] = useState<BlokirAkun | null>(null);
  const [sesiBerakhir, setSesiBerakhir] = useState(false);
  const [alasanKeluar, setAlasanKeluar] = useState<AlasanKeluar | null>(null);
  const [tantangan, setTantangan] = useState<Tantangan | null>(null);
  const tokenRef = useRef<string | null>(null);
  const dingin = useRef(true); // validasi awal sedang berjalan: 401 → langsung keluar
  const cooldownSampai = useRef(0);

  const bersihkan = useCallback(async (alasan: AlasanKeluar | null = null): Promise<void> => {
    // Data offline: keluar/akun nonaktif = hapus semua; sesi berakhir (401) = hanya cache baca, antrean tulis dipertahankan.
    void akhiriSesiOffline(alasan === null ? 'keluar' : alasan.jenis === 'akun_nonaktif' ? 'akun_nonaktif' : 'sesi_berakhir');
    tokenRef.current = null;
    setBlokir(null);
    setUser(null);
    setSesiBerakhir(false);
    setTantangan(null);
    setAlasanKeluar(alasan);
    setStatus('keluar');
    await simpanSesi(null);
  }, []);

  useEffect(() => {
    setTokenGetter(() => tokenRef.current);
    setUnauthorizedHandler((pesan) => {
      if (tokenRef.current === null) {
        return;
      }
      if (pesan !== null) {
        void bersihkan({ jenis: 'akun_nonaktif', message: pesan });
      } else if (dingin.current) {
        void bersihkan({ jenis: 'sesi_berakhir', message: 'Sesi Anda berakhir. Masuk lagi untuk melanjutkan.' });
      } else if (Date.now() >= cooldownSampai.current) {
        setSesiBerakhir(true);
      }
    });
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
        dingin.current = false;
        if (!dibatalkan) {
          setStatus('keluar');
        }
        return;
      }

      tokenRef.current = tersimpan.token;
      mulaiSesiOffline(tersimpan.user.id);
      setUser(tersimpan.user);
      if (tersimpan.user.password_change_required) {
        setBlokir({ code: 'password_change_required', message: PESAN_SANDI_WAJIB });
      }
      setStatus('masuk');

      try {
        const profil = await saya();
        if (!dibatalkan) {
          setUser(profil);
          setBlokir((lama) =>
            profil.password_change_required
              ? { code: 'password_change_required', message: PESAN_SANDI_WAJIB }
              : lama?.code === 'password_change_required'
                ? null
                : lama,
          );
          await simpanSesi({ token: tersimpan.token, user: profil });
        }
      } catch {
        // 401 sudah men-trigger bersihkan; galat lain (offline): biarkan sesi lokal.
      } finally {
        dingin.current = false;
      }
    })();

    return () => {
      dibatalkan = true;
    };
  }, []);

  const bukaSesi = useCallback(async (sesi: SesiDibuka): Promise<void> => {
    tokenRef.current = sesi.token;
    let profil = normalisasiProfil({ ...sesi.user, password_change_required: sesi.password_change_required });
    try {
      // Profil lengkap (peran, fitur, …); terbuka juga untuk akun "wajib ganti sandi".
      profil = await saya();
    } catch {
      // Pakai profil ringkas; layar akan mengambil ulang.
    }
    mulaiSesiOffline(profil.id);
    const wajibGanti = sesi.password_change_required || profil.password_change_required;
    setBlokir(wajibGanti ? { code: 'password_change_required', message: PESAN_SANDI_WAJIB } : null);
    setUser(profil);
    setAlasanKeluar(null);
    setSesiBerakhir(false);
    setTantangan(null);
    setStatus('masuk');
    await simpanSesi({ token: sesi.token, user: profil });
  }, []);

  const mulaiTantangan = useCallback((token: string, expiresInDetik: number): void => {
    setTantangan({ token, kedaluwarsaPada: Date.now() + expiresInDetik * 1000 });
  }, []);

  const batalkanTantangan = useCallback((): void => setTantangan(null), []);

  const masuk = useCallback(
    async (email: string, password: string): Promise<HasilMasuk> => {
      const hasil = await apiLogin(email, password, await deviceInfo());
      if (adalahTantangan(hasil)) {
        mulaiTantangan(hasil.challenge_token, hasil.expires_in);
        return { kind: 'dua_faktor' };
      }
      await bukaSesi(hasil);
      return { kind: 'sesi' };
    },
    [bukaSesi, mulaiTantangan],
  );

  const verifikasiDuaFaktor = useCallback(
    async (input: { code?: string; recoveryCode?: string }): Promise<void> => {
      if (tantangan === null) {
        throw new Error('Tantangan tidak ditemukan.');
      }
      const sesi = await duaFaktor(tantangan.token, input);
      await bukaSesi(sesi);
    },
    [tantangan, bukaSesi],
  );

  const periksaUlang = useCallback(async (): Promise<void> => {
    const token = tokenRef.current;
    if (token === null) {
      return;
    }
    try {
      // 403 mengisi ulang `blokir` lewat handler sebelum melempar.
      const profil = await saya();
      setBlokir(profil.password_change_required ? { code: 'password_change_required', message: PESAN_SANDI_WAJIB } : null);
      setUser(profil);
      await simpanSesi({ token, user: profil });
    } catch {
      // Masih terblokir, offline, atau 401 (ditangani bersihkan).
    }
  }, []);

  const sandiDiganti = useCallback((profil: UserProfile): void => {
    setBlokir(null);
    setUser(profil);
    const token = tokenRef.current;
    if (token) {
      void simpanSesi({ token, user: profil });
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

  const masukLagi = useCallback(async () => {
    await bersihkan({ jenis: 'sesi_berakhir', message: 'Sesi Anda berakhir. Masuk lagi untuk melanjutkan.' });
  }, [bersihkan]);

  const tundaSesiBerakhir = useCallback((): void => {
    cooldownSampai.current = Date.now() + 120_000;
    setSesiBerakhir(false);
  }, []);

  const perbaruiProfil = useCallback((profil: UserProfile) => {
    setUser(profil);
  }, []);

  const hapusAlasanKeluar = useCallback((): void => setAlasanKeluar(null), []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      blokir,
      sesiBerakhir,
      alasanKeluar,
      tantangan,
      periksaUlang,
      masuk,
      bukaSesi,
      mulaiTantangan,
      batalkanTantangan,
      verifikasiDuaFaktor,
      sandiDiganti,
      keluar,
      perbaruiProfil,
      masukLagi,
      tundaSesiBerakhir,
      hapusAlasanKeluar,
    }),
    [
      status,
      user,
      blokir,
      sesiBerakhir,
      alasanKeluar,
      tantangan,
      periksaUlang,
      masuk,
      bukaSesi,
      mulaiTantangan,
      batalkanTantangan,
      verifikasiDuaFaktor,
      sandiDiganti,
      keluar,
      perbaruiProfil,
      masukLagi,
      tundaSesiBerakhir,
      hapusAlasanKeluar,
    ],
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
