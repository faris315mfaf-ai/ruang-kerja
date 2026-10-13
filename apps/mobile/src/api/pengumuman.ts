/** Pengumuman (kontrak: docs/sesi/ponsel-b2b-beranda.md §4). */
import { apiRequest } from './client';
import type { PageMeta } from './types';

export type AudiensPengumuman = 'all' | 'division' | 'team';

export interface ItemPengumuman {
  id: string;
  title: string;
  body: string;
  audience: AudiensPengumuman;
  audience_label: string;
  author: { id: string; name: string; avatar: string | null } | null;
  published_at: string;
  expires_at: string | null;
  active: boolean;
  dismissed: boolean;
  can_delete: boolean;
}

export type TabPengumuman = 'untuk-saya' | 'saya-buat';

export interface HalamanPengumuman {
  tab: TabPengumuman;
  items: ItemPengumuman[];
  meta: PageMeta;
  can_create: boolean;
}

export interface PilihanAudiens {
  audiences: { value: AudiensPengumuman; label: string }[];
  divisions: { id: string; name: string }[];
  teams: { id: string; name: string }[];
}

export interface BodyPengumuman {
  title: string;
  body: string;
  audience: AudiensPengumuman;
  target_ids?: string[];
  expires_on?: string;
}

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons server kosong.');
  }
  return nilai;
}

export function daftarPengumuman(tab: TabPengumuman, page: number): Promise<HalamanPengumuman> {
  return apiRequest<HalamanPengumuman>('pengumuman', { query: { tab, page } }).then(wajib);
}

export function detailPengumuman(id: string): Promise<ItemPengumuman> {
  return apiRequest<{ pengumuman: ItemPengumuman }>(`pengumuman/${id}`).then((r) => wajib(r).pengumuman);
}

export function pilihanAudiens(): Promise<PilihanAudiens> {
  return apiRequest<PilihanAudiens>('pengumuman/audiens').then(wajib);
}

export function terbitkanPengumuman(body: BodyPengumuman): Promise<ItemPengumuman> {
  return apiRequest<{ message: string; pengumuman: ItemPengumuman }>('pengumuman', { method: 'POST', json: body }).then((r) => wajib(r).pengumuman);
}

export async function hapusPengumuman(id: string): Promise<void> {
  await apiRequest<null>(`pengumuman/${id}`, { method: 'DELETE' });
}

export async function tutupSpanduk(id: string): Promise<void> {
  await apiRequest<null>(`pengumuman/${id}/tutup`, { method: 'POST' });
}
