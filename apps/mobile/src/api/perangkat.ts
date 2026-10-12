/**
 * Perangkat saya — `GET /perangkat`, `DELETE /perangkat/{id}`, `PATCH …/biometrik`.
 * Fungsi dasarnya hidup di endpoints.ts (dipakai juga kunci aplikasi); di sini
 * hanya diekspor ulang bersama konstanta batas perangkat.
 */
export { cabutPerangkat, daftarPerangkat, setBiometrikPerangkat } from './endpoints';
export type { DeviceRow } from './types';

/** Batas perangkat per akun (RegisterDevice di server). */
export const BATAS_PERANGKAT = 5;
