/**
 * Endpoint Obrolan Bagian 3 (kontrak final: docs/sesi/ponsel-b3c-obrolan.md).
 * Semua di balik `features.chat` — flag mati = 404 di setiap rute. Pemilih orang
 * memakai `GET /orang?q=` (B2-B).
 */
import { apiRequest } from './client';

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons server kosong.');
  }
  return nilai;
}

export type JenisKanal = 'workspace' | 'public' | 'private' | 'dm' | 'group';

/** Delapan emoji reaksi tetap (urutan server). */
export const EMOJI_REAKSI = ['👍', '🎉', '❤️', '😄', '👀', '🙏', '✅', '🚀'] as const;

export const MAKS_PESAN = 20_000;
export const MAKS_REKAN = 8;

export interface AnggotaRingkas {
  user_id: string;
  last_read_message_id: string | null;
  muted: boolean;
  role: string;
  name?: string;
  initials?: string;
}

export interface KanalRingkas {
  id: string;
  workspace_id: string | null;
  workspace: { key: string; name: string; color: string } | null;
  type: JenisKanal;
  name: string | null;
  topic: string | null;
  created_by: string;
  created_at: string | null;
  archived_at: string | null;
  members: AnggotaRingkas[];
  unread_count: number;
  last_message: {
    id: string;
    user_id: string | null;
    body_text: string;
    created_at: string | null;
    deleted: boolean;
  } | null;
  can_post: boolean;
  can_manage: boolean;
  title: string;
  is_member: boolean;
  members_count: number;
}

export interface DaftarObrolanHasil {
  channels: KanalRingkas[];
  unread_total: number;
  unread_channels: number;
}

export interface AnggotaKanal {
  user_id: string;
  name: string;
  initials: string;
  avatar: string | null;
  title: string | null;
  role: string;
  role_label: string;
  joined_at: string | null;
}

export interface DetailKanal {
  id: string;
  type: JenisKanal;
  name: string | null;
  topic: string | null;
  title: string;
  workspace: { id: string; key: string; name: string; color: string; url: string } | null;
  archived: boolean;
  archived_at: string | null;
  created_at: string | null;
  is_member: boolean;
  my_role: string | null;
  muted: boolean;
  can_post: boolean;
  can_manage: boolean;
  members_count: number;
  members_has_more: boolean;
  members: AnggotaKanal[];
}

export interface LampiranPesan {
  id: string;
  name: string;
  kind: string;
  web_view_link: string | null;
  size_bytes: number | null;
  owner_email: string | null;
}

