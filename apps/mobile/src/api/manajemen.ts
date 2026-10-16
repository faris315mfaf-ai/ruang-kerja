/**
 * Dashboard Manajemen, catatan tindakan, dan monitoring kerja Direksi
 * (kontrak FINAL: docs/sesi/ponsel-b5a-manajemen.md §4, §5, §7 — M1–M5,
 * N1–N6, D1–D4). Detail laporan monitoring memakai `laporanMonitor` (B4-C)
 * di `@/api/laporan`.
 */
import { apiRequest } from './client';
import type { LaporanTimItem, TotalTim, PenggunaRingkas } from './laporan';
import type { BarisProyek, Kesehatan, Orang, PenandaSistem } from './proyek';
import type { MeetingItem } from './types';

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons server kosong.');
  }
  return nilai;
}

// ── Catatan tindakan (N1–N6) ─────────────────────────────────────────────────

export interface CatatanTindakan {
  id: string;
  body: string;
  due_on: string | null;
  done: boolean;
  done_at: string | null;
  overdue: boolean;
  created_at: string;
}

export function daftarCatatanTindakan(): Promise<{ notes: CatatanTindakan[]; limit: number }> {
  return apiRequest<{ notes: CatatanTindakan[]; limit: number }>('catatan-tindakan').then(wajib);
}

export function buatCatatanTindakan(body: string, dueOn: string | null): Promise<CatatanTindakan> {
  return apiRequest<{ note: CatatanTindakan }>('catatan-tindakan', { method: 'POST', json: { body, due_on: dueOn } }).then((r) => wajib(r).note);
}

export function ubahCatatanTindakan(id: string, isian: { body?: string; due_on?: string | null; done?: boolean }): Promise<CatatanTindakan> {
  return apiRequest<{ note: CatatanTindakan }>(`catatan-tindakan/${encodeURIComponent(id)}`, { method: 'PATCH', json: isian }).then((r) => wajib(r).note);
}

export function pindahCatatanTindakan(id: string, arah: 'naik' | 'turun'): Promise<CatatanTindakan[]> {
  return apiRequest<{ notes: CatatanTindakan[] }>(`catatan-tindakan/${encodeURIComponent(id)}/pindah`, { method: 'POST', json: { arah } }).then((r) => wajib(r).notes);
}

