/**
 * Rapat ponsel B4-B (kontrak FINAL: docs/sesi/ponsel-b4b-rapat.md):
 * formulir jadwalkan/ubah, pemilih peserta, cek bentrok, buat/ubah/batal,
 * notulen tulis/final/buka/versi/menyunting, sumber notulen, tindak lanjut,
 * kehadiran video (detail), notulen otomatis + transkrip, jadwal manajemen.
 * Agenda/detail/RSVP/notulen baca/kalender tetap di `endpoints.ts`.
 */
import { apiRequest } from './client';
import type { TamuHadir } from './rapatTamu';
import type { MeetingDetailData, MeetingMinutesData, MeetingVideoRoom, MinutesPerson } from './types';

export type PlatformRapat = 'meet' | 'zoom' | 'room' | 'client' | 'video';
export type PengulanganRapat = 'none' | 'weekdays' | 'weekly' | 'mon_wed_fri';
export type Orang = MinutesPerson;
export type Notulen = MeetingMinutesData;
export type TindakLanjut = MeetingMinutesData['action_items'][number];

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons kosong dari server.');
  }
  return nilai;
}

function q(tanggal?: string | null): Record<string, string | null> {
  return { tanggal: tanggal ?? null };
}

// ── 1. Jadwalkan, ubah, batalkan ────────────────────────────────────────────

export interface IsianRapat {
  title: string;
  description: string | null;
  date: string;
  start: string;
  duration: number;
  platform: PlatformRapat;
  join_url: string | null;
  location: string | null;
  participant_ids: string[];
  guest_emails: string[];
  /** Nama tamu per email (huruf kecil) — hanya untuk email yang diberi nama di formulir; email tanpa nama tidak dikirim (server tidak menimpa). */
  guest_names?: Record<string, string>;
  agenda: string[];
  recurrence: PengulanganRapat;
  recurrence_until: string | null;
  reminders: number[];
  minute_taker_id: string | null;
  workspace_id: string | null;
  leadership: boolean;
  auto_minutes: boolean;
}

export interface WorkspaceRingkas {
  id: string;
  key: string;
  name: string;
}

export interface FormulirRapat {
  viewer_id: string;
  people: Orang[];
  workspaces: WorkspaceRingkas[];
  can_lead: boolean;
  durations: number[];
  reminders: number[];
  platforms: PlatformRapat[];
  recurrences: PengulanganRapat[];
  video_enabled: boolean;
  auto_minutes_enabled: boolean;
  auto_minutes_notice: string | null;
  auto_minutes_notice_points: string[];
  meeting: (IsianRapat & { id: string }) | null;
}

export async function formulirRapat(rapatId?: string | null): Promise<FormulirRapat> {
  return wajib(await apiRequest<FormulirRapat>('rapat/formulir', { query: { rapat: rapatId ?? null } }));
}

export async function cariPeserta(kata: string): Promise<Orang[]> {
  const hasil = await apiRequest<{ people: Orang[] }>('rapat/peserta', { query: { q: kata } });
  return hasil?.people ?? [];
}

export interface Bentrok {
  conflicts: { user_id: string; title: string; starts_at: string; ends_at: string }[];
  suggestion: string | null;
}

export async function cekBentrok(param: { peserta: string[]; tanggal: string; mulai: string; durasi: number; abaikan?: string | null }): Promise<Bentrok> {
  // Query berulang peserta[]=… dibangun manual (client hanya mendukung satu nilai per kunci).
  const sp = new URLSearchParams();
  for (const id of param.peserta) {
    sp.append('peserta[]', id);
  }
  sp.set('tanggal', param.tanggal);
  sp.set('mulai', param.mulai);
  sp.set('durasi', String(param.durasi));
  if (param.abaikan) {
    sp.set('abaikan', param.abaikan);
  }
  return wajib(await apiRequest<Bentrok>(`rapat/bentrok?${sp.toString()}`));
}

export interface CanRapat {
  rsvp: boolean;
  edit: boolean;
  join_video: boolean;
}

export interface HasilSimpanRapat {
  message: string;
  invited?: number;
  meeting: MeetingDetailData;
  can: CanRapat;
  video: MeetingVideoRoom | null;
  auto_minutes_notice?: string | null;
}

export async function buatRapat(isian: IsianRapat): Promise<HasilSimpanRapat> {
  return wajib(await apiRequest<HasilSimpanRapat>('rapat', { method: 'POST', json: isian }));
}

