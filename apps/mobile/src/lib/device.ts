/**
 * Identitas perangkat stabil untuk login & absen.
 *
 * device_id_hash = SHA-256 (64 hex) dari identitas mentah — nilai mentah
 * tidak pernah meninggalkan ponsel:
 *  - Android: Application.getAndroidId();
 *  - null / non-Android: UUID acak yang disimpan di SecureStore.
 */
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { DeviceInfo } from '@/api/types';

const RANDOM_KEY = 'rk.random_device_id';

/** Hash identitas perangkat (64 hex, deterministik per instalasi). */
export async function deviceIdHash(): Promise<string> {
  let raw: string | null = Platform.OS === 'android' ? Application.getAndroidId() : null;

  if (!raw) {
    raw = await SecureStore.getItemAsync(RANDOM_KEY);
    if (!raw) {
      raw = Crypto.randomUUID();
      await SecureStore.setItemAsync(RANDOM_KEY, raw);
    }
  }

  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
}

/** Metadata perangkat yang dikirim saat login. */
export async function deviceInfo(): Promise<DeviceInfo> {
  const hash = await deviceIdHash();

  return {
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    device_id_hash: hash,
    name: (Device.deviceName ?? Application.applicationName ?? 'Ponsel').slice(0, 100),
    os_version: (Device.osVersion ?? String(Platform.Version)).slice(0, 50),
    app_version: (Application.nativeApplicationVersion ?? '1.0.0').slice(0, 30),
  };
}