export interface RingkasReaksi {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface Peserta {
  id: string;
  name: string;
  initials: string;
}

export interface Pesan {
  id: string;
  channel_id: string;
  user_id: string;
  parent_id: string | null;
  body: Record<string, unknown> | null;
  body_text: string;
  created_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  reactions: { emoji: string; user_ids: string[] }[];
  attachments: LampiranPesan[];
  penulis?: { id: string; nama: string | null; initials?: string };
  author?: { id: string; name: string | null; initials?: string };
  deleted?: boolean;
  deleted_label?: string | null;
  reaction_summary?: RingkasReaksi[];
  mentions?: { user_id: string; name: string }[];
  reply_count?: number;
  last_reply_at?: string | null;
  participants?: Peserta[];
  can?: { edit: boolean; delete: boolean; react: boolean; reply: boolean };
}

export interface RujukanTugas {
  id: string;
  key: string;
  title: string;
  status_category: string;
  url: string;
}

export interface Linimasa {
  messages: Pesan[];
  tasks: RujukanTugas[];
  has_more: boolean;
}

export interface HasilThread {
  root: Pesan;
  replies: Pesan[];
  tasks: RujukanTugas[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface KanalPublik {
  id: string;
  name: string;
  title: string;
  topic: string | null;
  members_count: number;
  is_member: boolean;
  last_message_at: string | null;
}

export interface Halaman {
  page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}

export interface OrangRingkas {
  id: string;
  name: string;
  initials: string;
  avatar: string | null;
  position: string | null;
  division: string | null;
}

export interface MuatanKirim {
  body: string;
  parent_id?: string | null;
  mentions?: string[];
  task_refs?: string[];
  attachments?: string[];
}

export interface FileDrive {
  id: string;
  name: string;
  kind: string;
  web_view_link: string | null;
  size_bytes: number | null;
  owner_email: string | null;
}

// ── Daftar & linimasa ───────────────────────────────────────────────────────

/** GET /obrolan — kanal + `unread_total` + `unread_channels` (nilai badge tab). */
export function daftarObrolan(): Promise<DaftarObrolanHasil> {
  return apiRequest<DaftarObrolanHasil>('obrolan').then(wajib);
}

/** GET /obrolan/{c}/pesan — 30 akar per halaman (+ balasan), `sebelum` = id akar tertua. */
export function linimasaKanal(channelId: string, sebelum?: string | null): Promise<Linimasa> {
  return apiRequest<Linimasa>(`obrolan/${channelId}/pesan`, { query: { sebelum: sebelum ?? null } }).then(wajib);
}

/** POST /obrolan/{c}/pesan — 201; `parent_id` = balasan thread; 429 = limiter 60/menit. */
export function kirimKePesan(channelId: string, muatan: MuatanKirim): Promise<{ message: Pesan; tasks: RujukanTugas[] }> {
  return apiRequest<{ message: Pesan; tasks: RujukanTugas[] }>(`obrolan/${channelId}/pesan`, {
    method: 'POST',
    json: kompakMuatan(muatan),
  }).then(wajib);
}

function kompakMuatan(m: MuatanKirim): Record<string, unknown> {
  const hasil: Record<string, unknown> = { body: m.body };
  if (m.parent_id) {
    hasil.parent_id = m.parent_id;
  }
  if (m.mentions && m.mentions.length > 0) {
    hasil.mentions = m.mentions;
  }
  if (m.task_refs && m.task_refs.length > 0) {
    hasil.task_refs = m.task_refs;
  }
  if (m.attachments && m.attachments.length > 0) {
    hasil.attachments = m.attachments;
  }
  return hasil;
}

/** GET /obrolan/{c}/pesan/{m}/balasan — akar + balasan tua→baru, halaman berikutnya `setelah=next_cursor`. */
export function balasanThread(channelId: string, messageId: string, setelah?: string | null): Promise<HasilThread> {
  return apiRequest<HasilThread>(`obrolan/${channelId}/pesan/${messageId}/balasan`, {
    query: { setelah: setelah ?? null, per_page: 30 },
  }).then(wajib);
}

/** PATCH /obrolan/{c}/pesan/{m} — hanya pengirim. */
export function suntingPesan(
  channelId: string,
  messageId: string,
  muatan: { body: string; mentions?: string[]; task_refs?: string[] },
): Promise<{ message: Pesan; tasks: RujukanTugas[] }> {
  return apiRequest<{ message: Pesan; tasks: RujukanTugas[] }>(`obrolan/${channelId}/pesan/${messageId}`, {
    method: 'PATCH',
    json: kompakMuatan(muatan),
  }).then(wajib);
}

/** DELETE /obrolan/{c}/pesan/{m} — pengirim atau admin kanal. */
export function hapusPesan(channelId: string, messageId: string): Promise<{ message: Pesan }> {
  return apiRequest<{ message: Pesan }>(`obrolan/${channelId}/pesan/${messageId}`, { method: 'DELETE' }).then(wajib);
}

/** POST|DELETE …/reaksi — idempoten: POST memastikan ada, DELETE memastikan hilang. */
export function setReaksi(channelId: string, messageId: string, emoji: string, aktif: boolean): Promise<{ reacted: boolean; message: Pesan }> {
  return apiRequest<{ reacted: boolean; message: Pesan }>(`obrolan/${channelId}/pesan/${messageId}/reaksi`, {
    method: aktif ? 'POST' : 'DELETE',
    json: { emoji },
  }).then(wajib);
}

// ── Buat / jelajah / detail ────────────────────────────────────────────────

/** POST /obrolan {jenis:'langsung'} — 1 orang = DM, 2–8 = grup. DM/grup yang sama dipakai ulang. */
export function buatPercakapan(userIds: string[]): Promise<{ id: string; created: boolean; channel: DetailKanal }> {
  return apiRequest<{ id: string; created: boolean; channel: DetailKanal }>('obrolan', {
    method: 'POST',
    json: { jenis: 'langsung', user_ids: userIds },
  }).then(wajib);
}

/** POST /obrolan {jenis:'kanal'} — nama dinormalisasi jadi slug oleh server. */
export function buatKanalBaru(data: { name: string; topic?: string; private: boolean; member_ids: string[] }): Promise<{ id: string; created: boolean; channel: DetailKanal }> {
  return apiRequest<{ id: string; created: boolean; channel: DetailKanal }>('obrolan', {
    method: 'POST',
    json: {
      jenis: 'kanal',
      name: data.name,
      topic: data.topic && data.topic.trim() !== '' ? data.topic.trim() : undefined,
      private: data.private,
      member_ids: data.member_ids.length > 0 ? data.member_ids : undefined,
    },
  }).then(wajib);
}

/** GET /obrolan/kanal-publik — kanal publik aktif perusahaan (jelajah). */
export function jelajahKanalPublik(q: string, page: number): Promise<{ channels: KanalPublik[]; meta: Halaman }> {
  return apiRequest<{ channels: KanalPublik[]; meta: Halaman }>('obrolan/kanal-publik', {
    query: { q: q.trim() === '' ? null : q.trim(), page, per_page: 30 },
  }).then(wajib);
}

/** POST /obrolan/{c}/gabung — 201 baru bergabung / 200 sudah anggota (idempoten). */
export function gabungKanal(channelId: string): Promise<{ joined: boolean; channel: DetailKanal }> {
  return apiRequest<{ joined: boolean; channel: DetailKanal }>(`obrolan/${channelId}/gabung`, { method: 'POST' }).then(wajib);
}

/** GET /obrolan/{c} — detail kanal (maks. 50 anggota pertama). */
export function detailKanal(channelId: string): Promise<{ channel: DetailKanal }> {
  return apiRequest<{ channel: DetailKanal }>(`obrolan/${channelId}`).then(wajib);
}

/** GET /obrolan/{c}/anggota — semua anggota berhalaman (≤ 100). */
export function anggotaKanal(channelId: string, page: number): Promise<{ members: AnggotaKanal[]; meta: Halaman }> {
  return apiRequest<{ members: AnggotaKanal[]; meta: Halaman }>(`obrolan/${channelId}/anggota`, {
    query: { page, per_page: 50 },
  }).then(wajib);
}

/** PATCH /obrolan/{c}/bisu {muted} — mention tetap menotifikasi. */
export function bisukanKanal(channelId: string, muted: boolean): Promise<{ muted: boolean }> {
  return apiRequest<{ muted: boolean }>(`obrolan/${channelId}/bisu`, { method: 'PATCH', json: { muted } }).then(wajib);
}

/** POST /obrolan/{c}/dibaca — memajukan penunjuk baca (tak pernah mundur). */
export async function tandaiDibaca(channelId: string): Promise<void> {
  await apiRequest(`obrolan/${channelId}/dibaca`, { method: 'POST' });
}

/** GET /obrolan/{c}/dibaca-oleh/{m} — hanya nama pembaca (tanpa waktu). */
export function dibacaOleh(
  channelId: string,
  messageId: string,
): Promise<{ message_id: string; recipients_count: number; read_count: number; readers: Peserta[] }> {
  return apiRequest<{ message_id: string; recipients_count: number; read_count: number; readers: Peserta[] }>(
    `obrolan/${channelId}/dibaca-oleh/${messageId}`,
  ).then(wajib);
}

// ── Cari & pembantu komposer ───────────────────────────────────────────────

/** GET /obrolan/{c}/cari — awalan kata, terbaru dulu, 20 per halaman. */
export function cariPesan(
  channelId: string,
  q: string,
  sebelum?: string | null,
): Promise<{ query: string; messages: Pesan[]; has_more: boolean; next_cursor: string | null }> {
  return apiRequest<{ query: string; messages: Pesan[]; has_more: boolean; next_cursor: string | null }>(`obrolan/${channelId}/cari`, {
    query: { q, sebelum: sebelum ?? null },
  }).then(wajib);
}

/** GET /obrolan/rujukan/tugas — saran #KEY-n (maks. 8). */
export function saranRujukanTugas(q: string): Promise<{ tasks: RujukanTugas[] }> {
  return apiRequest<{ tasks: RujukanTugas[] }>('obrolan/rujukan/tugas', { query: { q } }).then(wajib);
}

/** GET /obrolan/{c}/file-drive — file dari cache `drive_files` (tanpa panggilan Google). */
export function daftarFileDrive(channelId: string, q: string): Promise<{ files: FileDrive[] }> {
  return apiRequest<{ files: FileDrive[] }>(`obrolan/${channelId}/file-drive`, { query: { q: q.trim() === '' ? null : q.trim() } }).then(wajib);
}

/** GET /orang?q= — pemilih orang (B2-B); email tidak dikembalikan. */
export function cariOrang(q: string): Promise<{ orang: OrangRingkas[] }> {
  return apiRequest<{ orang: OrangRingkas[] }>('orang', { query: { q: q.trim() === '' ? null : q.trim() } }).then(wajib);
}
