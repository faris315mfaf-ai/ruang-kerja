/**
 * Hiring / rekrutmen (kontrak: docs/sesi/ponsel-b5h-hiring.md, `/api/v1/hiring`).
 *
 * Data pelamar bersifat pribadi: respons server `no-store`, dan aplikasi TIDAK
 * menyimpannya ke disk (tanpa persist, tanpa cache berkas CV). Semua status
 * layar Hiring hidup di memori komponen saja.
 */
import { apiRequest } from './client';

// ── Bentuk bersama ───────────────────────────────────────────────────────────

export type TahapKandidat = 'applied' | 'screening' | 'interview' | 'assessment' | 'final_review' | 'hired' | 'rejected';
export type StatusLowongan = 'draft' | 'open' | 'closed';
export type PeranPemeriksa = 'hr' | 'interviewer' | 'approver';
export type SumberKandidat = 'google_form' | 'manual';
export type NilaiKeputusan = 'approve' | 'reject';

/** `person` = `{id, name, avatar|null, position|null}`; `active` hanya di pengaturan. */
export interface OrangHiring {
  id: string;
  name: string;
  avatar: string | null;
  position: string | null;
  active?: boolean;
}

export interface RingkasHiring {
  can_manage: boolean;
  counts: { open_positions: number; new_candidates: number; awaiting_decision: number };
}

export interface AksesHiring {
  has_access: boolean;
  can_manage: boolean;
  counts: RingkasHiring['counts'] | null;
  badge: number;
}

// ── Kandidat (daftar) ────────────────────────────────────────────────────────

export interface OpsiLowonganRingkas {
  id: string;
  title: string;
  status: StatusLowongan;
}

export interface HitunganTahap {
  value: TahapKandidat;
  label: string;
  count: number;
}

export interface KartuKandidat {
  id: string;
  full_name: string;
  email: string | null;
  position: { id: string; title: string };
  stage: TahapKandidat;
  stage_label: string;
  source: SumberKandidat;
  applied_at: string;
  has_cv: boolean;
  checklist: { done: number; total: number };
  awaiting_me: boolean;
}

export interface DaftarKandidat {
  hiring: RingkasHiring;
  positions: OpsiLowonganRingkas[];
  stages: HitunganTahap[];
  candidates: KartuKandidat[];
  truncated: boolean;
  filters: { position: string | null; q: string | null; stage: TahapKandidat | null };
  can: { manage: boolean; create_candidate: boolean; move: boolean };
}

// ── Profil kandidat ──────────────────────────────────────────────────────────

export interface DataKandidat {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  cv_url: string | null;
  attachments: { label: string; url: string }[];
  form_answers: { question: string; answer: string }[];
  stage: TahapKandidat;
  stage_label: string;
  rejected_reason: string | null;
  source: SumberKandidat;
  source_label: string;
  is_manual: boolean;
  applied_at: string;
  decided_at: string | null;
  position: { id: string; title: string; status: StatusLowongan; status_label: string; division: string | null };
}

export interface PoinSaya {
  score: number;
  note: string | null;
}

export interface PertanyaanKandidat {
  id: string;
  prompt: string;
  guidance: string | null;
  max_score: number;
  answer: string | null;
  my_score: PoinSaya | null;
  /** null untuk pewawancara (hanya poin miliknya yang terlihat). */
  scores: { interviewer: OrangHiring; score: number; note: string | null }[] | null;
  average: number | null;
}

export interface ButirChecklist {
  id: string;
  label: string;
  role: PeranPemeriksa;
  role_label: string;
  required: boolean;
  reviewer: OrangHiring | null;
  checked_at: string | null;
  checked_by: OrangHiring | null;
  note: string | null;
  can_check: boolean;
  can_delete: boolean;
  mine: boolean;
}

export interface Notulensi {
  id: string;
  body: string;
  author: OrangHiring | null;
  created_at: string;
  edited_at: string | null;
  can_edit: boolean;
}

export interface BarisKeputusan {
  approver: OrangHiring;
  decision: NilaiKeputusan | null;
  decision_label: string;
  note: string | null;
  decided_at: string | null;
}

export interface TujuanPindah {
  stage: TahapKandidat;
  label: string;
  requires_reason: boolean;
  blocked: string | null;
}

export interface RingkasanPoin {
  total: number;
  max: number;
  scored_questions: number;
  questions: number;
}

export interface ProfilKandidat {
  candidate: DataKandidat;
  questions: PertanyaanKandidat[];
  checklist: ButirChecklist[];
  notes: Notulensi[];
  decisions: BarisKeputusan[];
  reviewers: { interviewers: OrangHiring[]; approvers: OrangHiring[] };
  can: {
    manage: boolean;
    edit: boolean;
    move: boolean;
    answer: boolean;
    add_checklist: boolean;
    note: boolean;
    score: boolean;
    decide: boolean;
    see_all_scores: boolean;
    is_interviewer: boolean;
    is_approver: boolean;
  };
  blockers: { before_final: number; my_approval: number };
  my_decision: { decision: NilaiKeputusan; note: string | null; decided_at: string | null } | null;
  summary: {
    checklist: { done: number; total: number };
    score: (RingkasanPoin & { by_interviewer: { interviewer: OrangHiring; total: number; max: number; count: number }[] }) | null;
    my_score: RingkasanPoin | null;
    decisions: { approved: number; rejected: number; pending: number; total: number };
  };
  move_targets: TujuanPindah[];
}

