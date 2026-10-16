/**
 * Izin runtime Android untuk rapat video: kamera, mikrofon, dan (Android 12+)
 * Bluetooth untuk headset. Dialog sistem dibungkus `tahanKunci` agar kunci
 * aplikasi tidak menutup layar saat dialog kembali. "Jangan tanya lagi" →
 * `permanen` (hanya bisa lewat Buka Pengaturan aplikasi).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, PermissionsAndroid, Platform, type Permission } from 'react-native';

import { useAppLock } from '@/features/auth/appLock';

export type StatusIzinVideo = 'memeriksa' | 'diizinkan' | 'ditolak' | 'permanen' | 'belum';

const P = PermissionsAndroid.PERMISSIONS;

function butuhBluetooth(): boolean {
  return Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version >= 31;
}

async function cek(izin: Permission): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    return await PermissionsAndroid.check(izin);
  } catch {
    return false;
  }
}

export interface IzinVideo {
  kamera: StatusIzinVideo;
  mikrofon: StatusIzinVideo;
  /** Minta kamera + mikrofon (+ Bluetooth) dalam satu rangkaian dialog sistem. */
  minta: () => Promise<{ kamera: boolean; mikrofon: boolean }>;
  bukaSetelan: () => void;
}

export function useIzinVideo(): IzinVideo {
  const { tahanKunci } = useAppLock();
  const [kamera, setKamera] = useState<StatusIzinVideo>('memeriksa');
  const [mikrofon, setMikrofon] = useState<StatusIzinVideo>('memeriksa');
  const permanen = useRef<{ kamera: boolean; mikrofon: boolean }>({ kamera: false, mikrofon: false });

  const segarkan = useCallback(async () => {
    const [k, m] = await Promise.all([cek(P.CAMERA), cek(P.RECORD_AUDIO)]);
    setKamera((lama) => (k ? 'diizinkan' : permanen.current.kamera ? 'permanen' : lama === 'memeriksa' || lama === 'diizinkan' ? 'belum' : lama));
    setMikrofon((lama) => (m ? 'diizinkan' : permanen.current.mikrofon ? 'permanen' : lama === 'memeriksa' || lama === 'diizinkan' ? 'belum' : lama));
  }, []);

  useEffect(() => {
    void segarkan();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void segarkan();
      }
    });
    return () => sub.remove();
  }, [segarkan]);

  const minta = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return { kamera: true, mikrofon: true };
    }
    const daftar: Permission[] = [P.CAMERA, P.RECORD_AUDIO];
    if (butuhBluetooth()) {
      daftar.push(P.BLUETOOTH_CONNECT);
    }
    try {
      const hasil = await tahanKunci(() => PermissionsAndroid.requestMultiple(daftar));
      const status = (v: string | undefined): StatusIzinVideo =>
        v === PermissionsAndroid.RESULTS.GRANTED ? 'diizinkan' : v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'permanen' : 'ditolak';
      const k = status(hasil[P.CAMERA]);
      const m = status(hasil[P.RECORD_AUDIO]);
      permanen.current = { kamera: k === 'permanen', mikrofon: m === 'permanen' };
      setKamera(k);
      setMikrofon(m);
      return { kamera: k === 'diizinkan', mikrofon: m === 'diizinkan' };
    } catch {
      return { kamera: false, mikrofon: false };
    }
  }, [tahanKunci]);

  const bukaSetelan = useCallback(() => {
    void tahanKunci(() => Linking.openSettings()).catch(() => undefined);
  }, [tahanKunci]);

  return { kamera, mikrofon, minta, bukaSetelan };
}
