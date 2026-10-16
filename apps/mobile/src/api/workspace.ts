/**
 * Klien API Workspace & Otomasi (Bagian 3 · B3-A2). Kontrak:
 * docs/sesi/ponsel-b3a2-workspace.md. `{workspace}` boleh ULID atau key.
 * Tipe memakai bentuk respons server apa adanya (huruf kecil Indonesia).
 */
import { apiRequest } from './client';
import type { BoardTask, BoardTaskCategory } from './types';

// ── Umum ─────────────────────────────────────────────────────────────────────

export type KodeBacaSaja = 'arsip' | 'lihat_saja' | 'peran_viewer';

export interface BacaSaja {
  read_only: boolean;
  code: KodeBacaSaja | null;
  reason: string | null;
}

export interface MetaHalaman {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}

export type JenisKelompok = 'pribadi' | 'divisi' | 'proyek' | 'lainnya';
export type TipeWorkspace = 'personal' | 'team' | 'division' | 'project';
export type PeranWorkspace = 'owner' | 'admin' | 'member' | 'viewer';

function panggil<T>(path: string, opsi?: Parameters<typeof apiRequest>[1]): Promise<T> {
  return apiRequest<T>(path, opsi) as Promise<T>;
}

// ── Daftar, buat, favorit ────────────────────────────────────────────────────

export interface WorkspaceItem {
  id: string;
  key: string;
  name: string;
  arsip: boolean;
  type: TipeWorkspace;
  type_label: string;
  group: JenisKelompok;
  color: string;
  visibility: 'private' | 'internal';
  is_member: boolean;
  my_role: PeranWorkspace | null;
  favorit: boolean;
  view_only: boolean;
  members_count: number;
  open_tasks_count: number;
  overdue_tasks_count: number;
}

export interface KelompokWorkspace {
  jenis: JenisKelompok;
  label: string;
  items: WorkspaceItem[];
}

export interface DaftarWorkspace {
  groups: KelompokWorkspace[];
  can_create: { team: boolean; project: boolean };
  teams: { id: string; name: string }[];
}

export function ambilDaftarWorkspace(): Promise<DaftarWorkspace> {
  return panggil<DaftarWorkspace>('workspace');
}

export interface BodyBuatWorkspace {
  type?: 'team' | 'project';
  template_id?: string;
  name: string;
  key?: string;
  description?: string;
  visibility?: 'private' | 'internal';
  team_id?: string;
}

export async function buatWorkspace(body: BodyBuatWorkspace): Promise<{ workspace: WorkspaceItem; message: string }> {
  return panggil('workspace', { method: 'POST', json: body });
}

export interface TemplatWorkspace {
  id: string;
  name: string;
  description: string | null;
  type: 'team' | 'project';
  type_label: string;
  statuses: { name: string; category: string; color: string }[];
  labels: { id: string; name: string; color: string }[];
  used_count: number;
  can_use: boolean;
}

export async function ambilTemplatWorkspace(): Promise<TemplatWorkspace[]> {
  const data = await panggil<{ templat: TemplatWorkspace[] }>('workspace/templat');
  return data.templat;
}

export function setFavorit(workspace: string, favorit: boolean): Promise<{ favorit: boolean }> {
  return panggil(`workspace/${workspace}/favorit`, { method: favorit ? 'POST' : 'DELETE' });
}

// ── Detail ───────────────────────────────────────────────────────────────────

export type NamaTab = 'tugas' | 'dokumen' | 'file' | 'aktivitas' | 'anggota' | 'catatan' | 'ringkasan' | 'pengaturan';

export interface StatusAksesDrive {
  state: 'disabled' | 'preparing' | 'unused' | 'error' | 'pending' | 'synced';
  synced: number;
  pending: number;
  errors: number;
  total: number;
}

export interface DetailWorkspace {
  workspace: {
    id: string;
    key: string;
    name: string;
    type: TipeWorkspace;
    type_label: string;
    color: string;
    description: string | null;
    visibility: 'private' | 'internal';
    owner_id: string | null;
    arsip: boolean;
    archived_at: string | null;
    drive_folder_url: string | null;
  };
  my_role: PeranWorkspace | null;
  favorit: boolean;
  read_only: BacaSaja;
  can: {
    edit_tasks: boolean;
    manage: boolean;
    manage_members: boolean;
    archive: boolean;
    favorite: boolean;
    view_only: boolean;
    contribute_drive: boolean;
  };
  counts: { members: number; open_tasks: number; overdue_tasks: number; columns: number; documents: number; files: number };
  drive: { enabled: boolean; access: StatusAksesDrive };
  project: null | {
    status: string | null;
    status_label: string | null;
    health: string | null;
    health_label: string | null;
    start_date: string | null;
    target_date: string | null;
    lead_user_id: string | null;
    last_update_at: string | null;
  };
  tabs: NamaTab[];
}