export interface IsianKandidat {
  full_name: string;
  email: string | null;
  phone: string | null;
  cv_url: string | null;
}

// ── Lowongan ─────────────────────────────────────────────────────────────────

export interface KartuLowongan {
  id: string;
  title: string;
  status: StatusLowongan;
  status_label: string;
  division: string | null;
  description: string | null;
  opened_at: string | null;
  closed_at: string | null;
  candidates_count: number;
  open_candidates_count: number;
  hired_count: number;
  interviewers_count: number;
  approvers_count: number;
  my_roles: ('interviewer' | 'approver')[];
}

export interface DaftarLowongan {
  hiring: RingkasHiring;
  positions: KartuLowongan[];
  divisions: { id: string; name: string }[];
  can: { create: boolean };
}

export type KunciField = 'full_name' | 'email' | 'phone' | 'cv_url';

export interface PertanyaanLowongan {
  id: string;
  prompt: string;
  guidance: string | null;
  max_score: number;
  position: number;
  locked: boolean;
  can_delete: boolean;
}

export interface PengaturanLowongan {
  position: {
    id: string;
    title: string;
    division_id: string | null;
    division: string | null;
    description: string | null;
    status: StatusLowongan;
    status_label: string;
    opened_at: string | null;
    closed_at: string | null;
    interviewer_ids: string[];
    final_approver_ids: string[];
    interviewers: OrangHiring[];
    approvers: OrangHiring[];
    field_map: Partial<Record<KunciField, string | null>>;
    candidates_count: number;
  };
  questions: PertanyaanLowongan[];
  field_defaults: { field: KunciField; label: string; aliases: string[] }[];
  statuses: { value: StatusLowongan; label: string }[];
  employees: OrangHiring[];
  divisions: { id: string; name: string }[];
  google_form: { desktop_only: boolean; webhook_url: string; has_submissions: boolean; desktop_path: string };
  can: { update: boolean; delete: boolean; regenerate_webhook: boolean };
}

export interface IsianLowongan {
  title: string;
  division_id: string | null;
  description: string | null;
  status: StatusLowongan;
  interviewer_ids: string[];
  final_approver_ids: string[];
  field_map: Record<KunciField, string | null>;
}

export interface IsianPertanyaan {
  prompt: string;
  guidance: string | null;
  max_score: number;
}

// ── Pengaturan hiring ────────────────────────────────────────────────────────

export interface ButirTemplat {
  label: string;
  required: boolean;
}

export type TemplatChecklist = Record<PeranPemeriksa, ButirTemplat[]>;

export interface PengaturanHiring {
  settings: {
    default_final_approver_ids: string[];
    default_final_approvers: OrangHiring[];
    checklist_template: TemplatChecklist;
  };
  roles: { value: PeranPemeriksa; label: string }[];
  limits: { approvers: number; items_per_role: number; label: number };
  employees: OrangHiring[];
}

// ── Pemanggil ────────────────────────────────────────────────────────────────

async function wajib<T>(janji: Promise<T | null>): Promise<T> {
  const hasil = await janji;
  if (hasil === null) {
    throw new Error('Respons server kosong.');
  }
  return hasil;
}

export function aksesHiring(): Promise<AksesHiring> {
  return wajib(apiRequest<AksesHiring>('hiring/akses'));
}

export function daftarKandidat(filter: { lowongan?: string | null; q?: string | null; tahap?: TahapKandidat | null } = {}): Promise<DaftarKandidat> {
  return wajib(apiRequest<DaftarKandidat>('hiring/kandidat', { query: { lowongan: filter.lowongan, q: filter.q, tahap: filter.tahap } }));
}

export function profilKandidat(id: string): Promise<ProfilKandidat> {
  // Kontrak: `{candidate: <profil>}` (sama dengan respons POST/PATCH/tahap/keputusan).
  return wajib(apiRequest<{ candidate: ProfilKandidat }>(`hiring/kandidat/${id}`)).then((r) => r.candidate);
}

export function tambahKandidat(isian: IsianKandidat & { position_id: string }): Promise<{ message: string; candidate: ProfilKandidat }> {
  return wajib(apiRequest('hiring/kandidat', { method: 'POST', json: isian }));
}

export function ubahKandidat(id: string, isian: IsianKandidat): Promise<{ message: string; candidate: ProfilKandidat }> {
  return wajib(apiRequest(`hiring/kandidat/${id}`, { method: 'PATCH', json: isian }));
}