export async function ubahRapat(id: string, isian: IsianRapat): Promise<HasilSimpanRapat> {
  return wajib(await apiRequest<HasilSimpanRapat>(`rapat/${id}`, { method: 'PATCH', json: isian }));
}

export async function batalkanRapat(id: string): Promise<HasilSimpanRapat> {
  return wajib(await apiRequest<HasilSimpanRapat>(`rapat/${id}/batal`, { method: 'POST' }));
}

// ── 2. Notulen (tulis) ─────────────────────────────────────────────────────

export interface IsiNotulen {
  attendance: { user_id: string; present: boolean; reason: string | null }[];
  sections: { title: string; body: string }[];
  decisions: string[];
  attendance_only?: boolean;
}

export async function simpanNotulen(id: string, tanggal: string | null, isi: IsiNotulen): Promise<Notulen> {
  const hasil = await apiRequest<{ notulen: Notulen }>(`rapat/${id}/notulen`, { method: 'PUT', query: q(tanggal), json: isi });
  return wajib(hasil).notulen;
}

export async function finalkanNotulen(id: string, tanggal: string | null): Promise<{ message: string; notulen: Notulen }> {
  return wajib(await apiRequest<{ message: string; notulen: Notulen }>(`rapat/${id}/notulen/final`, { method: 'POST', query: q(tanggal) }));
}

export async function bukaKembaliNotulen(id: string, tanggal: string | null): Promise<{ message: string; notulen: Notulen }> {
  return wajib(await apiRequest<{ message: string; notulen: Notulen }>(`rapat/${id}/notulen/buka`, { method: 'POST', query: q(tanggal) }));
}

export interface VersiNotulen {
  id: string;
  number: number;
  created_by: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
}

export async function daftarVersi(id: string, tanggal: string | null): Promise<{ minutes_id: string | null; status: 'draft' | 'final'; versions: VersiNotulen[] }> {
  return wajib(await apiRequest<{ minutes_id: string | null; status: 'draft' | 'final'; versions: VersiNotulen[] }>(`rapat/${id}/notulen/versi`, { query: q(tanggal) }));
}

export interface IsiVersi extends Omit<VersiNotulen, 'number'> {
  attendance: { user_id: string; present: boolean; reason: string | null }[];
  sections: { title: string; body: string }[];
  decisions: string[];
}

export async function bacaVersi(id: string, versi: string, tanggal: string | null): Promise<IsiVersi> {
  const hasil = await apiRequest<{ version: IsiVersi }>(`rapat/${id}/notulen/versi/${versi}`, { query: q(tanggal) });
  return wajib(hasil).version;
}

export interface PenandaMenyunting {
  user_id: string;
  name: string;
  since: string;
  expires_at: string;
}

export async function tandaiMenyunting(id: string, tanggal: string | null, active: boolean): Promise<PenandaMenyunting | null> {
  const hasil = await apiRequest<{ editing: PenandaMenyunting | null }>(`rapat/${id}/notulen/menyunting`, { method: 'POST', query: q(tanggal), json: { active } });
  return hasil?.editing ?? null;
}

export type SumberNotulen = 'continue' | 'template' | 'blank';

export async function pilihSumberNotulen(id: string, tanggal: string | null, source: SumberNotulen): Promise<{ applied: boolean; notulen: Notulen }> {
  return wajib(await apiRequest<{ applied: boolean; notulen: Notulen }>(`rapat/${id}/sumber-notulen`, { method: 'POST', query: q(tanggal), json: { source } }));
}

// ── 3. Tindak lanjut ────────────────────────────────────────────────────────

export interface DaftarTindakLanjut {
  occurrence_date: string;
  minutes_status: 'draft' | 'final' | null;
  items: TindakLanjut[];
  workspace: WorkspaceRingkas | null;
  workspaces: WorkspaceRingkas[];
  can: { edit: boolean; manage: boolean };
}

export async function daftarTindakLanjut(id: string, tanggal: string | null): Promise<DaftarTindakLanjut> {
  return wajib(await apiRequest<DaftarTindakLanjut>(`rapat/${id}/tindak-lanjut`, { query: q(tanggal) }));
}

export interface IsianTindakLanjut {
  text?: string;
  assignee_id?: string | null;
  due_date?: string | null;
  done?: boolean;
}

export async function tambahTindakLanjut(id: string, tanggal: string | null, isian: IsianTindakLanjut): Promise<TindakLanjut> {
  const hasil = await apiRequest<{ item: TindakLanjut }>(`rapat/${id}/tindak-lanjut`, { method: 'POST', query: q(tanggal), json: isian });
  return wajib(hasil).item;
}