export async function hapusCatatanTindakan(id: string): Promise<void> {
  await apiRequest<null>(`catatan-tindakan/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ── Dashboard Manajemen (M1–M5) ──────────────────────────────────────────────

export type BarisAgenda = MeetingItem;

export interface ManajemenInti {
  company: string;
  today: string;
  can: { portfolio: boolean; notes: boolean; schedule: boolean };
  notes: CatatanTindakan[];
  schedule: BarisAgenda[];
}

export interface Rentang {
  from: string;
  to: string;
  label: string;
}

export interface KolomGrafik {
  key: string;
  label: string;
  full_label: string;
  planned: number;
  done: number;
}

export interface RasioTugas {
  done: number;
  planned: number;
  rate: number | null;
}

export interface PeriodeHarian {
  range: Rentang;
  attendance: { kind: 'today'; present: number; scheduled: number; rate: number | null; late: number; not_checked_in: number };
  tasks: RasioTugas;
  overdue: { count: number; top_division: { name: string; count: number } | null } | null;
  on_time: null;
  chart: KolomGrafik[];
}

export interface TepatWaktu {
  value: number | null;
  numerator: number;
  denominator: number;
  previous: number | null;
  delta: number | null;
  previous_range: Rentang;
}

export interface PeriodeRata {
  range: Rentang;
  attendance: { kind: 'average'; attended: number; scheduled: number; rate: number | null };
  tasks: RasioTugas;
  overdue: null;
  on_time: TepatWaktu | null;
  chart: KolomGrafik[];
}

export interface RingkasanManajemen {
  generated_at: string;
  attendance: {
    date: string;
    counts: { scheduled: number; present: number; on_time: number; late: number; away: number; not_checked_in: number; absent: number };
    divisions: { id: string; name: string; scheduled: number; present: number }[];
  };
  periods: { harian: PeriodeHarian; mingguan: PeriodeRata; bulanan: PeriodeRata };
}

export interface ProyekManajemen {
  generated_at: string;
  total: number;
  projects: {
    id: string;
    key: string;
    name: string;
    color: string | null;
    url: string;
    division: string | null;
    lead: string | null;
    health: Kesehatan | null;
    actual: number | null;
    planned: number | null;
    flags: PenandaSistem[];
    attention: boolean;
    milestone: { name: string; target_date: string; missed: boolean; days_left: number | null } | null;
  }[];
  attention: { count: number; items: { key: string; name: string; reason: string }[] };
  milestones: {
    month: string;
    from: string;
    to: string;
    done: number;
    total: number;
    items: { id: string; name: string; target_date: string; project: { key: string; name: string; url: string }; state: 'done' | 'missed' | 'next' | 'todo' }[];
  };
}

export interface BebanKerja {
  total: { open: number; overdue: number; people: number };
  divisions: {
    id: string | null;
    name: string;
    open: number;
    overdue: number;
    estimate_hours: number | null;
    people: { user: Orang; open: number; overdue: number; estimate_hours: number | null }[];
  }[];
}

export function manajemen(): Promise<ManajemenInti> {
  return apiRequest<ManajemenInti>('manajemen').then(wajib);
}

export function ringkasanManajemen(): Promise<RingkasanManajemen> {
  return apiRequest<RingkasanManajemen>('manajemen/ringkasan').then(wajib);
}

export function proyekManajemen(): Promise<ProyekManajemen> {
  return apiRequest<ProyekManajemen>('manajemen/proyek').then(wajib);
}

export function bebanKerja(): Promise<BebanKerja> {
  return apiRequest<BebanKerja>('manajemen/beban-kerja').then(wajib);
}

export function jadwalTerdekat(): Promise<BarisAgenda[]> {
  return apiRequest<{ schedule: BarisAgenda[] }>('manajemen/jadwal-terdekat').then((r) => wajib(r).schedule);
}

// ── Monitoring Direksi (D1–D4) ───────────────────────────────────────────────

export interface MonitorHarian {
  today: string;
  date: string;
  daily: {
    date: string;
    is_today: boolean;
    totals: TotalTim;
    divisions: ({ id: string | null; name: string } & TotalTim)[];
    missing: (PenggunaRingkas & { draft: boolean })[];
    reports: LaporanTimItem[];
  };
}

export type StatusSel = 'reported' | 'draft' | 'missing' | 'off' | 'future';

export interface MonitorMingguan {
  today: string;
  week: string;
  weekly: {
    week: { start: string; end: string; label: string; is_current: boolean; previous: string | null; next: string | null };
    days: { date: string; label: string; is_today: boolean; is_future: boolean }[];
    totals: { expected: number; reported: number; hours: number | null; people_reported: number };
    divisions: {
      id: string | null;
      name: string;
      expected: number;
      reported: number;
      people: {
        user: Orang;
        reported_days: number;
        scheduled_days: number;
        hours: number | null;
        days: { date: string; state: StatusSel; items: number; hours: number | null; report_id: string | null }[];
      }[];
    }[];
    top_tasks: { task_id: string; key: string; title: string | null; url: string | null; workspace: string | null; mentions: number; people: number; hours: number | null; last_percent: number | null }[];
    blockers: { report_id: string; date: string; user: PenggunaRingkas; text: string }[];
  };
}

export interface MonitorProyek {
  today: string;
  week: string;
  projects: { total: number; projects: (BarisProyek & { url: string; week: { reports: number; people: number; tasks: number; hours: number | null } })[] };
}

export type JenisWorkspace = 'project' | 'division' | 'team';

export interface AksesWorkspace {
  filters: { q: string | null; jenis: JenisWorkspace | null };
  workspaces: {
    id: string;
    key: string;
    name: string;
    type: JenisWorkspace;
    type_label: string;
    color: string | null;
    url: string;
    members_count: number;
    open_tasks_count: number;
    view_only: boolean;
    health: Kesehatan | null;
  }[];
}

export function monitorHarian(tanggal?: string): Promise<MonitorHarian> {
  return apiRequest<MonitorHarian>('monitoring/harian', { query: { tanggal } }).then(wajib);
}

export function monitorMingguan(minggu?: string): Promise<MonitorMingguan> {
  return apiRequest<MonitorMingguan>('monitoring/mingguan', { query: { minggu } }).then(wajib);
}

export function monitorProyek(minggu?: string): Promise<MonitorProyek> {
  return apiRequest<MonitorProyek>('monitoring/proyek', { query: { minggu } }).then(wajib);
}

export function aksesWorkspace(q: string, jenis: JenisWorkspace | null): Promise<AksesWorkspace> {
  return apiRequest<AksesWorkspace>('monitoring/workspace', { query: { q: q.trim() || undefined, jenis: jenis ?? undefined } }).then(wajib);
}
