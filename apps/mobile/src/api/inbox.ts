/**
 * API Inbox v1 (kontrak: docs/sesi/ponsel-b2c-inbox.md §1–2): daftar bertab,
 * detail, aksi satu/banyak notifikasi, tandai semua dibaca.
 */
import { apiRequest } from './client';
import type { PageMeta } from './types';

export type TabInbox = 'semua' | 'perlu-tindakan' | 'diarsipkan';
export type JenisInbox = 'mention' | 'task' | 'request' | 'attendance' | 'system' | 'info';
export type AksiInbox = 'baca' | 'belum-baca' | 'arsip' | 'batal-arsip';

/** Tujuan ketukan dari server — aplikasi tidak pernah mem-parsing `url` web. */
export interface TargetInbox {
  type: string;
  id: string | null;
  anchor: string | null;
  params: Record<string, string>;
}

export interface SubjekInbox {
  type: string;
  id: string;
  code: string | null;
  title: string | null;
}

export interface MetaItemInbox {
  context?: string | null;
  context_tone?: string | null;
  open_label?: string | null;
  quote?: string | null;
  plan_url?: string | null;
  plan_label?: string | null;
}

export interface EntriInbox {
  id: string;
  type: string;
  category: 'task' | 'request' | 'attendance' | 'system' | 'info' | string;
  icon: string;
  tone: string;
  type_label: string;
  title: string;
  body: string | null;
  url: string | null;
  actor: { id?: string; name?: string; avatar?: string | null } | null;
  subject: SubjekInbox | null;
  meta: MetaItemInbox;
  action_required: boolean;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
  target: TargetInbox | null;
  android_channel: string;
}

export interface HitungInbox {
  semua: number;
  perlu_tindakan: number;
  diarsipkan: number;
  belum_dibaca: number;
}

export interface HalamanInbox {
  items: EntriInbox[];
  unread: number;
  meta: PageMeta & { counts: HitungInbox };
}

export interface ParamInbox {
  tab?: TabInbox;
  belumDibaca?: boolean;
  jenis?: JenisInbox | null;
  page?: number;
  perPage?: number;
}

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons server kosong.');
  }
  return nilai;
}

export function ambilInbox(param: ParamInbox = {}): Promise<HalamanInbox> {
  return apiRequest<HalamanInbox>('inbox', {
    query: {
      tab: param.tab && param.tab !== 'semua' ? param.tab : null,
      'belum-dibaca': param.belumDibaca ? 1 : null,
      jenis: param.jenis ?? null,
      page: param.page ?? 1,
      per_page: param.perPage ?? null,
    },
  }).then(wajib);
}

/** Jumlah belum dibaca global (lencana) — satu item per halaman agar ringan. */
export async function jumlahBelumDibaca(): Promise<number> {
  const hasil = await ambilInbox({ belumDibaca: true, perPage: 1 });
  return hasil.meta.counts.belum_dibaca;
}

export function detailInbox(id: string): Promise<{ item: EntriInbox; unread: number }> {
  return apiRequest<{ item: EntriInbox; unread: number }>(`inbox/${id}`).then(wajib);
}

const JALUR: Record<AksiInbox, { method: 'POST' | 'DELETE'; path: string }> = {
  baca: { method: 'POST', path: 'baca' },
  'belum-baca': { method: 'POST', path: 'belum-baca' },
  arsip: { method: 'POST', path: 'arsip' },
  'batal-arsip': { method: 'POST', path: 'batal-arsip' },
};

export interface HasilAksiInbox {
  item?: EntriInbox;
  unread: number;
  counts?: HitungInbox;
}

export function aksiInbox(id: string, aksi: AksiInbox): Promise<HasilAksiInbox> {
  const j = JALUR[aksi];
  return apiRequest<HasilAksiInbox>(`inbox/${id}/${j.path}`, { method: j.method }).then(wajib);
}

export function bacaSemua(filter: { tab?: TabInbox; jenis?: JenisInbox | null } = {}): Promise<{ marked: number; unread: number; counts: HitungInbox }> {
  return apiRequest<{ marked: number; unread: number; counts: HitungInbox }>('inbox/baca-semua', {
    method: 'POST',
    json: {
      tab: filter.tab && filter.tab !== 'semua' ? filter.tab : undefined,
      jenis: filter.jenis ?? undefined,
    },
  }).then(wajib);
}

export function aksiMassal(
  ids: string[],
  aksi: 'baca' | 'belum-baca' | 'arsip',
): Promise<{ affected: number; skipped: string[]; unread: number; counts: HitungInbox }> {
  return apiRequest<{ affected: number; skipped: string[]; unread: number; counts: HitungInbox }>('inbox/massal', {
    method: 'POST',
    json: { ids, aksi },
  }).then(wajib);
}
