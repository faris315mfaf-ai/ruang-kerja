/**
 * Status izin runtime Android untuk layar Izin aplikasi & Notifikasi:
 * kamera (expo-camera), lokasi (expo-location), notifikasi
 * (`POST_NOTIFICATIONS` lewat PermissionsAndroid; Android 12 ke bawah otomatis).
 * Disegarkan saat layar fokus dan saat aplikasi kembali dari Setelan.
 */
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';

import { useAppLock } from '@/features/auth/appLock';
import { pastikanSaluran } from '@/features/notifikasi/push/saluranAndroid';
import { mintaDaftarUlangPush } from '@/features/notifikasi/push/status';

export type StatusIzin = 'memeriksa' | 'diizinkan' | 'ditolak' | 'belum';

const KEY_NOTIF_DITANYA = 'rk.izin.notif.ditanya';

async function statusKamera(): Promise<StatusIzin> {
  try {
    const r = await Camera.getCameraPermissionsAsync();
    return r.granted ? 'diizinkan' : r.canAskAgain && r.status === 'undetermined' ? 'belum' : 'ditolak';
  } catch {
    return 'belum';
  }
}

async function statusLokasi(): Promise<StatusIzin> {
  try {
    const r = await Location.getForegroundPermissionsAsync();
    return r.granted ? 'diizinkan' : r.canAskAgain && r.status === 'undetermined' ? 'belum' : 'ditolak';
  } catch {
    return 'belum';
  }
}

/** Android 13+ butuh izin runtime; di bawahnya otomatis diizinkan. */
function butuhIzinNotifikasi(): boolean {
  return Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version >= 33;
}

async function statusNotifikasi(): Promise<StatusIzin> {
  if (!butuhIzinNotifikasi()) {
    return 'diizinkan';
  }
  try {
    if (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) {
      return 'diizinkan';
    }
    const ditanya = await SecureStore.getItemAsync(KEY_NOTIF_DITANYA);
    return ditanya === '1' ? 'ditolak' : 'belum';
  } catch {
    return 'belum';
  }
}

export interface IzinAplikasi {
  kamera: StatusIzin;
  lokasi: StatusIzin;
  notifikasi: StatusIzin;
  segarkan: () => Promise<void>;
  /** Tampilkan dialog sistem izin notifikasi (hasil `true` bila diizinkan). */
  mintaNotifikasi: () => Promise<boolean>;
  bukaSetelan: () => void;
}

export function useIzinAplikasi(): IzinAplikasi {
  const { tahanKunci } = useAppLock();
  const [kamera, setKamera] = useState<StatusIzin>('memeriksa');
  const [lokasi, setLokasi] = useState<StatusIzin>('memeriksa');
  const [notifikasi, setNotifikasi] = useState<StatusIzin>('memeriksa');
  const hidup = useRef(true);

  useEffect(() => {
    hidup.current = true;
    return () => {
      hidup.current = false;
    };
  }, []);

  const segarkan = useCallback(async (): Promise<void> => {
    const [k, l, n] = await Promise.all([statusKamera(), statusLokasi(), statusNotifikasi()]);
    if (hidup.current) {
      setKamera(k);
      setLokasi(l);
      setNotifikasi(n);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void segarkan();
      const langganan = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          void segarkan();
        }
      });
      return () => langganan.remove();
    }, [segarkan]),
  );

  const mintaNotifikasi = useCallback(async (): Promise<boolean> => {
    if (!butuhIzinNotifikasi()) {
      return true;
    }
    try {
      // Android 13+ baru menampilkan dialog bila aplikasi sudah punya saluran notifikasi.
      await pastikanSaluran();
      const hasil = await tahanKunci(() => PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS));
      await SecureStore.setItemAsync(KEY_NOTIF_DITANYA, '1').catch(() => undefined);
      await segarkan();
      const diizinkan = hasil === PermissionsAndroid.RESULTS.GRANTED;
      if (diizinkan) {
        mintaDaftarUlangPush(); // daftarkan token push segera setelah izin diberikan
      }
      return diizinkan;
    } catch {
      return false;
    }
  }, [segarkan, tahanKunci]);

  const bukaSetelan = useCallback((): void => {
    void Linking.openSettings().catch(() => undefined);
  }, []);

  return { kamera, lokasi, notifikasi, segarkan, mintaNotifikasi, bukaSetelan };
}

export function labelIzin(status: StatusIzin): string {
  return status === 'diizinkan' ? 'Diizinkan' : status === 'ditolak' ? 'Ditolak' : status === 'belum' ? 'Belum diminta' : 'Memeriksa…';
}