export function pindahTahap(id: string, stage: TahapKandidat, reason?: string | null): Promise<{ message: string; previous_stage: TahapKandidat; candidate: ProfilKandidat }> {
  return wajib(apiRequest(`hiring/kandidat/${id}/tahap`, { method: 'PUT', json: { stage, reason: reason ?? null } }));
}

export function simpanJawaban(id: string, questionId: string, answer: string | null): Promise<{ question_id: string; answer: string | null; saved_at: string | null }> {
  return wajib(apiRequest(`hiring/kandidat/${id}/jawaban/${questionId}`, { method: 'PUT', json: { answer } }));
}

export function simpanPoin(
  id: string,
  questionId: string,
  score: number | null,
  note: string | null,
): Promise<{ question_id: string; max_score: number; my_score: PoinSaya | null; saved_at: string | null }> {
  return wajib(apiRequest(`hiring/kandidat/${id}/poin/${questionId}`, { method: 'PUT', json: { score, note } }));
}

export function tambahButir(id: string, isian: { label: string; reviewer_id: string | null; required: boolean }): Promise<{ message: string; item: ButirChecklist }> {
  return wajib(apiRequest(`hiring/kandidat/${id}/checklist`, { method: 'POST', json: isian }));
}

export function setelButir(itemId: string, checked: boolean, note?: string | null): Promise<{ item: ButirChecklist }> {
  const json: Record<string, unknown> = { checked };
  if (note !== undefined) {
    json.note = note;
  }
  return wajib(apiRequest(`hiring/checklist/${itemId}`, { method: 'PATCH', json }));
}

export async function hapusButir(itemId: string): Promise<void> {
  await apiRequest(`hiring/checklist/${itemId}`, { method: 'DELETE' });
}

export function tambahNotulensi(id: string, body: string): Promise<{ message: string; note: Notulensi }> {
  return wajib(apiRequest(`hiring/kandidat/${id}/notulensi`, { method: 'POST', json: { body } }));
}

export function ubahNotulensi(noteId: string, body: string): Promise<{ message: string; note: Notulensi }> {
  return wajib(apiRequest(`hiring/notulensi/${noteId}`, { method: 'PATCH', json: { body } }));
}

export async function hapusNotulensi(noteId: string): Promise<void> {
  await apiRequest(`hiring/notulensi/${noteId}`, { method: 'DELETE' });
}

export function putuskanKandidat(
  id: string,
  decision: NilaiKeputusan,
  note: string | null,
): Promise<{ message: string; outcome: 'hired' | 'rejected' | null; candidate: ProfilKandidat }> {
  return wajib(apiRequest(`hiring/kandidat/${id}/keputusan`, { method: 'POST', json: { decision, note } }));
}

export function daftarLowongan(): Promise<DaftarLowongan> {
  return wajib(apiRequest<DaftarLowongan>('hiring/lowongan'));
}

export function buatLowongan(isian: { title: string; division_id: string | null; description: string | null }): Promise<PengaturanLowongan & { message: string }> {
  return wajib(apiRequest('hiring/lowongan', { method: 'POST', json: isian }));
}

export function pengaturanLowongan(id: string): Promise<PengaturanLowongan> {
  return wajib(apiRequest<PengaturanLowongan>(`hiring/lowongan/${id}`));
}

export function simpanLowongan(id: string, isian: IsianLowongan): Promise<PengaturanLowongan & { message: string }> {
  return wajib(apiRequest(`hiring/lowongan/${id}`, { method: 'PUT', json: isian }));
}

export async function hapusLowongan(id: string): Promise<void> {
  await apiRequest(`hiring/lowongan/${id}`, { method: 'DELETE' });
}

export function tambahPertanyaan(positionId: string, isian: IsianPertanyaan): Promise<{ message: string; question_id: string; questions: PertanyaanLowongan[] }> {
  return wajib(apiRequest(`hiring/lowongan/${positionId}/pertanyaan`, { method: 'POST', json: isian }));
}

export function ubahPertanyaan(questionId: string, isian: IsianPertanyaan): Promise<{ message: string; question_id: string; questions: PertanyaanLowongan[] }> {
  return wajib(apiRequest(`hiring/pertanyaan/${questionId}`, { method: 'PUT', json: isian }));
}

export function urutkanPertanyaan(positionId: string, ids: string[]): Promise<{ questions: PertanyaanLowongan[] }> {
  return wajib(apiRequest(`hiring/lowongan/${positionId}/urutan-pertanyaan`, { method: 'PUT', json: { ids } }));
}

export function hapusPertanyaan(questionId: string): Promise<{ message: string; questions: PertanyaanLowongan[] }> {
  return wajib(apiRequest(`hiring/pertanyaan/${questionId}`, { method: 'DELETE' }));
}

export function pengaturanHiring(): Promise<PengaturanHiring> {
  return wajib(apiRequest<PengaturanHiring>('hiring/pengaturan'));
}

export function simpanPengaturanHiring(isian: { default_final_approver_ids: string[]; checklist_template: TemplatChecklist }): Promise<PengaturanHiring & { message: string }> {
  return wajib(apiRequest('hiring/pengaturan', { method: 'PUT', json: isian }));
}