export function ambilDetailWorkspace(workspace: string): Promise<DetailWorkspace> {
  return panggil<DetailWorkspace>(`workspace/${workspace}`);
}

// ── Papan / list / kalender ──────────────────────────────────────────────────

export interface LabelRef {
  id: string;
  name: string;
  color: string;
}

export interface KartuWorkspace extends BoardTask {
  status?: { id: string; name: string; kategori: BoardTaskCategory; color: string };
  can?: { move: boolean };
  overdue?: boolean;
  /** Hanya klien: perubahan di HP belum diterima server (overlay offline). */
  sinkron?: 'menunggu' | 'gagal';
}

export interface KolomPapan {
  id: string;
  name: string;
  kategori: BoardTaskCategory;
  color: string;
  posisi: number;
  tasks: KartuWorkspace[];
}

export interface PapanData {
  workspace: { id: string; key: string; name: string; type?: TipeWorkspace; color?: string; arsip?: boolean };
  columns: KolomPapan[];
  hidden_closed_count: number;
  labels: LabelRef[];
  members_count: number;
  can: { edit_tasks: boolean; move: boolean; view_only: boolean };
  read_only: BacaSaja;
}

export function ambilPapan(workspace: string): Promise<PapanData> {
  return panggil<PapanData>(`workspace/${workspace}/papan`);
}

export interface BodyPindahKartu {
  status_id: string;
  after_id?: string;
  before_id?: string;
}

export function pindahKartu(
  workspace: string,
  taskId: string,
  body: BodyPindahKartu,
): Promise<{ task: KartuWorkspace; column: KolomPapan; message: string }> {
  return panggil(`workspace/${workspace}/papan/kartu/${taskId}`, { method: 'PATCH', json: body });
}

export type UrutTugas = 'tenggat' | 'prioritas' | 'terbaru' | 'nomor';
export type FilterTenggat = 'overdue' | 'today' | 'week' | 'none';

export interface FilterTugas {
  q: string;
  /** `me` · `none` · id pengguna; kosong = semua. */
  assignee: string;
  prioritas: number[];
  label: string[];
  tenggat: FilterTenggat | '';
  status: string;
  urut: UrutTugas;
  selesai: boolean;
}

export const FILTER_KOSONG: FilterTugas = {
  q: '',
  assignee: '',
  prioritas: [],
  label: [],
  tenggat: '',
  status: '',
  urut: 'tenggat',
  selesai: false,
};

export interface ListTugasData {
  workspace: { id: string; key: string; name: string };
  tasks: KartuWorkspace[];
  statuses: { id: string; name: string; kategori: BoardTaskCategory; color: string; posisi: number }[];
  labels: LabelRef[];
  meta: MetaHalaman;
  can: { move: boolean };
  read_only: BacaSaja;
}

export function ambilListTugas(workspace: string, filter: FilterTugas, page: number): Promise<ListTugasData> {
  return panggil<ListTugasData>(`workspace/${workspace}/tugas`, {
    query: {
      q: filter.q.trim() || undefined,
      assignee: filter.assignee || undefined,
      prioritas: filter.prioritas.length > 0 ? filter.prioritas.join(',') : undefined,
      label: filter.label.length > 0 ? filter.label.join(',') : undefined,
      tenggat: filter.tenggat || undefined,
      status: filter.status || undefined,
      urut: filter.urut,
      selesai: filter.selesai ? 1 : undefined,
      page,
      per_page: 40,
    },
  });
}

export interface KalenderData {
  workspace: { id: string; key: string; name: string };
  bulan: string;
  today: string;
  range: { from: string; to: string };
  tasks: KartuWorkspace[];
  tanpa_tenggat: KartuWorkspace[];
  terlambat: number;
  can: { move: boolean };
  read_only: BacaSaja;
}

export function ambilKalenderWorkspace(workspace: string, bulan: string): Promise<KalenderData> {
  return panggil<KalenderData>(`workspace/${workspace}/kalender`, { query: { bulan } });
}

// ── Dokumen & file (Drive) ───────────────────────────────────────────────────

