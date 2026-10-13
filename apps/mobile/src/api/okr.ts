/**
 * OKR divisi (kontrak FINAL: docs/sesi/ponsel-b5a-manajemen.md §6, O1–O13;
 * flag `FEATURE_OKR`, mati → 404). Progres & kuartal dihitung server —
 * aplikasi tidak menghitung ulang rumus.
 */
import { apiRequest } from './client';
import type { KategoriTugas } from './proyek';

export type StatusOkr = 'on_track' | 'at_risk' | 'behind';
export type SatuanKr = 'number' | 'percent' | 'currency' | 'days';
export type StatusObjective = 'draft' | 'active' | 'closed';

export interface Kuartal {
  key: string;
  label: string;
  start: string;
  end: string;
  days: number;
  day: number;
  elapsed: number;
  week: number;
  weeks: number;
}

export interface ProgresKr {
  value: number;
  raw: number;
  expected: number;
  status: StatusOkr;
  status_label: string;
}

export interface ProgresObjective {
  value: number;
  expected: number;
  status: StatusOkr;
  status_label: string;
  regressed: number;
  counts: Record<StatusOkr, number>;
}

export interface TugasTertaut {
  id: string;
  key: string;
  title: string;
  status_category: KategoriTugas;
  assignee: { id: string; name: string } | null;
  due_date: string | null;
  url: string;
}

export interface CheckinKr {
  id: string;
  key_result_id: string;
  date: string;
  value: number;
  confidence: number | null;
  note: string | null;
  author: { id: string; name: string } | null;
}

export interface KeyResult {
  id: string;
  objective_id: string;
  title: string;
  unit: SatuanKr;
  unit_label: string;
  start_value: number;
  target_value: number;
  current_value: number;
  weight: number;
  owner: { id: string; name: string };
  progress: ProgresKr;
  tasks?: TugasTertaut[];
  checkins?: CheckinKr[];
  can?: { update: boolean; checkin: boolean; link_task: boolean; delete: boolean };
}

export interface Objective {
  id: string;
  company_id: string;
  division: { id: string; name: string; code: string };
  quarter: string;
  title: string;
  description: string | null;
  owner: { id: string; name: string };
  status: StatusObjective;
  created_at: string;
  updated_at: string;
  key_results?: KeyResult[];
  progress: ProgresObjective;
  can?: { update: boolean; close: boolean; add_key_result: boolean };
}

export interface Divisi {
  id: string;
  name: string;
  code: string;
}

export interface DaftarOkr {
  today: string;
  quarters: string[];
  current_quarter: string;
  filters: { quarter: string; division: string };
  divisions: Divisi[];
  quarter: Kuartal;
  kpis: { count: number; average: number | null; expected: number; on_track: number; at_risk: number; behind: number };
  objectives: Objective[];
  can: { create: boolean };
  create: { divisions: Divisi[]; people: { id: string; name: string; division_id: string | null }[]; quarters: string[] } | null;
}

export interface DetailObjective {
  today: string;
  objective: Objective;
  people: { id: string; name: string }[];
  quarters: string[];
  quarter: Kuartal;
}

export interface IsianObjective {
  division_id?: string;
  quarter: string;
  title: string;
  description: string | null;
  owner_id: string;
  status?: 'draft' | 'active';
}

export interface IsianKr {
  title: string;
  unit: SatuanKr;
  unit_label: string | null;
  start_value: number;
  target_value: number;
  current_value: number;
  weight: number;
  owner_id: string;
}

export interface HasilKr {
  message: string;
  objective: Objective;
  key_result: KeyResult;
}

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons server kosong.');
  }
  return nilai;
}

const e = encodeURIComponent;

export function daftarOkr(kuartal?: string, divisi?: string | null): Promise<DaftarOkr> {
  return apiRequest<DaftarOkr>('okr', { query: { kuartal, divisi: divisi ?? undefined } }).then(wajib);
}

export function detailObjective(id: string): Promise<DetailObjective> {
  return apiRequest<DetailObjective>(`okr/${e(id)}`).then(wajib);
}

export function detailKr(krId: string): Promise<{ objective: Objective; key_result: KeyResult }> {
  return apiRequest<{ objective: Objective; key_result: KeyResult }>(`okr/kr/${e(krId)}`).then(wajib);
}

export function buatObjective(isian: IsianObjective): Promise<DetailObjective & { message: string }> {
  return apiRequest<DetailObjective & { message: string }>('okr', { method: 'POST', json: isian }).then(wajib);
}

export function ubahObjective(id: string, isian: IsianObjective): Promise<DetailObjective & { message: string }> {
  return apiRequest<DetailObjective & { message: string }>(`okr/${e(id)}`, { method: 'PATCH', json: isian }).then(wajib);
}

export function tutupObjective(id: string): Promise<DetailObjective & { message: string }> {
  return apiRequest<DetailObjective & { message: string }>(`okr/${e(id)}/tutup`, { method: 'POST' }).then(wajib);
}

export function tambahKr(objectiveId: string, isian: IsianKr): Promise<HasilKr> {
  return apiRequest<HasilKr>(`okr/${e(objectiveId)}/kr`, { method: 'POST', json: isian }).then(wajib);
}

export function ubahKr(krId: string, isian: IsianKr): Promise<HasilKr> {
  return apiRequest<HasilKr>(`okr/kr/${e(krId)}`, { method: 'PATCH', json: isian }).then(wajib);
}

export async function hapusKr(krId: string): Promise<void> {
  await apiRequest<null>(`okr/kr/${e(krId)}`, { method: 'DELETE' });
}

export function checkinKr(krId: string, isian: { value: number; confidence: number | null; note: string | null }): Promise<HasilKr> {
  return apiRequest<HasilKr>(`okr/kr/${e(krId)}/check-in`, { method: 'POST', json: isian }).then(wajib);
}

export function tugasBisaDitautkan(krId: string, q: string): Promise<TugasTertaut[]> {
  return apiRequest<{ tasks: TugasTertaut[] }>(`okr/kr/${e(krId)}/tugas`, { query: { q: q.trim() || undefined } }).then((r) => wajib(r).tasks);
}

export function tautkanTugas(krId: string, taskId: string): Promise<{ message: string; task: TugasTertaut }> {
  return apiRequest<{ message: string; task: TugasTertaut }>(`okr/kr/${e(krId)}/tugas`, { method: 'POST', json: { task_id: taskId } }).then(wajib);
}

export async function lepasTugas(krId: string, taskId: string): Promise<void> {
  await apiRequest<null>(`okr/kr/${e(krId)}/tugas/${e(taskId)}`, { method: 'DELETE' });
}
