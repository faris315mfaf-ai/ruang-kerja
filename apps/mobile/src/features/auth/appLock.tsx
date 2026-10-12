/**
 * Kunci aplikasi + buka dengan sidik jari (modul 01 › "Biometrik dan kunci").
 *
 * Satu sakelar per perangkat: `enabled` (UI menyebutnya "Buka dengan sidik jari"
 * dan "Kunci aplikasi" — keduanya sama). Disimpan di SecureStore `rk.lock.*`;
 * token sesi tetap di `rk.sesi` (kata sandi tidak pernah disimpan). Cadangan
 * saat biometrik gagal = kunci layar Android, lalu KATA SANDI (keluar → Masuk),
 * bukan Google.
 *
 * API untuk layar Keamanan (S1b):
 *
 *   const { enabled, setEnabled, lockAfter, setLockAfter, supported, support } = useAppLock();
 *   const hasil = await setEnabled(true);   // minta verifikasi sidik jari dulu
 *   if (!hasil.ok) tampilkan(hasil.reason); // 'not_enrolled' | 'unavailable' | 'cancel' | 'failed'
 *   await setEnabled(false);                // mematikan langsung (konfirmasi = urusan layar)
 *   await setLockAfter(5);                  // 0 = segera, 1 / 5 / 15 menit
 *   await bukaSetelanKeamanan();            // tombol "Buka Setelan" saat not_enrolled
 *
 * Alur kamera/izin yang memicu AppState 'background' (dialog izin Android)
 * membungkus kerjanya dengan `tahanKunci(() => …)` supaya tidak terkunci sendiri.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { daftarPerangkat, setBiometrikPerangkat } from '@/api/endpoints';
import { useSession } from '@/session/SessionProvider';

const KEY_ENABLED = 'rk.lock.enabled';
const KEY_AFTER = 'rk.lock.after';
const KEY_OFFERED = 'rk.lock.offered';

/** Batas kunci setelah di latar: 0 = segera, selain itu menit. */
export type LockAfter = 0 | 1 | 5 | 15;
export const LOCK_AFTER_OPTIONS: readonly LockAfter[] = [0, 1, 5, 15];
export const LOCK_AFTER_DEFAULT: LockAfter = 1;

export function lockAfterLabel(nilai: LockAfter): string {
  return nilai === 0 ? 'Segera' : `${nilai} menit`;
}

/** Kesiapan perangkat: sensor/kunci layar. */
export type DukunganKunci = 'checking' | 'ready' | 'not_enrolled' | 'unavailable';

export type AlasanGagal =
  | 'not_enrolled' // belum ada sidik jari / kunci layar (perangkat punya sensor)
  | 'unavailable' // tidak ada sensor dan tidak ada kunci layar
  | 'cancel' // pengguna menutup dialog
  | 'lockout' // 5 gagal → Android mengunci sementara
  | 'lockout_permanent'
  | 'failed'; // sidik jari tidak cocok / galat lain

export type HasilVerifikasi = { ok: true } | { ok: false; reason: AlasanGagal };

interface AppLockValue {
  /** Pengaturan sudah dibaca dari SecureStore. */
  ready: boolean;
  enabled: boolean;
  lockAfter: LockAfter;
  /** Perangkat punya kunci layar / biometrik yang bisa dipakai. */
  supported: boolean;
  support: DukunganKunci;
  /** Layar kunci sedang menutup aplikasi (sesi ada, kunci aktif). */
  locked: boolean;
  /** Tawaran "Buka dengan sidik jari" belum pernah dilihat di perangkat ini. */
  offerPending: boolean;
  setEnabled: (next: boolean) => Promise<HasilVerifikasi>;
  setLockAfter: (next: LockAfter) => Promise<void>;
  /** Tampilkan dialog sistem; sukses = layar kunci dibuka. */
  unlock: () => Promise<HasilVerifikasi>;
  /** Tandai tawaran sudah dilihat ("Nanti saja" tidak muncul lagi otomatis). */
  markOffered: () => Promise<void>;
  /** Jalankan pekerjaan yang membuka dialog sistem (izin, kamera) tanpa memicu kunci. */
  tahanKunci: <T>(kerja: () => Promise<T>) => Promise<T>;
  /** Periksa ulang dukungan perangkat (mis. kembali dari Setelan). */
  segarkanDukungan: () => Promise<DukunganKunci>;
}

