/**
 * API Catatan & notulensi (Bagian 3, paket B3-B) — kontrak:
 * docs/sesi/ponsel-b3b-catatan.md. Semua endpoint di balik flag
 * `features.notes` (404 saat mati). Penyimpanan isi/judul memakai PATCH
 * /catatan/{id} (Tahap 2) dengan satu maksud per permintaan.
 */
import { apiRequest } from './client';
import type { NoteDetailData } from './types';

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons kosong dari server.');
  }
  return nilai;
}

export type NoteKind = 'note' | 'folder';
export type MyRole = 'author' | 'edit' | 'view';
export type NoteAccess = 'workspace' | 'restricted';

/** Detail catatan (GET /catatan/{id}) — posisi lexorank berupa string. */
export type CatatanDetail = Omit<NoteDetailData, 'position'> & { position: string | number };

/** Simpul pohon (`tree`) — folder/catatan dengan anak bersarang. */
export interface PohonNode {
  id: string;
  parent_id: string | null;
  kind: NoteKind;
  preset: string | null;
  title: string;
  access: NoteAccess;
  invited_only: boolean;
  position: string;
  penulis: string | null;
  penyunting: string | null;
  updated_at: string | null;
  my_role: MyRole;
  can_edit: boolean;
  children: PohonNode[];
}

export interface PohonWorkspace {
  workspace: { id: string; key: string; name: string; archived: boolean };
  can_create: boolean;
  tree: PohonNode[];
}

export function pohonWorkspace(workspace: string): Promise<PohonWorkspace> {
  return apiRequest<PohonWorkspace>(`workspace/${workspace}/catatan`).then(wajib);
}

export function detailCatatan(id: string): Promise<CatatanDetail> {
  return apiRequest<{ note: CatatanDetail }>(`catatan/${id}`).then((r) => wajib(r).note);
}

/** PATCH rename — satu maksud per permintaan. */
export function ubahJudul(id: string, title: string): Promise<CatatanDetail> {
  return apiRequest<{ note: CatatanDetail }>(`catatan/${id}`, { method: 'PATCH', json: { title } }).then((r) => wajib(r).note);
}

/** PATCH isi teks polos: `updated_at` dasar = nilai terbaru dari respons mana pun. */
export function ubahIsi(id: string, bodyHtml: string, updatedAt: string): Promise<CatatanDetail> {
  return apiRequest<{ note: CatatanDetail }>(`catatan/${id}`, {
    method: 'PATCH',
    json: { body_html: bodyHtml, updated_at: updatedAt },
  }).then((r) => wajib(r).note);
}

export interface BuatCatatanInput {
  title: string;
  workspace_id?: string;
  parent_id?: string | null;
  kind?: NoteKind;
}

/** POST /catatan — catatan, folder, tab, atau sub-halaman (via `parent_id`). */
export function buatCatatan(input: BuatCatatanInput): Promise<CatatanDetail> {
  return apiRequest<{ note: CatatanDetail }>('catatan', { method: 'POST', json: input }).then((r) => wajib(r).note);
}

export function pindahCatatan(id: string, parentId: string | null): Promise<CatatanDetail> {
  return apiRequest<{ note: CatatanDetail }>(`catatan/${id}/pindah`, {
    method: 'PATCH',
    json: { parent_id: parentId },
  }).then((r) => wajib(r).note);
}

export interface HapusCatatanHasil {
  deleted: boolean;
  id: string;
  kind: NoteKind;
  workspace_id: string;
  parent_id: string | null;
}

export function hapusCatatan(id: string): Promise<HapusCatatanHasil> {
  return apiRequest<HapusCatatanHasil>(`catatan/${id}`, { method: 'DELETE' }).then(wajib);
}

// ── Tab dokumen ──────────────────────────────────────────────────────────────

export interface TabBaris {
  id: string;
  parent_id: string | null;
  title: string;
  preset: string | null;
  level: 0 | 1;
  tab_id: string;
  position: string;
  active: boolean;
  my_role: MyRole;
  can_edit: boolean;
  updated_at: string | null;
  next_subtab_title?: string;
}

export interface TabDokumen {
  root_id: string;
  active_id: string;
  can_create: boolean;
  next_tab_title: string;
  tabs: TabBaris[];
}

export function tabDokumen(id: string): Promise<TabDokumen> {
  return apiRequest<TabDokumen>(`catatan/${id}/tab`).then(wajib);
}