export interface InfoDrive {
  enabled: boolean;
  fake?: boolean;
  picker_enabled?: boolean;
  missing_settings?: string[];
  folder_url: string | null;
  folder_name: string | null;
  shared_drive_name: string | null;
  access: StatusAksesDrive;
  can_contribute: boolean;
  max_upload_bytes?: number;
  chunk_bytes?: number;
  syncing?: boolean;
}

export interface BerkasDrive {
  id: string;
  google_file_id: string;
  name: string;
  mime_type: string;
  kind: 'doc' | 'sheet' | 'slide' | 'pdf' | 'image' | 'folder' | 'other';
  kind_label: string;
  web_view_link: string | null;
  preview_url: string | null;
  icon_link: string | null;
  size_bytes: number | null;
  owner_email: string | null;
  owner_name?: string | null;
  modified_at: string | null;
  added_by: string | null;
  deleted: boolean;
  parent_id?: string | null;
  linked?: boolean;
  children_count?: number;
  used_in?: { key: string; title: string; url: string }[];
}

export interface DokumenData {
  drive: InfoDrive;
  counts: { documents: number; files: number };
  documents: BerkasDrive[];
  notes: { id: string; title: string; kind: 'note' | 'folder'; parent_id: string | null; updated_at: string | null }[];
}

export function ambilDokumen(workspace: string): Promise<DokumenData> {
  return panggil<DokumenData>(`workspace/${workspace}/dokumen`);
}

export function buatDokumenDrive(
  workspace: string,
  body: { type: 'document' | 'spreadsheet' | 'presentation'; name?: string; folder?: string },
): Promise<{ file: BerkasDrive; message: string }> {
  return panggil(`workspace/${workspace}/dokumen`, { method: 'POST', json: body });
}

export interface FileData {
  drive: InfoDrive;
  counts: { documents: number; files: number };
  folder: null | { id: string; name: string; url: string | null };
  breadcrumbs: { id: string | null; name: string }[];
  files: BerkasDrive[];
}

export function ambilFile(workspace: string, folder?: string | null): Promise<FileData> {
  return panggil<FileData>(`workspace/${workspace}/file`, { query: { folder: folder ?? undefined } });
}

// ── Aktivitas ────────────────────────────────────────────────────────────────

export interface BarisAktivitas {
  id: string;
  event: string;
  text: string;
  subject_type: 'task' | 'workspace' | string;
  subject_id: string | null;
  task_key: string | null;
  created_at: string;
  actor: { id: string; name: string; avatar: string | null } | null;
}

export function ambilAktivitas(workspace: string, page: number): Promise<{ aktivitas: BarisAktivitas[]; meta: MetaHalaman }> {
  return panggil(`workspace/${workspace}/aktivitas`, { query: { page } });
}

// ── Anggota ──────────────────────────────────────────────────────────────────

export type StatusDriveAnggota = 'tersinkron' | 'menunggu' | 'gagal' | 'akun_nonaktif' | 'drive_belum_aktif';

export interface AnggotaBaris {
  id: string;
  name: string;
  avatar: string | null;
  role: PeranWorkspace;
  role_label: string;
  is_synced: boolean;
  division: string | null;
  position: string | null;
  joined_at: string | null;
  drive_access: { status: StatusDriveAnggota; label: string; error: string | null; synced_at: string | null };
  can_change_role: boolean;
  can_remove: boolean;
}

export interface AnggotaData {
  anggota: AnggotaBaris[];
  can: { manage_members: boolean };
  role_options: { value: string; label: string }[];
  drive: StatusAksesDrive;
}

export function ambilAnggotaWorkspace(workspace: string): Promise<AnggotaData> {
  return panggil<AnggotaData>(`workspace/${workspace}/anggota`);
}

export interface KandidatAnggota {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  division: string | null;
}

export async function cariKandidatAnggota(workspace: string, q: string): Promise<KandidatAnggota[]> {
  const data = await panggil<{ kandidat: KandidatAnggota[] }>(`workspace/${workspace}/anggota/kandidat`, { query: { q: q.trim() || undefined } });
  return data.kandidat;
}

export function tambahAnggota(workspace: string, userId: string, role: string): Promise<{ anggota: AnggotaBaris; message: string }> {
  return panggil(`workspace/${workspace}/anggota`, { method: 'POST', json: { user_id: userId, role } });
}

export function ubahPeranAnggota(workspace: string, userId: string, role: string): Promise<{ anggota: AnggotaBaris; message: string }> {
  return panggil(`workspace/${workspace}/anggota/${userId}`, { method: 'PATCH', json: { role } });
}