export async function ubahTindakLanjut(id: string, itemId: string, isian: IsianTindakLanjut): Promise<TindakLanjut> {
  const hasil = await apiRequest<{ item: TindakLanjut }>(`rapat/${id}/tindak-lanjut/${itemId}`, { method: 'PATCH', json: isian });
  return wajib(hasil).item;
}

export async function hapusTindakLanjut(id: string, itemId: string): Promise<void> {
  await apiRequest(`rapat/${id}/tindak-lanjut/${itemId}`, { method: 'DELETE' });
}

export async function jadikanTugas(id: string, itemId: string, workspaceId: string | null): Promise<{ created: number; item: TindakLanjut }> {
  return wajib(
    await apiRequest<{ created: number; item: TindakLanjut }>(`rapat/${id}/tindak-lanjut/${itemId}/jadikan-tugas`, {
      method: 'POST',
      json: workspaceId ? { workspace_id: workspaceId } : {},
    }),
  );
}

export async function jadikanSemuaTugas(id: string, tanggal: string | null, itemIds: string[], workspaceId: string | null): Promise<{ created: number; notulen: Notulen }> {
  return wajib(
    await apiRequest<{ created: number; notulen: Notulen }>(`rapat/${id}/tindak-lanjut/jadikan-semua`, {
      method: 'POST',
      query: q(tanggal),
      json: workspaceId ? { item_ids: itemIds, workspace_id: workspaceId } : { item_ids: itemIds },
    }),
  );
}

export async function ingatkanPic(id: string, tanggal: string | null): Promise<{ reminded: string[]; message: string }> {
  return wajib(await apiRequest<{ reminded: string[]; message: string }>(`rapat/${id}/tindak-lanjut/ingatkan`, { method: 'POST', query: q(tanggal) }));
}

// ── 4. Video (hanya yang dipakai detail rapat) ─────────────────────────────

export interface KehadiranVideo {
  attendance: {
    user_id: string;
    joined_at: string;
    left_at: string | null;
    duration_seconds: number;
    in_room: boolean;
    sessions: number;
    late_minutes: number;
    late: boolean;
  }[];
  in_room: number;
  not_joined: { user_id: string; rsvp: string; optional: boolean; called_at: string | null }[];
  /** Tamu eksternal yang pernah masuk ruang (terpisah dari karyawan; tidak dihitung di `in_room`). */
  guests?: TamuHadir[];
  late_grace_minutes: number;
  removed: { user_id: string; removed_by: string | null; removed_at: string }[];
}

export async function kehadiranVideo(id: string, tanggal: string | null): Promise<KehadiranVideo> {
  return wajib(await apiRequest<KehadiranVideo>(`rapat/${id}/video/kehadiran`, { query: q(tanggal) }));
}

// ── 5. Notulen otomatis ─────────────────────────────────────────────────────

export type StatusTranskrip = 'recording' | 'transcribing' | 'summarizing' | 'ready' | 'failed';
export type StatusDraf = 'pending' | 'ready' | 'failed' | 'disabled' | 'inserted' | 'discarded';

export interface PoinSumber {
  teks: string;
  sumber?: unknown;
}

export interface UsulanTindakLanjut {
  id: string;
  judul: string;
  penanggung_jawab: { user_id: string | null; nama: string } | null;
  tenggat: string | null;
  sumber?: unknown;
  action_item_id: string | null;
  task: { id: string; key: string } | null;
}

export interface RingkasanNotulenOtomatis {
  available: boolean;
  auto_minutes: boolean;
  can_configure: boolean;
  can_manage: boolean;
  can_view_transcript: boolean;
  notice: string | null;
  notice_points: string[];
  consent: { opted_out: boolean; can_change: boolean };
  optout_count: number;
  llm: { enabled: boolean; provider: string | null; outside_indonesia: boolean };
  retention_days: number;
  transcript: {
    id: string;
    status: StatusTranskrip;
    status_label: string;
    error: string | null;
    language: string | null;
    model: string | null;
    duration_seconds: number | null;
    segment_count: number;
    speakers: { identity: string; user_id: string | null; name: string; seconds: number }[];
    started_at: string | null;
    updated_at: string | null;
    purge_after: string | null;
  } | null;
  draft: {
    status: StatusDraf;
    status_label: string;
    error: string | null;
    model: string | null;
    generated_at: string | null;
    inserted_at: string | null;
    discarded_at: string | null;
    ringkasan: string | null;
    agenda: { judul: string; poin: (PoinSumber | string)[] }[] | null;
    keputusan: (PoinSumber | string)[] | null;
    tindak_lanjut: UsulanTindakLanjut[] | null;
    perlu_dicek: (PoinSumber | string)[] | null;
  } | null;
}

