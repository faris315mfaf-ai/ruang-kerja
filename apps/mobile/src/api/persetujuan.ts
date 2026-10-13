/**
 * Persetujuan pengajuan (sisi penyetuju) + delegasi.
 * Kontrak: docs/sesi/ponsel-b4a-pengajuan.md §4–5. Daftar antrean ada di
 * `GET /persetujuan/daftar` (bukan `/persetujuan`, milik persetujuan privasi).
 */
import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';

import { API_URL, apiRequest } from './client';
import type { PageMeta } from './types';

export type StatusPengajuan = 'draft' | 'pending' | 'approved' | 'rejected' | 'revision_requested' | 'canceled';
export type StatusLangkah = 'queued' | 'waiting' | 'approved' | 'rejected' | 'revision_requested' | 'skipped';
export type KategoriPengajuan = 'leave' | 'permit' | 'sick' | 'overtime' | 'correction' | 'business_trip' | 'procurement';

export interface Orang {
  id: string;
  name: string;
  avatar: string | null;
  position?: string | null;
  division?: string | null;
}

export interface JenisRingkas {
  id: string;
  code: string;
  name: string;
  category: KategoriPengajuan | string;
  category_label: string;
  counts_calendar_days?: boolean;
  day_unit?: string;
}

export interface PayloadPengajuan {
  mode?: 'days' | 'hours';
  half_day?: boolean;
  date?: string;
  start_time?: string;
  end_time?: string;
  check_in?: string | null;
  check_out?: string | null;
  destination?: string;
  item_name?: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  total?: number;
  reference_url?: string | null;
  urgency?: 'biasa' | 'mendesak';
}

export interface RekanAbsen {
  group: string | null;
  size: number;
  people: { id: string; name: string; dates: string[] }[];
}

export interface ItemPengajuan {
  id: string;
  number: string | null;
  status: StatusPengajuan;
  status_label: string;
  type: JenisRingkas;
  user: Orang;
  start_at: string;
  end_at: string;
  days: number | null;
  minutes: number | null;
  payload: PayloadPengajuan;
  round: number;
  step_position: number | null;
  step_count: number;
  waiting: { label: string; approver: Orang | null; since: string | null } | null;
  decision_note: { status: string; note: string | null; by: string | null; at: string | null } | null;
  submitted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  decided_at: string | null;
}

export interface KeputusanSaya {
  status: StatusLangkah;
  status_label: string;
  note: string | null;
  decided_at: string | null;
  on_behalf_of?: Orang | null;
}

/** Baris antrean: `menunggu` membawa `step` + `colleagues`; `diputus` membawa `my_decision`. */
export interface ItemAntrean extends ItemPengajuan {
  colleagues?: RekanAbsen | null;
  step?: { id: string; label: string; on_behalf_of: Orang | null; since: string | null };
  my_decision?: KeputusanSaya;
}

export type TabPersetujuan = 'menunggu' | 'diputus' | 'disetujui';

export interface HalamanPersetujuan {
  tab: TabPersetujuan;
  tabs: TabPersetujuan[];
  counts: Partial<Record<TabPersetujuan, number>>;
  items: ItemAntrean[];
  meta: PageMeta;
  can_cancel_approved: boolean;
  delegation: {
    active: { id: string; delegate: Orang; starts_on: string; ends_on: string } | null;
    representing: { id: string; delegator: Orang; ends_on: string }[];
  };
}

export interface LangkahTimeline {
  id: string;
  round: number;
  current_round: boolean;
  step_order: number;
  label: string;
  approver_type: string;
  status: StatusLangkah;
  status_label: string;
  approver: Orang | null;
  delegated_from: Orang | null;
  note: string | null;
  activated_at: string | null;
  decided_at: string | null;
}

export interface LampiranPengajuan {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  url: string;
}

export interface DetailPengajuan extends ItemPengajuan {
  reason: string;
  health_details_hidden: boolean;
  substitute: Orang | null;
  attachments: LampiranPengajuan[];
  timeline: LangkahTimeline[];
  /** Tidak ada sama sekali untuk staf (keputusan pemilik 6 Okt 2026). */
  balance?: { year: number; before: number; after: number } | null;
  colleagues: RekanAbsen | null;
  cancellation: { by: Orang | null; by_requester: boolean; at: string | null; reason: string | null; after_approval: boolean } | null;
  can: Partial<Record<'edit' | 'cancel' | 'decide' | 'cancel_approved' | 'approve' | 'reject' | 'revise', boolean>>;
}

export interface DetailPersetujuan {
  request: DetailPengajuan;
  queue: { position: number | null; total: number; next_id: string | null };
  my_step: { id: string; label: string; step_order: number; on_behalf_of: Orang | null; since: string | null } | null;
  my_decision: KeputusanSaya | null;
}

export interface HasilKeputusan {
  request: DetailPengajuan;
  next_id: string | null;
  menunggu: number;
}

export type JenisKeputusan = 'setujui' | 'tolak' | 'revisi';

export interface Delegasi {
  id: string;
  delegator: Orang;
  delegate: Orang;
  starts_on: string;
  ends_on: string;
  reason: string | null;
  active: boolean;
}