export function keluarkanAnggota(workspace: string, userId: string): Promise<{ message: string }> {
  return panggil(`workspace/${workspace}/anggota/${userId}`, { method: 'DELETE' });
}

// ── Pengaturan (baca saja) ───────────────────────────────────────────────────

export interface PengaturanData {
  workspace: {
    id: string;
    key: string;
    name: string;
    type: TipeWorkspace;
    type_label: string;
    color: string;
    description: string | null;
    visibility: 'private' | 'internal';
    owner_id: string | null;
    arsip: boolean;
    previous_keys: string[];
  };
  can: DetailWorkspace['can'];
  edit_on_desktop: boolean;
  statuses: { id: string; name: string; kategori: BoardTaskCategory; kategori_label: string; color: string; posisi: number; tasks_count: number }[];
  labels: { id: string; name: string; color: string; tasks_count: number }[];
  drive: { enabled: boolean; folder_url: string | null; folder_name: string | null; access: StatusAksesDrive };
}

export function ambilPengaturan(workspace: string): Promise<PengaturanData> {
  return panggil<PengaturanData>(`workspace/${workspace}/pengaturan`);
}

// ── Otomasi ──────────────────────────────────────────────────────────────────

export interface RefWorkspaceKecil {
  id: string;
  key: string;
  name: string;
}

export interface BarisAturan {
  id: string;
  name: string;
  workspace: RefWorkspaceKecil;
  is_active: boolean;
  paused: boolean;
  trigger_type: 'task_moved' | 'task_overdue' | 'task_created_with_label';
  trigger_label: string;
  jika: string;
  maka: string[];
  sentence: string;
  run_count: number;
  last_run_at: string | null;
  created_by: string | null;
  can_manage: boolean;
  runs_7d?: number;
  failed_7d?: number;
}

export interface DaftarAturan {
  aturan: BarisAturan[];
  stats: { rules: number; active: number; runs_7d: number; success_7d: number; failed_7d: number };
  create_on_desktop: boolean;
}

export function ambilAturan(workspace?: string): Promise<DaftarAturan> {
  return panggil<DaftarAturan>('otomasi/aturan', { query: { workspace } });
}

export interface RunAturan {
  id: string;
  task_id: string | null;
  task_key: string;
  task_title: string;
  result: 'success' | 'failed' | 'skipped';
  result_label: string;
  detail: string;
  ran_at: string;
}

export function ambilDetailAturan(id: string): Promise<{ aturan: BarisAturan; runs: RunAturan[] }> {
  return panggil(`otomasi/aturan/${id}`);
}

export function jedaAturan(id: string, paused: boolean): Promise<{ aturan: BarisAturan; message: string }> {
  return panggil(`otomasi/aturan/${id}/jeda`, { method: 'PATCH', json: { paused } });
}

export interface BarisBerulang {
  id: string;
  title: string;
  workspace_id: string;
  assignee_id: string | null;
  priority: number;
  starts_on: string;
  ends_on: string | null;
  is_active: boolean;
  created_count: number;
  last_created_on: string | null;
  can_manage: boolean;
  workspace: RefWorkspaceKecil | null;
  assignee_name: string | null;
  pattern_label: string;
  next_dates: string[];
}

export function ambilBerulang(workspace?: string): Promise<{ berulang: BarisBerulang[]; today: string; create_on_desktop: boolean }> {
  return panggil('otomasi/berulang', { query: { workspace } });
}

export interface TemplatTugas {
  id: string;
  name: string;
  description: string | null;
  title: string;
  priority: number;
  priority_label: string;
  estimate_hours: number | null;
  checklist: string[];
  labels: LabelRef[];
  used_count: number;
  scope: 'semua' | 'workspace';
  workspace: RefWorkspaceKecil | null;
}

export async function ambilTemplatTugas(): Promise<TemplatTugas[]> {
  const data = await panggil<{ templat: TemplatTugas[] }>('otomasi/templat/tugas');
  return data.templat;
}

export function pakaiTemplatTugas(
  workspace: string,
  body: { template_id: string; title: string; due_date?: string },
): Promise<{
  task: { id: string; key: string; title: string; workspace: RefWorkspaceKecil; priority: { value: number; label: string }; due_date: string | null };
  skipped_labels: string[];
  message: string;
}> {
  return panggil(`workspace/${workspace}/tugas-dari-templat`, { method: 'POST', json: body });
}
