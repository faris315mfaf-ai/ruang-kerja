/**
 * Tamu eksternal & ruang tunggu rapat video — kontrak FINAL
 * `docs/sesi/rapat-tamu-eksternal.md` §4 (API v1, Bearer, di balik `features.meetings`).
 *
 * - Penyelenggara: daftar tamu + tautan pribadi, tambah, putar ulang, cabut.
 * - Penyelenggara/notulis/peserta internal: ruang tunggu, izinkan, tolak.
 * - Mengeluarkan/membisukan tamu di ruang memakai `keluarkanPeserta`/`bisukanPeserta`
 *   di `video.ts` dengan `user_id = "guest:{id}"`.
 *
 * Tautan tamu adalah RAHASIA: semua panggilan di sini `cache: false` (jawaban tidak
 * pernah masuk cache offline; `/tamu` juga masuk daftar tolak `src/offline/cache.ts`),
 * dan tidak ada yang mencatat isi jawaban ke log. Aksi tulis tidak pernah diantrekan.
 */
import { apiRequest } from './client';

export type StatusTamu = 'none' | 'waiting' | 'admitted' | 'denied' | 'removed';

export interface JendelaTamu {
  state: 'early' | 'open' | 'closed';
  opens_at: string;
  closes_at: string;
}

export interface TamuRapat {
  id: string;
  email: string;
  name: string | null;
  /** Tautan pribadi lengkap (rahasia) — hanya untuk Bagikan; jangan ditampilkan utuh atau dicatat. */
  link_url: string;
  link_expires_at: string | null;
  link_expired: boolean;
  link_rotated_at: string | null;
  status: StatusTamu;
  status_label: string;
  requested_at: string | null;
  admitted_at: string | null;
  in_room: boolean;
  /** `guest:{id}` — identitas peserta LiveKit untuk moderasi. */
  identity: string;
}

export interface DaftarTamu {
  occurrence_date: string;
  window: JendelaTamu;
  limit: number;
  guests: TamuRapat[];
}

export interface PenungguTamu {
  id: string;
  name: string | null;
  email: string | null;
  requested_at: string | null;
  identity: string;
}

export interface RuangTunggu {
  occurrence_date: string;
  window: JendelaTamu;
  waiting: PenungguTamu[];
  waiting_count: number;
}

export interface KeputusanTamu {
  id: string;
  name: string | null;
  status: 'admitted' | 'denied';
  status_label: string;
}

/** Tamu yang pernah masuk ruang (webhook LiveKit) — bagian `guests` pada `video/kehadiran`. */
export interface TamuHadir {
  participant_id: string;
  name: string;
  joined_at: string;
  left_at: string | null;
  duration_seconds: number;
  in_room: boolean;
  sessions: number;
}

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons kosong dari server.');
  }
  return nilai;
}

function q(tanggal: string | null | undefined): Record<string, string | undefined> {
  return { tanggal: tanggal ?? undefined };
}

/** GET /rapat/{id}/tamu — hanya penyelenggara (403 lainnya, 404 bila rapat tak terlihat). */
export async function daftarTamu(id: string, tanggal?: string | null): Promise<DaftarTamu> {
  return wajib(await apiRequest<DaftarTamu>(`rapat/${id}/tamu`, { query: q(tanggal), cache: false }));
}

export interface HasilTambahTamu {
  guest: TamuRapat;
  /** `true` = tamu baru (201); `false` = email sudah terdaftar (200, tautan tidak berubah, hanya nama). */
  baru: boolean;
}

/** POST /rapat/{id}/tamu {email, name?} — 422 `terlalu_banyak_tamu` bila lewat 30. */
export async function tambahTamu(id: string, email: string, nama: string | null, kunci: string, tanggal?: string | null): Promise<HasilTambahTamu> {
  const info: { status?: number } = {};
  const hasil = await apiRequest<{ guest: TamuRapat }>(`rapat/${id}/tamu`, {
    method: 'POST',
    query: q(tanggal),
    json: nama ? { email, name: nama } : { email },
    idempotencyKey: kunci,
    cache: false,
    hasil: info,
  });
  return { guest: wajib(hasil).guest, baru: info.status === 201 };
}

/** POST /rapat/{id}/tamu/{participant}/putar — tautan baru; yang lama mati, tamu di ruang dikeluarkan. */
export async function putarTautanTamu(id: string, tamuId: string, kunci: string, tanggal?: string | null): Promise<TamuRapat> {
  const hasil = await apiRequest<{ guest: TamuRapat }>(`rapat/${id}/tamu/${tamuId}/putar`, { method: 'POST', query: q(tanggal), idempotencyKey: kunci, cache: false });
  return wajib(hasil).guest;
}

/** DELETE /rapat/{id}/tamu/{participant} — cabut tamu (tautan mati, dikeluarkan dari ruang). */
export async function cabutTamu(id: string, tamuId: string, kunci: string): Promise<void> {
  await apiRequest(`rapat/${id}/tamu/${tamuId}`, { method: 'DELETE', idempotencyKey: kunci, cache: false });
}

/** GET /rapat/{id}/video/ruang-tunggu — polling ±4 detik oleh yang berwenang (manageLobby). */
export async function ruangTunggu(id: string, tanggal?: string | null): Promise<RuangTunggu> {
  return wajib(await apiRequest<RuangTunggu>(`rapat/${id}/video/ruang-tunggu`, { query: q(tanggal), cache: false, timeoutMs: 10_000 }));
}

/** POST …/ruang-tunggu/{participant}/izinkan — juga mengizinkan lagi tamu yang ditolak/dikeluarkan. */
export async function izinkanTamu(id: string, tamuId: string, tanggal?: string | null): Promise<KeputusanTamu> {
  const hasil = await apiRequest<{ guest: KeputusanTamu }>(`rapat/${id}/video/ruang-tunggu/${tamuId}/izinkan`, { method: 'POST', query: q(tanggal), cache: false });
  return wajib(hasil).guest;
}

/** POST …/ruang-tunggu/{participant}/tolak — hanya dari status menunggu. */
export async function tolakTamu(id: string, tamuId: string, tanggal?: string | null): Promise<KeputusanTamu> {
  const hasil = await apiRequest<{ guest: KeputusanTamu }>(`rapat/${id}/video/ruang-tunggu/${tamuId}/tolak`, { method: 'POST', query: q(tanggal), cache: false });
  return wajib(hasil).guest;
}