// ── Notulensi cepat ──────────────────────────────────────────────────────────

export function mulaiNotulensi(): Promise<{ note: CatatanDetail; mode: string }> {
  // `polos`: templat paragraf polos agar bisa disunting di editor ponsel (keputusan pemilik 13 Okt 2026).
  return apiRequest<{ note: CatatanDetail; mode: string }>('catatan/notulensi', { method: 'POST', json: { polos: true } }).then(wajib);
}

export interface NotulensiRingkas {
  id: string;
  title: string;
  workspace_name: string | null;
  updated_at: string | null;
}

export function notulensiTerakhir(limit = 3): Promise<NotulensiRingkas[]> {
  return apiRequest<{ minutes: NotulensiRingkas[] }>('catatan/notulensi/terakhir', { query: { limit } }).then((r) => wajib(r).minutes);
}

// ── Berbagi & akses ──────────────────────────────────────────────────────────

export type PeranUndangan = 'edit' | 'view';

export interface OrangAkses {
  user_id: string;
  name: string;
  avatar: string | null;
  title: string | null;
  role: PeranUndangan;
  role_label: string;
}

export interface AksesCatatan {
  note_id: string;
  access: NoteAccess;
  access_label: string;
  author: { id: string; name: string; avatar: string | null } | null;
  people: OrangAkses[];
}

export function aksesCatatan(id: string): Promise<AksesCatatan> {
  return apiRequest<{ share: AksesCatatan }>(`catatan/${id}/akses`).then((r) => wajib(r).share);
}

export function simpanAkses(id: string, access: NoteAccess, people: { user_id: string; role: PeranUndangan }[]): Promise<AksesCatatan> {
  return apiRequest<{ share: AksesCatatan }>(`catatan/${id}/akses`, { method: 'PUT', json: { access, people } }).then((r) => wajib(r).share);
}

export interface OrangPilihan {
  id: string;
  name: string;
  initials: string;
  avatar: string | null;
  position: string | null;
  division: string | null;
}

/** GET /orang?q= (B2-B) — pemilih orang untuk dialog Bagikan. */
export function cariOrang(q: string): Promise<OrangPilihan[]> {
  return apiRequest<{ orang: OrangPilihan[] }>('orang', { query: { q } }).then((r) => wajib(r).orang);
}

// ── Riwayat versi ────────────────────────────────────────────────────────────

export interface VersiCatatan {
  id: string;
  note_id: string;
  title: string;
  label: string | null;
  created_at: string;
  author: { id: string; name: string; avatar: string | null } | null;
}

export interface VersiPratinjau extends VersiCatatan {
  body_html: string | null;
  body_text: string | null;
}

export function versiCatatan(id: string): Promise<{ versions: VersiCatatan[]; can_restore: boolean }> {
  return apiRequest<{ versions: VersiCatatan[]; can_restore: boolean }>(`catatan/${id}/versi`).then(wajib);
}

export function pratinjauVersi(id: string, versi: string): Promise<VersiPratinjau> {
  return apiRequest<{ version: VersiPratinjau }>(`catatan/${id}/versi/${versi}`).then((r) => wajib(r).version);
}

export function pulihkanVersi(id: string, versi: string): Promise<{ note: CatatanDetail; versions: VersiCatatan[] }> {
  return apiRequest<{ note: CatatanDetail; versions: VersiCatatan[] }>(`catatan/${id}/versi/${versi}/pulihkan`, { method: 'POST' }).then(wajib);
}

// ── Cari ─────────────────────────────────────────────────────────────────────

export interface HasilCari {
  id: string;
  workspace_id: string;
  workspace_name: string;
  parent_id: string | null;
  kind: NoteKind;
  preset: string | null;
  title: string;
  access: NoteAccess;
  invited_only: boolean;
  snippet: string | null;
  penulis: string | null;
  updated_at: string | null;
}

export interface PencarianCatatan {
  query: string;
  total: number;
  workspaces: { id: string; key: string; name: string; count: number }[];
  results: HasilCari[];
}

export function cariCatatan(q: string, workspaceId?: string | null, limit = 30): Promise<PencarianCatatan> {
  return apiRequest<PencarianCatatan>('catatan/cari', { query: { q, workspace_id: workspaceId ?? undefined, limit } }).then(wajib);
}
