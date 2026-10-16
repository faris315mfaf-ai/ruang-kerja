/**
 * Portofolio & proyek (kontrak FINAL: docs/sesi/ponsel-b5a-manajemen.md §1–3,
 * endpoint P1–P15). Portofolio Direksi / proyek divisi Kadiv, detail proyek
 * (ringkasan, burn-up, milestone, update, risiko, tugas terlambat, tim), aksi
 * PIC (update, milestone, risiko) dan aksi pengarah Direksi (minta update,
 * arahan, tandai keputusan selesai).
 */
import { apiRequest } from './client';

export interface Orang {
  id: string;
  name: string;
  avatar: string | null;
}

export type Kesehatan = 'on_track' | 'at_risk' | 'off_track';
export type StatusProyek = 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled';
export type PenandaSistem = 'behind' | 'missed_milestone' | 'stale_update';
export type StatusMilestone = 'not_started' | 'in_progress' | 'completed' | 'completed_late' | 'missed';
export type LevelRisiko = 'high' | 'medium' | 'low';
export type KategoriTugas = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'canceled';

export interface RujukanProyek {
  id: string;
  key: string;
  name: string;
  type: 'project';
  color: string | null;
}

export interface MilestoneRingkas {
  id: string;
  name: string;
  target_date: string;
  status: StatusMilestone;
}

export interface MetrikProyek {
  actual: number | null;
  planned: number | null;
  variance: number | null;
  uses_estimates: boolean;
  flags: PenandaSistem[];
  overdue: number;
  scope: number;
  done: number;
  update_age_days: number | null;
  days_left: number | null;
  milestones_total: number;
  milestones_done: number;
  missed_milestones: { id: string; name: string; target_date: string }[];
  milestones: MilestoneRingkas[];
}

export interface BarisProyek extends RujukanProyek {
  division: string | null;
  lead: Orang | null;
  sponsor: Orang | null;
  start_date: string | null;
  target_date: string | null;
  project_status: StatusProyek | null;
  health: Kesehatan | null;
  last_update_at: string | null;
  completed_at: string | null;
  metrics: MetrikProyek;
  next_milestone: MilestoneRingkas | null;
}

export interface Arahan {
  id: string;
  body: string;
  author: Orang | null;
  project_update_id: string | null;
  created_at: string;
}

export interface UpdateProyek {
  id: string;
  health: Kesehatan;
  summary: string;
  blockers: string | null;
  decision_needed: string | null;
  decision_resolved_at: string | null;
  decision_resolved_by: string | null;
  progress_snapshot: number | null;
  planned_snapshot: number | null;
  author: Orang | null;
  created_at: string;
  directions: Arahan[];
  can_resolve: boolean;
}

export interface RujukanTugas {
  id: string;
  code: string;
  title: string;
  status_category: KategoriTugas;
  status_color: string | null;
}

export interface Opsi<T extends string = string> {
  value: T;
  label: string;
}

// ── P1 Portofolio ────────────────────────────────────────────────────────────

export type PeriodePortofolio = 'kuartal' | 'bulan' | 'semua';

export interface FilterPortofolio {
  periode?: PeriodePortofolio;
  divisi?: string | null;
  status?: Kesehatan | null;
  arsip?: boolean;
}

export interface KeputusanPortofolio {
  id: string;
  project: RujukanProyek;
  decision: string;
  summary: string;
  author: Orang | null;
  created_at: string;
  can_resolve: boolean;
}