export interface DaftarDelegasi {
  today: string;
  mine: Delegasi[];
  received: Delegasi[];
}

export interface BodyDelegasi {
  delegate_id: string;
  starts_on: string;
  ends_on: string;
  reason?: string | null;
}

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons server kosong.');
  }
  return nilai;
}

export function daftarPersetujuan(tab: TabPersetujuan, page = 1): Promise<HalamanPersetujuan> {
  return apiRequest<HalamanPersetujuan>('persetujuan/daftar', { query: { tab, page } }).then(wajib);
}

export function hitungPersetujuan(): Promise<number> {
  return apiRequest<{ menunggu: number }>('persetujuan/hitung').then((r) => wajib(r).menunggu ?? 0);
}

export function detailPersetujuan(id: string): Promise<DetailPersetujuan> {
  return apiRequest<DetailPersetujuan>(`persetujuan/${id}`).then(wajib);
}

/** Setujui (`note` opsional), tolak (`reason` wajib), revisi (`note` wajib). 409 `sudah_diputus` dilempar sebagai ApiError. */
export function putuskan(id: string, jenis: JenisKeputusan, catatan?: string): Promise<HasilKeputusan> {
  const teks = catatan?.trim() ?? '';
  const json = jenis === 'tolak' ? { reason: teks } : jenis === 'revisi' ? { note: teks } : teks !== '' ? { note: teks } : {};
  return apiRequest<HasilKeputusan>(`persetujuan/${id}/${jenis}`, { method: 'POST', json }).then(wajib);
}

export function daftarDelegasi(): Promise<DaftarDelegasi> {
  return apiRequest<DaftarDelegasi>('persetujuan/delegasi').then(wajib);
}

export function buatDelegasi(body: BodyDelegasi): Promise<Delegasi> {
  return apiRequest<{ delegation: Delegasi }>('persetujuan/delegasi', { method: 'POST', json: body }).then((r) => wajib(r).delegation);
}

export function ubahDelegasi(id: string, body: Partial<BodyDelegasi>): Promise<Delegasi> {
  return apiRequest<{ delegation: Delegasi }>(`persetujuan/delegasi/${id}`, { method: 'PATCH', json: body }).then((r) => wajib(r).delegation);
}

export async function hentikanDelegasi(id: string): Promise<void> {
  await apiRequest<null>(`persetujuan/delegasi/${id}`, { method: 'DELETE' });
}

export interface OrangPilihan {
  id: string;
  name: string;
  initials?: string;
  avatar: string | null;
  position: string | null;
  division: string | null;
}

/** GET /orang?q= — pemilih rekan delegasi (B2-B). */
export function cariRekan(q: string): Promise<OrangPilihan[]> {
  return apiRequest<{ orang: OrangPilihan[] }>('orang', { query: { q: q.trim() === '' ? null : q.trim() } }).then((r) => wajib(r).orang);
}

// ── Unduh lampiran (Bearer) ─────────────────────────────────────────────────

export class GalatLampiran extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'GalatLampiran';
    this.status = status;
  }
}

async function tokenSesi(): Promise<string | null> {
  try {
    const mentah = await SecureStore.getItemAsync('rk.sesi');
    if (!mentah) {
      return null;
    }
    return (JSON.parse(mentah) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

function namaAman(nama: string): string {
  const bersih = nama.replace(/[^\w.\- ]+/g, '_').trim();
  return bersih === '' ? 'lampiran' : bersih.slice(0, 80);
}

/** GET /pengajuan/{id}/lampiran/{att} → berkas di cache aplikasi (dibuka lewat `contentUri`). */
export async function unduhLampiran(requestId: string, lampiran: LampiranPengajuan): Promise<File> {
  const token = await tokenSesi();
  if (token === null) {
    throw new GalatLampiran('Sesi berakhir. Silakan masuk kembali.', 401);
  }
  const folder = new Directory(Paths.cache, 'lampiran-pengajuan', requestId);
  if (!folder.exists) {
    folder.create({ intermediates: true, idempotent: true });
  }
  const tujuan = new File(folder, `${lampiran.id}-${namaAman(lampiran.filename)}`);
  try {
    return await File.downloadFileAsync(`${API_URL}/pengajuan/${requestId}/lampiran/${lampiran.id}`, tujuan, {
      headers: { Authorization: `Bearer ${token}`, Accept: lampiran.mime_type || '*/*' },
      idempotent: true,
    });
  } catch (galat) {
    const teks = galat instanceof Error ? galat.message : '';
    const status = /\b(401|403|404|429|5\d\d)\b/.exec(teks)?.[1];
    if (status === '403') {
      throw new GalatLampiran('Detail kesehatan disembunyikan untuk penyetuju pengganti.', 403);
    }
    if (status === '404') {
      throw new GalatLampiran('Lampiran tidak ditemukan.', 404);
    }
    if (status === '401') {
      throw new GalatLampiran('Sesi berakhir. Silakan masuk kembali.', 401);
    }
    if (status !== undefined) {
      throw new GalatLampiran('Server sedang bermasalah. Coba lagi beberapa saat.', Number(status));
    }
    throw new GalatLampiran('Koneksi terputus sebelum lampiran selesai diunduh.', 0);
  }
}
