/** Info versi aplikasi untuk Tentang & Pengaturan. */
import * as Application from 'expo-application';

export function versiApp(): string {
  return Application.nativeApplicationVersion ?? '1.0.0';
}

export function buildApp(): string {
  return Application.nativeBuildVersion ?? '—';
}
