/**
 * Konstanta klien API yang dipakai bersama `client.ts` dan modul offline
 * (`src/offline/jaringan.ts` — pemeriksaan jangkauan server). Dipisah supaya
 * modul offline tidak mengimpor `client.ts` (menghindari impor melingkar).
 */
import Constants from 'expo-constants';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://spkd.store/api/v1';

/** Versi aplikasi yang dikirim di header `X-App-Version` pada setiap permintaan. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '1.0.0';
