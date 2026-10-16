/**
 * Endpoint akun: ganti kata sandi sendiri, kirim tautan desktop, konfigurasi
 * aplikasi (docs/sesi/ponsel-b1-auth.md, docs/sesi/ponsel-b2-privasi.md).
 */
import { apiRequest } from './client';
import type { UserProfile } from './types';

export interface UbahSandiBody {
  current_password: string;
  password: string;
  password_confirmation: string;
}

export interface UbahSandiHasil {
  message: string;
  password_change_required: boolean;
  user: UserProfile;
}

/** POST /auth/sandi — token perangkat ini tetap, perangkat lain dicabut. 422 per kolom. */
export function ubahSandi(body: UbahSandiBody): Promise<UbahSandiHasil> {
  return apiRequest<UbahSandiHasil>('auth/sandi', { method: 'POST', json: body }).then((r) => {
    if (r === null) {
      throw new Error('Respons server kosong.');
    }
    return r;
  });
}

/** POST /tautan-desktop — antrekan email tautan ke alamat pemilik token (path harus masuk daftar putih server). */
export function kirimTautanDesktop(path: string): Promise<{ message: string; email: string }> {
  return apiRequest<{ message: string; email: string }>('tautan-desktop', { method: 'POST', json: { path } }).then((r) => {
    if (r === null) {
      throw new Error('Respons server kosong.');
    }
    return r;
  });
}

export interface KonfigurasiApp {
  min_app_version: string;
  latest_app_version: string;
  maintenance: { active: boolean; message: string };
  server_time: string;
}

/** GET /konfigurasi — publik. */
export function konfigurasiApp(): Promise<KonfigurasiApp> {
  return apiRequest<KonfigurasiApp>('konfigurasi').then((r) => {
    if (r === null) {
      throw new Error('Respons server kosong.');
    }
    return r;
  });
}