const AppLockContext = createContext<AppLockValue | null>(null);

function petakanGalat(hasil: LocalAuthentication.LocalAuthenticationResult): HasilVerifikasi {
  if (hasil.success) {
    return { ok: true };
  }
  switch (hasil.error) {
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
    case 'user_fallback':
      return { ok: false, reason: 'cancel' };
    case 'lockout':
      return { ok: false, reason: 'lockout' };
    case 'not_enrolled':
    case 'passcode_not_set':
      return { ok: false, reason: 'not_enrolled' };
    case 'not_available':
      return { ok: false, reason: 'unavailable' };
    default:
      return { ok: false, reason: 'failed' };
  }
}

async function periksaDukungan(): Promise<DukunganKunci> {
  try {
    const [perangkatKeras, level] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);
    if (level !== LocalAuthentication.SecurityLevel.NONE) {
      return 'ready';
    }
    return perangkatKeras ? 'not_enrolled' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** Buka Setelan Keamanan Android (cadangan: setelan aplikasi). */
export async function bukaSetelanKeamanan(): Promise<void> {
  try {
    await Linking.sendIntent('android.settings.SECURITY_SETTINGS');
  } catch {
    await Linking.openSettings().catch(() => undefined);
  }
}

/** Sinkronkan penanda biometrik ke server untuk perangkat ini (upaya terbaik, galat diabaikan). */
async function sinkronkanServer(aktif: boolean): Promise<void> {
  try {
    const { devices } = await daftarPerangkat();
    const ini = devices.find((d) => d.is_current);
    if (ini) {
      await setBiometrikPerangkat(ini.id, aktif);
    }
  } catch {
    // Tidak kritis: pengaturan lokal tetap berlaku.
  }
}

async function hapusPengaturan(): Promise<void> {
  await Promise.all([KEY_ENABLED, KEY_AFTER, KEY_OFFERED].map((k) => SecureStore.deleteItemAsync(k).catch(() => undefined)));
}

export function AppLockProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { status } = useSession();
  const [ready, setReady] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [lockAfter, setLockAfterState] = useState<LockAfter>(LOCK_AFTER_DEFAULT);
  const [offered, setOffered] = useState(true);
  const [support, setSupport] = useState<DukunganKunci>('checking');
  // Kunci aktif saat dingin; dilepas setelah verifikasi, atau saat masuk baru di sesi berjalan.
  const [kunciTertutup, setKunciTertutup] = useState(true);

  const sibukRef = useRef(0); // >0 = dialog sistem sedang tampil: abaikan perubahan AppState
  const keLatarRef = useRef<number | null>(null);
  const statusSebelumnya = useRef(status);
  const enabledRef = useRef(enabled);
  const lockAfterRef = useRef(lockAfter);
  enabledRef.current = enabled;
  lockAfterRef.current = lockAfter;

  // Baca pengaturan tersimpan + dukungan perangkat.
  useEffect(() => {
    let batal = false;
    (async () => {
      const [e, a, o, dukung] = await Promise.all([
        SecureStore.getItemAsync(KEY_ENABLED).catch(() => null),
        SecureStore.getItemAsync(KEY_AFTER).catch(() => null),
        SecureStore.getItemAsync(KEY_OFFERED).catch(() => null),
        periksaDukungan(),
      ]);
      if (batal) {
        return;
      }
      const menit = Number(a);
      setEnabledState(e === '1' && dukung === 'ready');
      setLockAfterState(LOCK_AFTER_OPTIONS.includes(menit as LockAfter) ? (menit as LockAfter) : LOCK_AFTER_DEFAULT);
      setOffered(o === '1');
      setSupport(dukung);
      setReady(true);
    })();
    return () => {
      batal = true;
    };
  }, []);

  // Masuk baru (bukan buka dingin) → tidak perlu dikunci; keluar → bersihkan pengaturan perangkat.
  useEffect(() => {
    const sebelum = statusSebelumnya.current;
    statusSebelumnya.current = status;
    if (status === 'masuk' && sebelum === 'keluar') {
      setKunciTertutup(false);
    }
    if (status === 'keluar') {
      setKunciTertutup(true);
      if (sebelum !== 'keluar') {
        setEnabledState(false);
        setLockAfterState(LOCK_AFTER_DEFAULT);
        setOffered(false);
        void hapusPengaturan();
      }
    }
  }, [status]);

  // Kunci ulang saat kembali dari latar lebih lama dari batas.
  useEffect(() => {
    const langganan = AppState.addEventListener('change', (state) => {
      if (sibukRef.current > 0) {
        return;
      }
      if (state === 'background') {
        keLatarRef.current = Date.now();
        return;
      }
      if (state === 'active') {
        const sejak = keLatarRef.current;
        keLatarRef.current = null;
        if (sejak === null || !enabledRef.current) {
          return;
        }
        const batas = lockAfterRef.current * 60_000;
        if (Date.now() - sejak >= batas) {
          setKunciTertutup(true);
        }
      }
    });
    return () => langganan.remove();
  }, []);

  const tahanKunci = useCallback(async <T,>(kerja: () => Promise<T>): Promise<T> => {
    sibukRef.current += 1;
    try {
      return await kerja();
    } finally {
      // Beri waktu AppState 'active' tiba sebelum penjaga dilepas.
      setTimeout(() => {
        sibukRef.current = Math.max(0, sibukRef.current - 1);
      }, 800);
    }
  }, []);

  const verifikasi = useCallback(
    async (pesan: string, batal: string): Promise<HasilVerifikasi> => {
      const dukung = await periksaDukungan();
      setSupport(dukung);
      if (dukung !== 'ready') {
        return { ok: false, reason: dukung === 'not_enrolled' ? 'not_enrolled' : 'unavailable' };
      }
      try {
        const hasil = await tahanKunci(() =>
          LocalAuthentication.authenticateAsync({
            promptMessage: pesan,
            cancelLabel: batal,
            disableDeviceFallback: false,
            requireConfirmation: false,
          }),
        );
        return petakanGalat(hasil);
      } catch {
        return { ok: false, reason: 'failed' };
      }
    },
    [tahanKunci],
  );

  const unlock = useCallback(async (): Promise<HasilVerifikasi> => {
    const hasil = await verifikasi('Buka RuangKerja', 'Pakai kata sandi');
    if (hasil.ok) {
      setKunciTertutup(false);
    }
    return hasil;
  }, [verifikasi]);

  const setEnabled = useCallback(
    async (next: boolean): Promise<HasilVerifikasi> => {
      if (next) {
        const hasil = await verifikasi('Aktifkan buka dengan sidik jari', 'Batal');
        if (!hasil.ok) {
          return hasil;
        }
        await SecureStore.setItemAsync(KEY_ENABLED, '1').catch(() => undefined);
        await SecureStore.setItemAsync(KEY_OFFERED, '1').catch(() => undefined);
        setEnabledState(true);
        setOffered(true);
        setKunciTertutup(false);
        void sinkronkanServer(true);
        return { ok: true };
      }
      await SecureStore.deleteItemAsync(KEY_ENABLED).catch(() => undefined);
      setEnabledState(false);
      void sinkronkanServer(false);
      return { ok: true };
    },
    [verifikasi],
  );

  const setLockAfter = useCallback(async (next: LockAfter): Promise<void> => {
    setLockAfterState(next);
    await SecureStore.setItemAsync(KEY_AFTER, String(next)).catch(() => undefined);
  }, []);

  const markOffered = useCallback(async (): Promise<void> => {
    setOffered(true);
    await SecureStore.setItemAsync(KEY_OFFERED, '1').catch(() => undefined);
  }, []);

  const segarkanDukungan = useCallback(async (): Promise<DukunganKunci> => {
    const dukung = await periksaDukungan();
    setSupport(dukung);
    return dukung;
  }, []);

  const value = useMemo<AppLockValue>(
    () => ({
      ready,
      enabled,
      lockAfter,
      supported: support === 'ready',
      support,
      locked: ready && status === 'masuk' && enabled && kunciTertutup,
      offerPending: ready && !offered && !enabled && support === 'ready',
      setEnabled,
      setLockAfter,
      unlock,
      markOffered,
      tahanKunci,
      segarkanDukungan,
    }),
    [ready, enabled, lockAfter, support, status, kunciTertutup, offered, setEnabled, setLockAfter, unlock, markOffered, tahanKunci, segarkanDukungan],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockValue {
  const nilai = useContext(AppLockContext);
  if (!nilai) {
    throw new Error('useAppLock harus di dalam AppLockProvider');
  }
  return nilai;
}
