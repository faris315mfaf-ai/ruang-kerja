/**
 * Video RuangKerja native (LiveKit) — kontrak API `docs/sesi/ponsel-b4b-rapat.md` §4:
 * data pra-gabung/ruang, token LiveKit, moderasi penyelenggara, angkat tangan,
 * waktu bicara, kehadiran, panggil peserta, dan opt-out transkrip (§5).
 * Semua di balik flag `features.meetings` (404 saat mati).
 */
import { apiRequest } from './client';
import type { TamuHadir } from './rapatTamu';
import type { MeetingMinutesData } from './types';

export interface OrangVideo {
  id: string;
  name: string;
  title?: string | null;
  division?: string | null;
  avatar_url: string | null;
}

export type RsvpVideo = 'yes' | 'maybe' | 'no' | 'pending';

export interface PesertaRuang extends OrangVideo {
  first_name?: string;
  roles?: ('organizer' | 'minute_taker')[];
  role_label?: string | null;
  rsvp?: RsvpVideo;
  optional?: boolean;
}

export interface HadirVideo {
  user_id: string;
  joined_at: string;
  left_at: string | null;
  duration_seconds: number;
  in_room: boolean;
  sessions: number;
  late_minutes?: number;
  late?: boolean;
}

export interface BelumMasuk {
  user_id: string;
  rsvp: RsvpVideo;
  optional: boolean;
  called_at: string | null;
}

export interface Dikeluarkan {
  user_id: string;
  removed_by: string | null;
  removed_at: string | null;
}

export interface KehadiranVideo {
  attendance: HadirVideo[];
  in_room: number;
  not_joined: BelumMasuk[];
  /** Tamu eksternal yang pernah masuk ruang (`participant_id` = id tamu, identitas LiveKit `guest:{id}`); tidak dihitung di `in_room`. */
  guests?: TamuHadir[];
  late_grace_minutes: number;
  removed: Dikeluarkan[];
}

export interface RingkasanVideo {
  configured: boolean;
  opens_at: string;
  closes_at: string;
  is_organizer: boolean;
  can_join: boolean;
  denied_reason: string | null;
  attendance: HadirVideo[];
  in_room: number;
  not_joined?: BelumMasuk[];
  removed?: Dikeluarkan[];
}

export interface WaktuBicara {
  occurrence_date: string;
  total_ms: number;
  updated_at: string | null;
  people: { user_id: string; ms: number; share: number }[];
  silent: string[];
  mine_ms?: number;
  interval_seconds?: number;
  accepted_ms?: number;
}

export interface SumberNotulen {
  chosen: 'continue' | 'template' | 'blank' | null;
  chosen_by: string | null;
  chosen_at: string | null;
  can_choose: boolean;
  suggested: 'continue' | 'template' | 'blank';
  previous: { occurrence_date: string; status: 'draft' | 'final'; open_count: number } | null;
  open_follow_ups: { id: string; text: string; assignee_id: string | null; due_date: string | null; overdue: boolean }[];
  template: { key: string; label: string; sections: string[]; blocks: string[] } | null;
}

export interface FiturRuang {
  video_configured: boolean;
  realtime: boolean;
  subtitles: boolean;
  auto_minutes: boolean;
  collab_minutes: boolean;
}

export interface HakRuang {
  edit_minutes: boolean;
  choose_notes_source: boolean;
  moderate: boolean;
  call_participants: boolean;
  report_speaking: boolean;
  /** Daftar tamu + tautan (penyelenggara). Server lama: tidak ada. */
  manage_guests?: boolean;
  /** Ruang tunggu (semua yang diundang). Server lama: tidak ada → anggap berwenang, 403 menghentikan polling. */
  manage_lobby?: boolean;
}

export interface DataRuang {
  viewer: { id: string; name: string; avatar_url?: string | null };
  meeting: {
    id: string;
    title: string;
    occurrence_date: string;
    starts_at: string;
    ends_at: string;
    organizer_id: string;
    minute_taker_id?: string | null;
    agenda?: string[];
  };
  people: OrangVideo[];
  participants?: PesertaRuang[];
  video: RingkasanVideo;
  minutes?: { doc: MeetingMinutesData; can_edit: boolean } | null;
  notes_source?: SumberNotulen | null;
  speaking?: WaktuBicara | null;
  features?: FiturRuang;
  can?: HakRuang;
}

/** Ringkasan notulen otomatis (NotulenSummary) — hanya bagian yang dipakai ruang/pra-gabung. */
export interface NotulenOtomatisRingkas {
  available: boolean;
  auto_minutes: boolean;
  notice: string | null;
  notice_points: string[];
  consent: { opted_out: boolean; can_change: boolean };
  retention_days?: number;
  transcript: { status: string; status_label: string } | null;
}