export interface Portofolio {
  mode: 'direksi' | 'divisi';
  as_of: string;
  period_label: string;
  filters: { periode: PeriodePortofolio; divisi: string | null; status: Kesehatan | null; arsip: boolean };
  division_options: Opsi[];
  can: { steer: boolean };
  kpis: {
    active: { count: number; health: { on_track: number; at_risk: number; off_track: number; none: number } };
    upcoming_milestones: { count: number; items: { key: string; name: string; target_date: string }[] };
    missed_milestones: { count: number; items: { key: string; name: string; target_date: string }[] };
    overdue_tasks: { count: number; projects: number; total_projects: number; top: { key: string; count: number } | null };
    decisions: { count: number };
  };
  projects: BarisProyek[];
  completed: (RujukanProyek & { completed_at: string; quarter: string })[];
  decisions: KeputusanPortofolio[];
  attention: { project: RujukanProyek; lead: Orang | null; is_sponsor: boolean; health: Kesehatan | null; metrics: MetrikProyek }[];
  feed: { id: string; project: RujukanProyek; author: Orang | null; health: Kesehatan; summary: string; created_at: string }[];
  attendance: { present: number; total: number; on_leave: number; not_checked_in: number } | null;
  health_options: Opsi<Kesehatan>[];
}

// ── P2 Detail proyek ─────────────────────────────────────────────────────────

export interface MilestoneDetail {
  id: string;
  name: string;
  description: string | null;
  target_date: string;
  completed_at: string | null;
  status: StatusMilestone;
  tasks: RujukanTugas[];
}

export interface Risiko {
  id: string;
  title: string;
  level: LevelRisiko;
  status: 'open' | 'resolved';
  resolved_at: string | null;
  owner: Orang | null;
  task: RujukanTugas | null;
}

export interface TugasTerlambat extends RujukanTugas {
  due_date: string;
  assignee: Orang | null;
}

export interface KemampuanProyek {
  post_update: boolean;
  manage_milestones: boolean;
  manage_risks: boolean;
  request_update: boolean;
  give_direction: boolean;
  resolve_decision: boolean;
  view_only: boolean;
  archived: boolean;
}

export interface DetailProyek {
  project: BarisProyek & { member_divisions: string[] };
  status_counts: Record<KategoriTugas, number>;
  milestones: MilestoneDetail[];
  burnup: {
    start_date: string | null;
    target_date: string | null;
    today: string;
    points: { date: string; scope: number | null; done: number | null }[];
    initial_scope: number | null;
    recent_pace: number | null;
    required_pace: number | null;
    milestones: MilestoneRingkas[];
  };
  updates: UpdateProyek[];
  updates_total: number;
  risks: Risiko[];
  overdue_tasks: TugasTerlambat[];
  team_load: { members: { person: Orang; open: number }[]; idle: number; open_total: number };
  directions: Arahan[];
  task_options: RujukanTugas[];
  health_options: Opsi<Kesehatan>[];
  risk_level_options: Opsi<LevelRisiko>[];
  today: string;
  can: KemampuanProyek;
}

export type FilterRiwayat = 'semua' | 'keputusan' | 'arahan';

export interface RiwayatUpdate {
  filter: FilterRiwayat;
  updates: UpdateProyek[];
  next_cursor: string | null;
}

// ── Body tulis ───────────────────────────────────────────────────────────────

export interface IsianUpdate {
  health: Kesehatan;
  summary: string;
  blockers: string | null;
  decision_needed: string | null;
}

export interface IsianMilestone {
  name: string;
  target_date: string;
  description: string | null;
  task_ids?: string[];
}

export interface MilestoneTulis {
  id: string;
  name: string;
  description: string | null;
  target_date: string;
  completed_at: string | null;
  tasks: RujukanTugas[];
}

export interface IsianRisiko {
  title: string;
  level: LevelRisiko;
  owner_id: string | null;
  task_id: string | null;
  status?: 'open' | 'resolved';
}

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons server kosong.');
  }
  return nilai;
}

const k = (key: string): string => encodeURIComponent(key);

export function portofolio(filter: FilterPortofolio = {}): Promise<Portofolio> {
  return apiRequest<Portofolio>('portofolio', {
    query: { periode: filter.periode, divisi: filter.divisi ?? undefined, status: filter.status ?? undefined, arsip: filter.arsip ? 1 : undefined },
  }).then(wajib);
}

