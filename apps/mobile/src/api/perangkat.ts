/**
 * Perangkat saya — `GET /perangkat`, `DELETE /perangkat/{id}`, `PATCH …/biometrik`,
 * `PUT …/push-token`. Fungsi dasarnya hidup di endpoints.ts (dipakai juga kunci
 * aplikasi); di sini diekspor ulang bersama konstanta batas perangkat.
 */
import { apiRequest } from './client';

export { cabutPerangkat, daftarPerangkat, setBiometrikPerangkat } from './endpoints';
export type { DeviceRow } from './types';

/** Batas perangkat per akun (RegisterDevice di server). */
export const BATAS_PERANGKAT = 5;

/** PUT /perangkat/{id}/push-token — mendaftarkan/memutar token FCM perangkat ini (kontrak: docs/sesi/ponsel-b2c-inbox.md §5). */
export function simpanTokenPush(deviceId: string, token: string): Promise<{ message: string } | null> {
  return apiRequest<{ message: string }>(`perangkat/${deviceId}/push-token`, { method: 'PUT', json: { token } });
}
