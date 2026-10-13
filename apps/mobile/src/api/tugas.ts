/**
 * Klien API modul Tugas (Bagian 3 · B3-A1). Kontrak: docs/sesi/ponsel-b3a1-tugas.md.
 * Semua fungsi melempar `ApiError` (status 0 = tanpa koneksi).
 */
import { ApiError, apiRequest, formFile } from '@/api/client';
import type { PageMeta } from '@/api/types';

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new ApiError({ status: 500, message: 'Jawaban server kosong. Coba lagi.' });
  }
  return nilai;
}

// ── Tipe bersama ─────────────────────────────────────────────────────────────

export type KategoriStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'canceled';
export type JenisWorkspace = 'personal' | 'team' | 'division' | 'project';
export type KelompokTenggat = 'terlambat' | 'hari-ini' | 'minggu-ini' | 'nanti' | 'tanpa-tenggat' | 'selesai';
export type LajurRencana = 'today' | 'week' | 'later';
export type LingkupTugas = 'ditugaskan' | 'saya-amati' | 'saya-buat';

export interface RefWorkspace {
  id: string;
  key: string;
  name: string;
  type: JenisWorkspace;
  archived?: boolean;
}

export interface StatusTugas {
  id: string;
  name: string;
  category: KategoriStatus;
  is_done: boolean;
}

export interface OpsiStatus {
  id: string;
  name: string;
  category: KategoriStatus;
  color: string;
  position: string;
}

export interface Orang {
  id: string;
  name: string;
  avatar: string | null;
}

export interface LabelTugas {
  id: string;
  name: string;
  color: string;
}

export interface BarisTugas {
  id: string;
  key: string;
  number: number;
  title: string;
  workspace: RefWorkspace;
  status: StatusTugas;
  priority: { value: number; label: string };
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  assignees: string[];
  assignee_people: Orang[];
  labels: LabelTugas[];
  checklist: { done: number; total: number } | null;
  days_late: number;
  group: KelompokTenggat;
  plan: { bucket: LajurRencana | null; lane: LajurRencana };
  source: 'manual' | 'attendance';
}

export interface HalamanTugasSaya {
  tasks: BarisTugas[];
  meta: PageMeta & {
    scope: LingkupTugas;
    today: string;
    counts: Record<LingkupTugas, number>;
    summary: { aktif: number; terlambat: number; hari_ini: number };
  };
}