export function detailProyek(key: string): Promise<DetailProyek> {
  return apiRequest<DetailProyek>(`proyek/${k(key)}`).then(wajib);
}

export function riwayatUpdate(key: string, filter: FilterRiwayat, sebelum?: string | null): Promise<RiwayatUpdate> {
  return apiRequest<RiwayatUpdate>(`proyek/${k(key)}/update`, { query: { filter, sebelum: sebelum ?? undefined } }).then(wajib);
}

export function kirimUpdate(key: string, isian: IsianUpdate): Promise<{ message: string; update: UpdateProyek }> {
  return apiRequest<{ message: string; update: UpdateProyek }>(`proyek/${k(key)}/update`, { method: 'POST', json: isian }).then(wajib);
}

export function tandaiKeputusanSelesai(key: string, updateId: string): Promise<{ message: string; update: UpdateProyek }> {
  return apiRequest<{ message: string; update: UpdateProyek }>(`proyek/${k(key)}/update/${k(updateId)}/keputusan`, { method: 'POST' }).then(wajib);
}

export function mintaUpdate(key: string, note: string | null): Promise<{ message: string; recipient: Orang }> {
  return apiRequest<{ message: string; recipient: Orang }>(`proyek/${k(key)}/minta-update`, { method: 'POST', json: { note } }).then(wajib);
}

export function beriArahan(key: string, body: string, updateId: string | null): Promise<{ message: string; direction: Arahan }> {
  return apiRequest<{ message: string; direction: Arahan }>(`proyek/${k(key)}/arahan`, { method: 'POST', json: { body, project_update_id: updateId } }).then(wajib);
}

export function buatMilestone(key: string, isian: IsianMilestone): Promise<{ message: string; milestone: MilestoneTulis }> {
  return apiRequest<{ message: string; milestone: MilestoneTulis }>(`proyek/${k(key)}/milestone`, { method: 'POST', json: isian }).then(wajib);
}

export function ubahMilestone(key: string, id: string, isian: IsianMilestone): Promise<{ message: string; milestone: MilestoneTulis }> {
  return apiRequest<{ message: string; milestone: MilestoneTulis }>(`proyek/${k(key)}/milestone/${k(id)}`, { method: 'PATCH', json: isian }).then(wajib);
}

export function selesaiMilestone(key: string, id: string, completed: boolean): Promise<{ message: string; milestone: MilestoneTulis }> {
  return apiRequest<{ message: string; milestone: MilestoneTulis }>(`proyek/${k(key)}/milestone/${k(id)}/selesai`, { method: 'PATCH', json: { completed } }).then(wajib);
}

export async function hapusMilestone(key: string, id: string): Promise<void> {
  await apiRequest<null>(`proyek/${k(key)}/milestone/${k(id)}`, { method: 'DELETE' });
}

export function buatRisiko(key: string, isian: IsianRisiko): Promise<{ message: string; risk: Risiko }> {
  return apiRequest<{ message: string; risk: Risiko }>(`proyek/${k(key)}/risiko`, { method: 'POST', json: isian }).then(wajib);
}

export function ubahRisiko(key: string, id: string, isian: IsianRisiko): Promise<{ message: string; risk: Risiko }> {
  return apiRequest<{ message: string; risk: Risiko }>(`proyek/${k(key)}/risiko/${k(id)}`, { method: 'PATCH', json: isian }).then(wajib);
}

export function statusRisiko(key: string, id: string, status: 'open' | 'resolved'): Promise<{ message: string; risk: Risiko }> {
  return apiRequest<{ message: string; risk: Risiko }>(`proyek/${k(key)}/risiko/${k(id)}/status`, { method: 'PATCH', json: { status } }).then(wajib);
}

export async function hapusRisiko(key: string, id: string): Promise<void> {
  await apiRequest<null>(`proyek/${k(key)}/risiko/${k(id)}`, { method: 'DELETE' });
}