export async function statusNotulenOtomatis(id: string, tanggal: string | null): Promise<RingkasanNotulenOtomatis> {
  const hasil = await apiRequest<{ notulen: RingkasanNotulenOtomatis }>(`rapat/${id}/notulen-otomatis`, { query: q(tanggal) });
  return wajib(hasil).notulen;
}

export async function aturNotulenOtomatis(id: string, enabled: boolean): Promise<RingkasanNotulenOtomatis> {
  const hasil = await apiRequest<{ notulen: RingkasanNotulenOtomatis }>(`rapat/${id}/notulen-otomatis`, { method: 'PATCH', json: { enabled } });
  return wajib(hasil).notulen;
}

export async function aturPersetujuanTranskrip(id: string, optedOut: boolean): Promise<boolean> {
  const hasil = await apiRequest<{ opted_out: boolean }>(`rapat/${id}/transkrip/persetujuan`, { method: 'PUT', json: { opted_out: optedOut } });
  return wajib(hasil).opted_out;
}

export interface SegmenTranskrip {
  i: number;
  speaker_identity: string;
  user_id: string | null;
  speaker_name: string;
  start_ms: number;
  end_ms: number;
  text: string;
}

export interface Transkrip {
  transcript_id: string;
  status: StatusTranskrip;
  language: string | null;
  duration_seconds: number | null;
  speakers: { identity: string; user_id: string | null; name: string; seconds: number }[];
  segments: SegmenTranskrip[];
}

export async function bacaTranskrip(id: string, tanggal: string | null): Promise<{ notulen: RingkasanNotulenOtomatis; transkrip: Transkrip | null }> {
  return wajib(await apiRequest<{ notulen: RingkasanNotulenOtomatis; transkrip: Transkrip | null }>(`rapat/${id}/transkrip`, { query: q(tanggal) }));
}

export async function masukkanDraf(id: string, tanggal: string | null): Promise<{ message: string; inserted_at: string }> {
  return wajib(await apiRequest<{ message: string; inserted_at: string }>(`rapat/${id}/transkrip/masukkan`, { method: 'POST', query: q(tanggal) }));
}

export async function buangDraf(id: string, tanggal: string | null): Promise<RingkasanNotulenOtomatis> {
  const hasil = await apiRequest<{ notulen: RingkasanNotulenOtomatis }>(`rapat/${id}/transkrip/buang`, { method: 'POST', query: q(tanggal) });
  return wajib(hasil).notulen;
}

export async function ringkasUlang(id: string, tanggal: string | null): Promise<RingkasanNotulenOtomatis> {
  const hasil = await apiRequest<{ notulen: RingkasanNotulenOtomatis }>(`rapat/${id}/transkrip/ringkas-ulang`, { method: 'POST', query: q(tanggal) });
  return wajib(hasil).notulen;
}

export async function usulanJadiTugas(id: string, tanggal: string | null, usulanId: string, workspaceId: string | null): Promise<{ task: { id: string; key: string } | null }> {
  return wajib(
    await apiRequest<{ task: { id: string; key: string } | null }>(`rapat/${id}/transkrip/tindak-lanjut/${usulanId}/tugas`, {
      method: 'POST',
      query: q(tanggal),
      json: workspaceId ? { workspace_id: workspaceId } : {},
    }),
  );
}

// ── 6. Jadwal manajemen ─────────────────────────────────────────────────────

export interface RapatPimpinan {
  id: string;
  key: string;
  occurrence_date: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  platform: PlatformRapat;
  location: string | null;
  join_url: string | null;
  organizer_id: string;
  minute_taker_id: string | null;
  workspace: WorkspaceRingkas | null;
  participants: { user_id: string | null; email: string | null; rsvp: string; optional: boolean }[];
  agenda: string[];
  recurrence: PengulanganRapat;
  recurrence_until: string | null;
  leadership: boolean;
  auto_minutes: boolean;
  canceled: boolean;
  minutes_status: 'none' | 'draft' | 'final';
}

export interface JadwalManajemen {
  week_start: string;
  meetings: RapatPimpinan[];
  minutes: Notulen[];
  people: Orang[];
  viewer_id: string;
}

export async function jadwalManajemen(minggu?: string | null): Promise<JadwalManajemen> {
  return wajib(await apiRequest<JadwalManajemen>('manajemen/jadwal', { query: { minggu: minggu ?? null } }));
}
