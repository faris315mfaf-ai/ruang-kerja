/** Pengaturan notifikasi (kontrak: docs/sesi/ponsel-b2c-inbox.md §4). */
import { apiRequest } from './client';

export type KanalNotifikasi = 'in_app' | 'email' | 'whatsapp';

export interface SelKanal {
  enabled: boolean;
  configurable: boolean;
  supported: boolean;
}

export interface BarisMatriks {
  event: string;
  label: string;
  category: string;
  channels: Record<KanalNotifikasi, SelKanal>;
}

export interface SaluranAndroid {
  id: string;
  name: string;
  importance: 'high' | 'default' | 'low' | 'min' | string;
  lockscreen: 'public' | 'private' | string;
  mutable: boolean;
  types: string[];
}

export interface PengaturanNotifikasi {
  matrix: BarisMatriks[];
  categories: { value: string; label: string }[];
  channels: { value: KanalNotifikasi; label: string; available: boolean }[];
  settings: { digest_enabled: boolean; digest_time: string; quiet_hours: boolean; pause_while_on_leave: boolean };
  quiet_window: { start: string; end: string };
  email: string;
  push: { follows: string; server_ready: boolean; android_channels: SaluranAndroid[] };
}

export interface UbahPengaturan {
  digest_time?: string;
  digest_enabled?: boolean;
  quiet_hours?: boolean;
  pause_while_on_leave?: boolean;
  preferences?: { event: string; channel: KanalNotifikasi; enabled: boolean }[];
}

export interface BagianRingkasan {
  key: string;
  title: string;
  tile_label: string;
  count: number;
  items: { title?: string; subtitle?: string | null; [k: string]: unknown }[];
  tone: string;
  note: string | null;
  more: number | null;
}

export interface PratinjauRingkasan {
  digest: { date: string; sections: BagianRingkasan[] };
  empty: boolean;
  digest_time: string;
}

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons server kosong.');
  }
  return nilai;
}

export function ambilPengaturanNotifikasi(): Promise<PengaturanNotifikasi> {
  return apiRequest<PengaturanNotifikasi>('pengaturan/notifikasi').then(wajib);
}

/** PUT atomik: semua perubahan atau tidak sama sekali (422 → rollback server). */
export function simpanPengaturanNotifikasi(ubah: UbahPengaturan): Promise<PengaturanNotifikasi> {
  return apiRequest<PengaturanNotifikasi>('pengaturan/notifikasi', { method: 'PUT', json: ubah }).then(wajib);
}

export function ringkasanHarian(): Promise<PratinjauRingkasan> {
  return apiRequest<PratinjauRingkasan>('pengaturan/notifikasi/ringkasan').then(wajib);
}

export function kirimNotifikasiUji(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('pengaturan/notifikasi/uji', { method: 'POST' }).then(wajib);
}