export interface RuangVideoResponse {
  room: DataRuang;
  notulen: NotulenOtomatisRingkas | null;
}

export interface TokenVideo {
  url: string;
  token: string;
  room: string;
  identity: string;
  name: string;
  expires_at: string;
  occurrence_date: string;
  role: 'organizer' | 'minute_taker' | 'participant';
  can: { moderate: boolean; call_participants: boolean; edit_minutes: boolean; manage_guests?: boolean; manage_lobby?: boolean };
  people: OrangVideo[];
}

/** Kode 403 token (`ruang_belum_dibuka` …) dan 503 `video_belum_siap`. */
export type KodeTolakVideo = 'ruang_belum_dibuka' | 'ruang_ditutup' | 'dikeluarkan' | 'tidak_diizinkan' | 'video_belum_siap';

function q(tanggal: string | null | undefined): Record<string, string | undefined> {
  return { tanggal: tanggal ?? undefined };
}

async function wajib<T>(p: Promise<T | null>): Promise<T> {
  const hasil = await p;
  if (hasil === null) {
    throw new Error('Respons kosong dari server.');
  }
  return hasil;
}

/** GET /rapat/{id}/video/ruang — data pra-gabung & ruang. */
export function ruangVideo(id: string, tanggal?: string | null): Promise<RuangVideoResponse> {
  return wajib(apiRequest<RuangVideoResponse>(`rapat/${id}/video/ruang`, { query: q(tanggal) }));
}

/** POST /rapat/{id}/video/token — JWT LiveKit 10 menit (minta baru untuk menyambung ulang). */
export function tokenVideo(id: string, tanggal?: string | null): Promise<TokenVideo> {
  return wajib(apiRequest<TokenVideo>(`rapat/${id}/video/token`, { method: 'POST', query: q(tanggal), timeoutMs: 15_000 }));
}

/** Penyelenggara: bisukan mikrofon peserta (SID track mikrofon dari LiveKit). */
export async function bisukanPeserta(id: string, userId: string, trackSid: string): Promise<void> {
  await apiRequest(`rapat/${id}/video/bisukan`, { method: 'POST', json: { user_id: userId, track_sid: trackSid } });
}

/** Penyelenggara: keluarkan peserta (token baru ditolak `dikeluarkan`). */
export async function keluarkanPeserta(id: string, userId: string): Promise<void> {
  await apiRequest(`rapat/${id}/video/keluarkan`, { method: 'POST', json: { user_id: userId } });
}

/** Penyelenggara: izinkan masuk lagi. */
export async function izinkanMasuk(id: string, userId: string): Promise<boolean> {
  const r = await apiRequest<{ readmitted: boolean }>(`rapat/${id}/video/izinkan-masuk`, { method: 'POST', json: { user_id: userId } });
  return r?.readmitted ?? false;
}

/** Angkat/turunkan tangan — server menulis atribut LiveKit `hand`. */
export async function aturTangan(id: string, raised: boolean): Promise<string> {
  const r = await apiRequest<{ hand: string }>(`rapat/${id}/video/tangan`, { method: 'POST', json: { raised } });
  return r?.hand ?? '';
}

export function waktuBicara(id: string, tanggal?: string | null): Promise<WaktuBicara> {
  return wajib(apiRequest<WaktuBicara>(`rapat/${id}/video/waktu-bicara`, { query: q(tanggal) }));
}

/** Total kumulatif milik sendiri (bukan delta). */
export function laporWaktuBicara(id: string, ms: number, tanggal?: string | null): Promise<WaktuBicara> {
  return wajib(
    apiRequest<WaktuBicara>(`rapat/${id}/video/waktu-bicara`, { method: 'POST', json: { ms: Math.max(0, Math.round(ms)) }, query: q(tanggal), timeoutMs: 10_000 }),
  );
}

export function kehadiranVideo(id: string, tanggal?: string | null): Promise<KehadiranVideo> {
  return wajib(apiRequest<KehadiranVideo>(`rapat/${id}/video/kehadiran`, { query: q(tanggal) }));
}

/** Panggil peserta undangan yang belum masuk (429 + retry_after bila < 1 menit). */
export async function panggilPeserta(id: string, userId: string, tanggal?: string | null): Promise<void> {
  await apiRequest(`rapat/${id}/video/panggil/${userId}`, { method: 'POST', query: q(tanggal) });
}

/** "Jangan transkrip suara saya" (seluruh seri). */
export async function aturOptOutTranskrip(id: string, optedOut: boolean): Promise<boolean> {
  const r = await apiRequest<{ opted_out: boolean }>(`rapat/${id}/transkrip/persetujuan`, { method: 'PUT', json: { opted_out: optedOut } });
  return r?.opted_out ?? optedOut;
}