export interface ParamTugasSaya {
  scope?: LingkupTugas;
  workspace?: string[];
  prioritas?: number[];
  status?: KategoriStatus[];
  label?: string[];
  penanggung?: string;
  tenggat?: 'overdue' | 'today' | 'week' | 'none' | null;
  q?: string;
  selesai?: 'minggu-ini' | 'tidak';
  urut?: 'tenggat' | 'prioritas' | 'dibuat' | 'diperbarui' | 'judul' | 'workspace';
  arah?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

function csv(nilai: (string | number)[] | undefined): string | undefined {
  return nilai && nilai.length > 0 ? nilai.join(',') : undefined;
}

export async function daftarTugasSaya(p: ParamTugasSaya): Promise<HalamanTugasSaya> {
  return wajib(
    await apiRequest<HalamanTugasSaya>('tugas', {
      query: {
        scope: p.scope,
        workspace: csv(p.workspace),
        prioritas: csv(p.prioritas),
        status: csv(p.status),
        label: csv(p.label),
        penanggung: p.penanggung,
        tenggat: p.tenggat ?? undefined,
        q: p.q?.trim() || undefined,
        selesai: p.selesai,
        urut: p.urut,
        arah: p.arah,
        page: p.page,
        per_page: p.per_page,
      },
    }),
  );
}

// ── Rencana pribadi ──────────────────────────────────────────────────────────

export interface ItemRencana {
  id: string;
  key: string;
  number: number;
  title: string;
  url: string;
  workspace: { name: string; key: string; type: JenisWorkspace };
  due_date: string | null;
  days_late: number;
  priority: number;
  status?: { id: string; name: string; category: KategoriStatus };
  is_personal: boolean;
  checklist?: { done: number; total: number } | null;
  lane: LajurRencana;
  auto: boolean;
  carried: boolean;
  done: boolean;
  completed_at: string | null;
  can_complete?: boolean;
  completes_to?: string | null;
  complete_hint?: string | null;
}

export interface TugasBaruMasuk {
  id: string;
  key: string;
  number: number;
  title: string;
  url: string;
  workspace: { name: string; key: string; type: JenisWorkspace };
  due_date: string | null;
  days_late: number;
  priority: number;
  assigned_by: string | null;
  assigned_at: string | null;
}

export interface Perencana {
  today: string;
  incoming: TugasBaruMasuk[];
  lanes: Record<LajurRencana, ItemRencana[]>;
  counts: { incoming: number; today: number; week: number; later: number };
  progress: { done: number; total: number };
  lane_labels: Record<LajurRencana, string>;
}

export async function rencanaSaya(): Promise<Perencana> {
  return wajib(await apiRequest<Perencana>('tugas/rencana'));
}

export async function setRencana(
  id: string,
  bucket: LajurRencana | null,
  posisi?: { after_id?: string; before_id?: string; position?: number },
): Promise<Perencana> {
  const hasil = wajib(
    await apiRequest<{ planner: Perencana }>(`tugas/${id}/rencana`, { method: 'PUT', json: { bucket, ...posisi } }),
  );
  return hasil.planner;
}

// ── Tampilan tersimpan ───────────────────────────────────────────────────────

export interface FilterTersimpan {
  assignees?: string[];
  priorities?: number[];
  labels?: string[];
  due?: 'overdue' | 'today' | 'week' | 'none' | null;
  q?: string;
  workspaces?: string[];
  statuses?: KategoriStatus[];
  due_from?: string | null;
  due_to?: string | null;
}

export interface TampilanTersimpan {
  id: string;
  name: string;
  layout: 'board' | 'list' | 'calendar';
  filters: FilterTersimpan;
  is_shared: boolean;
  mine: boolean;
  owner?: string | null;
  workspace_id: string | null;
  sort?: unknown;
}

export async function daftarTampilan(): Promise<TampilanTersimpan[]> {
  return wajib(await apiRequest<{ views: TampilanTersimpan[] }>('tugas/tampilan')).views;
}

export async function simpanTampilan(body: { name: string; filters: FilterTersimpan; layout?: 'list' }): Promise<TampilanTersimpan> {
  return wajib(await apiRequest<{ view: TampilanTersimpan }>('tugas/tampilan', { method: 'POST', json: body })).view;
}

export async function hapusTampilan(id: string): Promise<void> {
  await apiRequest<null>(`tugas/tampilan/${id}`, { method: 'DELETE' });
}

// ── Detail ───────────────────────────────────────────────────────────────────

export interface ButirChecklist {
  id: string;
  title: string;
  is_done: boolean;
  position: string;
  done_by: string | null;
  done_at: string | null;
}

export interface Lampiran {
  id: string;
  name: string;
  kind: 'doc' | 'sheet' | 'slide' | 'pdf' | 'image' | 'folder' | 'other';
  mime_type: string | null;
  size_bytes: number | null;
  source: 'drive' | 'storage';
  link: string | null;
  preview_url: string | null;
  created_at: string | null;
  uploaded_by: { id: string; name: string } | null;
  can_remove: boolean;
}

export interface DriveInfo {
  enabled: boolean;
  fake: boolean;
  picker_enabled: boolean;
  max_upload_bytes: number;
  chunk_bytes: number;
}

export interface Aktivitas {
  id: string;
  event: string;
  text: string;
  properties: Record<string, unknown>;
  causer: Orang | null;
  created_at: string;
}

export interface IzinTugas {
  edit: boolean;
  delete: boolean;
  comment: boolean;
  work: boolean;
  plan: boolean;
  move: boolean;
  watch: boolean;
  track_reads: boolean;
  moderate: boolean;
}

export type KunciIzin = keyof IzinTugas;

export interface BannerTugas {
  kind: 'titipan' | 'arsip' | 'lihat_saja';
  message: string;
  assigned_by?: Orang | null;
}

export interface DetailTugasPenuh {
  id: string;
  key: string;
  number: number;
  title: string;
  url: string;
  workspace: RefWorkspace & { archived: boolean };
  status: StatusTugas;
  status_id: string;
  statuses: OpsiStatus[];
  priority: { value: number; label: string };
  due_date: string | null;
  start_date: string | null;
  estimate_hours: number | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
  source: 'manual' | 'attendance';
  creator: Orang | null;
  parent: { id: string; key: string; title: string; status_category: KategoriStatus } | null;
  assignees: string[];
  assignee_people: Orang[];
  labels: LabelTugas[];
  workspace_labels: LabelTugas[];
  description_text: string | null;
  description_html: string | null;
  description_plain: boolean;
  checklist: { done: number; total: number } | null;
  checklist_items: ButirChecklist[];
  subtasks: BarisTugas[];
  attachments: Lampiran[];
  attachments_can_edit: boolean;
  drive: DriveInfo;
  watchers: Orang[];
  am_watching: boolean;
  activity_preview: Aktivitas[];
  comments: { count: number; unread: boolean };
  plan: { bucket: LajurRencana | null; planned_for: string | null };
  view_only: boolean;
  can: IzinTugas;
  locked_reason: Record<KunciIzin, string | null>;
  banner: BannerTugas | null;
}

export async function detailTugasPenuh(id: string): Promise<DetailTugasPenuh> {
  return wajib(await apiRequest<{ task: DetailTugasPenuh }>(`tugas/${id}`)).task;
}

// ── Tulis tugas ──────────────────────────────────────────────────────────────

export interface BodyBuatTugas {
  workspace_id: string;
  title: string;
  description?: string | null;
  assignee_ids?: string[];
  due_date?: string | null;
  priority?: number;
  status_id?: string;
  label_ids?: string[];
  start_date?: string | null;
  estimate_hours?: number | null;
  parent_id?: string;
}

export async function buatTugasBaru(body: BodyBuatTugas): Promise<DetailTugasPenuh> {
  return wajib(await apiRequest<{ task: DetailTugasPenuh }>('tugas', { method: 'POST', json: body })).task;
}

export interface BodyUbahTugas {
  title?: string;
  description?: string | null;
  due_date?: string | null;
  priority?: number;
  assignee_ids?: string[];
  label_ids?: string[];
  start_date?: string | null;
  estimate_hours?: number | null;
}

export async function ubahTugas(id: string, body: BodyUbahTugas): Promise<DetailTugasPenuh> {
  return wajib(await apiRequest<{ task: DetailTugasPenuh }>(`tugas/${id}`, { method: 'PATCH', json: body })).task;
}

export async function pindahStatus(id: string, body: { done: boolean } | { status_id: string }): Promise<BarisTugas> {
  return wajib(await apiRequest<{ task: BarisTugas }>(`tugas/${id}/status`, { method: 'PATCH', json: body })).task;
}

export async function hapusTugasPenuh(id: string): Promise<void> {
  await apiRequest<null>(`tugas/${id}`, { method: 'DELETE' });
}

// ── Checklist ────────────────────────────────────────────────────────────────

export interface HasilChecklist {
  items: ButirChecklist[];
  checklist: { done: number; total: number } | null;
}

export async function tambahButir(id: string, title: string): Promise<HasilChecklist> {
  return wajib(await apiRequest<HasilChecklist>(`tugas/${id}/checklist`, { method: 'POST', json: { title } }));
}

export async function ubahButir(
  id: string,
  butir: string,
  body: { title?: string; is_done?: boolean; after_id?: string; before_id?: string },
): Promise<HasilChecklist> {
  return wajib(await apiRequest<HasilChecklist>(`tugas/${id}/checklist/${butir}`, { method: 'PATCH', json: body }));
}

export async function hapusButir(id: string, butir: string): Promise<HasilChecklist> {
  return wajib(await apiRequest<HasilChecklist>(`tugas/${id}/checklist/${butir}`, { method: 'DELETE' }));
}

// ── Sub-tugas, pengamat, lampiran, aktivitas ────────────────────────────────

export async function buatSubtugas(id: string, body: { title: string; priority?: number; due_date?: string | null; assignee_ids?: string[] }): Promise<BarisTugas> {
  return wajib(await apiRequest<{ subtask: BarisTugas }>(`tugas/${id}/subtugas`, { method: 'POST', json: body })).subtask;
}

export async function amati(id: string, aktif: boolean): Promise<{ watching: boolean; watchers: Orang[] }> {
  return wajib(await apiRequest<{ watching: boolean; watchers: Orang[] }>(`tugas/${id}/amati`, { method: aktif ? 'POST' : 'DELETE' }));
}

export interface HasilLampiran {
  attachments: Lampiran[];
  attachments_can_edit: boolean;
  drive: DriveInfo;
}

export async function daftarLampiran(id: string): Promise<HasilLampiran> {
  return wajib(await apiRequest<HasilLampiran>(`tugas/${id}/lampiran`));
}

export async function lepasLampiran(id: string, lampiran: string): Promise<HasilLampiran> {
  return wajib(await apiRequest<HasilLampiran>(`tugas/${id}/lampiran/${lampiran}`, { method: 'DELETE' }));
}

/** 202 = diproses lewat antrean; 503 `drive_belum_siap` dilempar sebagai ApiError (code). */
export async function unggahLampiran(id: string, uri: string, nama: string, mime: string): Promise<{ upload_id: string; status: string; message: string }> {
  const form = new FormData();
  form.append('file', formFile(uri, nama, mime) as unknown as Blob);
  return wajib(await apiRequest<{ upload_id: string; status: string; message: string }>(`tugas/${id}/lampiran`, { method: 'POST', form, timeoutMs: 120_000 }));
}

export type JenisAktivitas = 'status' | 'penugasan' | 'tenggat' | 'prioritas' | 'isi' | 'checklist' | 'lampiran';

export async function daftarAktivitas(id: string, jenis: JenisAktivitas | null, page: number): Promise<{ activities: Aktivitas[]; meta: PageMeta }> {
  return wajib(
    await apiRequest<{ activities: Aktivitas[]; meta: PageMeta }>(`tugas/${id}/aktivitas`, { query: { jenis: jenis ?? undefined, page, per_page: 30 } }),
  );
}

// ── Komentar ─────────────────────────────────────────────────────────────────

export const EMOJI_REAKSI = ['👍', '🎉', '❤️', '😄', '👀', '🙏', '✅', '🚀'] as const;

export interface KomentarTugas {
  kind: 'comment';
  id: string;
  task_id: string;
  author: Orang | null;
  body: unknown;
  body_text: string | null;
  body_html: string | null;
  created_at: string | null;
  edited_at: string | null;
  deleted: boolean;
  reactions: { emoji: string; count: number; user_ids: string[]; names: string[] }[];
  attachments: Lampiran[];
  mine: boolean;
  my_reactions: string[];
  can: { edit: boolean; delete: boolean; react: boolean };
}

export interface HalamanKomentar {
  comments: KomentarTugas[];
  can: { comment: boolean; moderate: boolean };
  meta: PageMeta;
}

export async function daftarKomentar(id: string, page: number): Promise<HalamanKomentar> {
  return wajib(await apiRequest<HalamanKomentar>(`tugas/${id}/komentar`, { query: { page } }));
}

export interface BodyKomentar {
  body: string;
  mentions?: string[];
  task_refs?: string[];
}

export async function kirimKomentarKaya(id: string, body: BodyKomentar): Promise<KomentarTugas> {
  return wajib(await apiRequest<{ comment: KomentarTugas }>(`tugas/${id}/komentar`, { method: 'POST', json: body })).comment;
}

export async function suntingKomentar(komentar: string, body: BodyKomentar): Promise<KomentarTugas> {
  return wajib(await apiRequest<{ comment: KomentarTugas }>(`komentar/${komentar}`, { method: 'PATCH', json: body })).comment;
}

export async function hapusKomentar(komentar: string): Promise<KomentarTugas> {
  return wajib(await apiRequest<{ comment: KomentarTugas }>(`komentar/${komentar}`, { method: 'DELETE' })).comment;
}

export async function setReaksi(komentar: string, emoji: string, aktif: boolean): Promise<KomentarTugas> {
  return wajib(
    await apiRequest<{ active: boolean; comment: KomentarTugas }>(`komentar/${komentar}/reaksi`, {
      method: aktif ? 'POST' : 'DELETE',
      json: { emoji },
    }),
  ).comment;
}

export async function tandaiKomentarDibaca(id: string, komentarId?: string): Promise<void> {
  await apiRequest(`tugas/${id}/komentar/dibaca`, { method: 'POST', json: komentarId ? { comment_id: komentarId } : {} });
}

export interface PembacaKomentar {
  user: Orang;
  last_read_comment_id: string;
  last_read_at: string;
  read_at: string | null;
}

export async function dibacaOleh(id: string): Promise<{ tracking: boolean; readers: PembacaKomentar[] }> {
  return wajib(await apiRequest<{ tracking: boolean; readers: PembacaKomentar[] }>(`tugas/${id}/dibaca-oleh`));
}

export async function cariMention(id: string, q: string): Promise<Orang[]> {
  return wajib(await apiRequest<{ people: Orang[] }>(`tugas/${id}/mention`, { query: { q, limit: 8 } })).people;
}

export interface RujukanTugas {
  id: string;
  key: string;
  title: string;
  status_category: KategoriStatus;
  workspace: { key: string; name: string };
}

export async function cariRujukan(q: string, workspace?: string): Promise<RujukanTugas[]> {
  return wajib(await apiRequest<{ tasks: RujukanTugas[] }>('tugas/rujukan', { query: { q, workspace, limit: 8 } })).tasks;
}

// ── Pilihan workspace untuk tugas baru / filter ─────────────────────────────

export interface OpsiWorkspace {
  id: string;
  key: string;
  name: string;
  arsip: boolean;
  type: JenisWorkspace;
  type_label: string;
  group: 'pribadi' | 'divisi' | 'proyek' | 'lainnya';
  color: string;
  is_member: boolean;
  my_role: string | null;
  view_only: boolean;
}

export interface KelompokWorkspaceTugas {
  jenis: string;
  label: string;
  items: OpsiWorkspace[];
}

export async function workspaceUntukTugas(): Promise<KelompokWorkspaceTugas[]> {
  return wajib(await apiRequest<{ groups: KelompokWorkspaceTugas[] }>('workspace')).groups;
}

export interface KonteksWorkspace {
  statuses: { id: string; name: string; category: KategoriStatus; color: string }[];
  labels: LabelTugas[];
  canEdit: boolean;
  readOnlyReason: string | null;
}

interface PapanMentah {
  columns: { id: string; name: string; kategori: KategoriStatus; color: string }[];
  labels?: LabelTugas[];
  can?: { edit_tasks?: boolean };
  read_only?: { read_only: boolean; reason: string | null };
}

export async function konteksWorkspace(workspace: string): Promise<KonteksWorkspace> {
  const p = wajib(await apiRequest<PapanMentah>(`workspace/${workspace}/papan`));
  return {
    statuses: p.columns.map((k) => ({ id: k.id, name: k.name, category: k.kategori, color: k.color })),
    labels: p.labels ?? [],
    canEdit: p.can?.edit_tasks !== false && !p.read_only?.read_only,
    readOnlyReason: p.read_only?.read_only ? (p.read_only.reason ?? null) : null,
  };
}

export async function anggotaUntukTugas(workspace: string): Promise<Orang[]> {
  const d = await apiRequest<{ anggota?: { id: string; name: string; avatar: string | null }[] }>(`workspace/${workspace}/anggota`);
  return (d?.anggota ?? []).map((a) => ({ id: a.id, name: a.name, avatar: a.avatar }));
}
