/**
 * Laporan progres harian (kontrak FINAL: docs/sesi/ponsel-b4c-laporan.md).
 * Formulir hari ini (autosave + kirim), riwayat bulanan, detail, dan sisi
 * pembaca (laporan tim, riwayat satu orang, detail monitoring).
 */
import { apiRequest } from './client';

export type StatusLaporan = 'missing' | 'draft' | 'submitted';
export type KategoriStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'canceled';

export interface ItemLaporan {
  id: string;
  task_id: string | null;
  task_key: string | null;
  task_title: string | null;
  is_task: boolean;
  progress_note: string;
  percent: number | null;
  hours: number | null;
  move_status_id: string | null;
  status_category_after: KategoriStatus | null;
}

export interface Laporan {
  id: string | null;
  date: string;
  status: StatusLaporan;
  submitted_at: string | null;
  updated_at: string | null;
  editable: boolean;
  locked: boolean;
  summary: string | null;
  blockers: string | null;
  notes: string | null;
  items_count: number;
  hours: number | null;
  items: ItemLaporan[];
}

export interface KolomStatus {
  id: string;
  name: string;
  category: KategoriStatus;
}

export interface OpsiTugas {
  id: string;
  key: string;
  title: string;
  workspace: { id: string; key: string; name: string; type: 'personal' | 'team' | 'division' | 'project' };
  status: KolomStatus;
  due_date: string | null;
  planned_today: boolean;
  can_move: boolean;
  statuses: KolomStatus[];
}

export interface BatasLaporan {
  items: number;
  note: number;
  text: number;
}

export interface LaporanHariIniData {
  date: string;
  deadline: string;
  locked: boolean;
  scheduled: boolean;
  holiday: string | null;
  can: { edit: boolean; submit: boolean };
  report: Laporan;
  suggestions: OpsiTugas[];
  chosen: OpsiTugas[];
  limits: BatasLaporan;
}

export interface BodyItemLaporan {
  task_id: string | null;
  progress_note: string;
  percent: number | null;
  hours: number | null;
  move_status_id: string | null;
}

export interface BodyLaporan {
  report_date: string;
  summary: string | null;
  blockers: string | null;
  notes: string | null;
  items: BodyItemLaporan[];
}

export interface HasilPindah {
  task_id: string;
  task_key: string;
  moved: boolean;
  from: KolomStatus | null;
  to: KolomStatus | null;
  error: string | null;
}

export interface HasilKirim {
  report: Laporan;
  move_results: HasilPindah[];
  message: string;
}

export interface HariRiwayat {
  date: string;
  is_today: boolean;
  scheduled: boolean;
  holiday?: string | null;
  status: StatusLaporan;
  report: {
    id: string;
    submitted_at: string | null;
    updated_at: string | null;
    summary: string | null;
    has_blockers: boolean;
    items_count: number;
    hours: number | null;
    locked: boolean;
  } | null;
}

export interface RiwayatBulan {
  bulan: string;
  today: string;
  bulan_sebelumnya: string | null;
  bulan_berikutnya: string | null;
  counts: { scheduled: number; submitted: number; draft: number; missing: number };
  days: HariRiwayat[];
  hari_ini: {
    date: string;
    status: StatusLaporan;
    submitted_at: string | null;
    updated_at: string | null;
    items_count: number;
    locks_at: string;
  };
}

export interface PemilikLaporan {
  id: string;
  name: string;
  avatar: string | null;
  position: string | null;
  division: string | null;
}

export interface DetailLaporanData {
  owner: PemilikLaporan;
  mine: boolean;
  report: Laporan;
  can: { edit: boolean };
}

export interface RingkasLaporanOrang {
  id: string;
  date: string;
  status: 'submitted' | 'draft';
  submitted_at: string | null;
  summary: string | null;
  has_blockers: boolean;
  items_count: number;
  hours: number | null;
  editable: boolean;
}

export interface RiwayatOrang {
  owner: PemilikLaporan;
  mine: boolean;
  reports: RingkasLaporanOrang[];
}

export interface ItemMonitor {
  id: string;
  task_id: string | null;
  key: string | null;
  title: string | null;
  url: string | null;
  workspace: string | null;
  progress_note: string;
  percent: number | null;
  hours: number | null;
  status_category_after: KategoriStatus | null;
}

export interface PenggunaRingkas {
  id: string;
  name: string;
  avatar: string | null;
  division: string | null;
}

export interface LaporanTimItem {
  id: string;
  date: string;
  user: PenggunaRingkas;
  submitted_at: string | null;
  summary: string | null;
  blockers: string | null;
  items_count: number;
  hours: number | null;
  items: ItemMonitor[];
}

export interface TotalTim {
  people: number;
  scheduled: number;
  reported: number;
  draft: number;
  missing: number;
}

export interface LaporanTim {
  date: string;
  is_today: boolean;
  totals: TotalTim;
  divisions: ({ id: string | null; name: string } & TotalTim)[];
  missing: (PenggunaRingkas & { draft: boolean })[];
  reports: LaporanTimItem[];
}

export interface LaporanMonitor extends LaporanTimItem {
  notes: string | null;
}

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons server kosong.');
  }
  return nilai;
}

export function laporanHariIni(): Promise<LaporanHariIniData> {
  return apiRequest<LaporanHariIniData>('laporan/hari-ini').then(wajib);
}

export function simpanLaporan(body: BodyLaporan): Promise<Laporan> {
  return apiRequest<{ report: Laporan }>('laporan/hari-ini', { method: 'PUT', json: body, timeoutMs: 20_000 }).then((r) => wajib(r).report);
}

export function kirimLaporan(body: BodyLaporan): Promise<HasilKirim> {
  return apiRequest<HasilKirim>('laporan/hari-ini/kirim', { method: 'POST', json: body }).then(wajib);
}

export function cariTugasLaporan(q: string): Promise<OpsiTugas[]> {
  return apiRequest<{ tasks: OpsiTugas[] }>('laporan/cari-tugas', { query: { q } }).then((r) => wajib(r).tasks);
}

export function riwayatLaporan(bulan?: string): Promise<RiwayatBulan> {
  return apiRequest<RiwayatBulan>('laporan', { query: { bulan } }).then(wajib);
}

export function detailLaporan(id: string): Promise<DetailLaporanData> {
  return apiRequest<DetailLaporanData>(`laporan/${encodeURIComponent(id)}`).then(wajib);
}

export function riwayatOrang(userId: string): Promise<RiwayatOrang> {
  return apiRequest<RiwayatOrang>(`laporan/orang/${encodeURIComponent(userId)}`).then(wajib);
}

export function laporanTim(tanggal?: string): Promise<LaporanTim> {
  return apiRequest<LaporanTim>('laporan/tim', { query: { tanggal } }).then(wajib);
}

export function laporanMonitor(id: string): Promise<LaporanMonitor> {
  return apiRequest<{ report: LaporanMonitor }>(`monitoring/laporan/${encodeURIComponent(id)}`).then((r) => wajib(r).report);
}
