/**
 * Endpoint Bagian 2 / B2-B: beranda, pemilih tampilan, dashboard Kepala
 * Divisi & HR, briefing (menulis), cari orang, spanduk pengumuman, kinerja.
 * Kontrak: docs/sesi/ponsel-b2b-beranda.md.
 */
import { apiRequest } from './client';
import type { Briefing, EmployeeRequestRow, MeetingItem, TaskSource, TaskStatusInfo } from './types';

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons server kosong.');
  }
  return nilai;
}

// ── Bentuk bersama ───────────────────────────────────────────────────────────

export type KunciTampilan = 'saya' | 'divisi' | 'hr' | 'direksi';

export interface ItemTampilan {
  key: KunciTampilan;
  label: string;
  /** false = ada hak tetapi API-nya belum ada (Direksi → Bagian 5). */
  tersedia: boolean;
}

export type PeriodeDasbor = 'minggu' | 'bulan' | 'kuartal';

/** Nilai metrik berpembanding: persen (atau hari untuk lead time). */
export interface Banding {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  previous: number | null;
  delta: number | null;
}

export interface PeriodeInfo {
  preset: string;
  from: string;
  to: string;
  label: string;
  previous_label: string;
}

// ── Beranda saya ─────────────────────────────────────────────────────────────

export interface StatusAbsensiRingkas {
  action: 'check_in' | 'check_out' | 'done' | 'unavailable';
  status: string | null;
  statusLabel: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  locationName: string | null;
  isRemote: boolean;
  shiftName: string | null;
  start: string | null;
  startLabel: string | null;
  end: string | null;
  endLabel: string | null;
  distanceM: number | null;
  isHoliday: boolean;
}

export interface TugasBeranda {
  id: string;
  key: string;
  title: string;
  workspace: { key: string; name: string };
  status: TaskStatusInfo;
  priority: string;
  assignees: string[];
  source: TaskSource;
  assigned_by_other: boolean;
}

export interface TugasHariIniBeranda {
  today: string;
  pribadi: TugasBeranda[];
  tim: TugasBeranda[];
  semua: TugasBeranda[];
  counts: { pribadi: number; tim: number; semua: number };
}

export interface Pengumuman {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'division' | 'team';
  audience_label: string;
  author: { id: string; name: string; avatar: string | null } | null;
  published_at: string;
  expires_at: string | null;
  active: boolean;
  dismissed: boolean;
  can_delete: boolean;
}

export interface Spanduk {
  items: Pengumuman[];
  total: number;
}

export interface LaporanHariIni {
  date: string;
  status: 'missing' | 'draft' | 'submitted';
  submitted_at: string | null;
  updated_at: string | null;
  items_count: number;
  locks_at: string;
}

export interface RingkasanBeranda {
  period: PeriodeInfo;
  kpis: {
    open_tasks: { value: number; overdue: number };
    completed: Banding;
    on_time_rate: Banding;
    completion_rate: Banding;
    lead_time: Banding;
  };
  attendance: {
    attendance_discipline: Banding;
    average_lateness: Banding;
    days: { counts: { present: number; late: number; absent: number; away: number }; workdays: number };
  };
}

export interface BerandaSaya {
  server_time: string;
  today: string;
  pengguna: { id: string; name: string; is_staff_only: boolean };
  tampilan: { awal: KunciTampilan; tersedia: ItemTampilan[] };
  flags: {
    rapat: boolean;
    kinerja: boolean;
    saldo_cuti: boolean;
    briefing_catat: boolean;
    pengumuman_buat: boolean;
  };
  attendance_status: StatusAbsensiRingkas | null;
  rapat_berikutnya: MeetingItem | null;
  tugas_hari_ini: TugasHariIniBeranda | null;
  briefing_terakhir: Briefing | null;
  briefing_catat: KartuBriefing | null;
  pengumuman: Spanduk | null;
  laporan_hari_ini: LaporanHariIni | null;
  ringkasan: RingkasanBeranda | null;
  profil: { position: string | null; manager: string | null } | null;
  saldo_cuti: { type: string; remaining: number; year: number } | null;
  pengajuan_terbaru: EmployeeRequestRow[];
  bagian_gagal: string[];
}

export function beranda(periode: PeriodeDasbor = 'bulan'): Promise<BerandaSaya> {
  return apiRequest<BerandaSaya>('beranda', { query: { periode } }).then(wajib);
}

export function tampilanDasbor(): Promise<{ awal: KunciTampilan; tampilan: (ItemTampilan & { active: boolean })[] }> {
  return apiRequest<{ awal: KunciTampilan; tampilan: (ItemTampilan & { active: boolean })[] }>('dashboard/tampilan').then(wajib);
}

// ── Dashboard Kepala Divisi / HR ─────────────────────────────────────────────

export interface FilterDasbor {
  periode: string;
  dari: string | null;
  sampai: string | null;
  divisi: string | null;
  tim: string | null;
  period: PeriodeInfo;
  presets: { value: string; label: string }[];
  divisions: { id: string; name: string }[];
  teams: { id: string; name: string; division_id: string }[];
}

export interface KepalaDasbor {
  view: 'divisi' | 'hr';
  filters: FilterDasbor;
  scope: { label: string; member_count: number };
}

export interface HitungKehadiran {
  scheduled: number;
  present: number;
  late: number;
  away: number;
  not_checked_in: number;
  absent: number;
  leave: number;
  permit: number;
  sick: number;
  business_trip: number;
}

export type KeadaanOrang = 'present' | 'late' | 'away' | 'not_checked_in' | 'absent';

export interface OrangHadir {
  user: { id: string; name: string; avatar: string | null; division_id: string | null; division: string | null };
  state: KeadaanOrang;
  status: string | null;
  status_label: string | null;
  late_minutes: number;
  check_in_at: string | null;
  request_type: string | null;
  is_suspicious: boolean;
}

export interface KehadiranDivisi {
  date: string;
  counts: HitungKehadiran;
  shifts: { name: string; count: number }[];
  people: OrangHadir[];
}

export interface LaporanTim {
  date: string;
  totals: { people: number; scheduled: number; reported: number; draft: number; missing: number };
  missing: { id: string; name: string; avatar: string | null; division: string | null; draft: boolean }[];
  reports: {
    id: string;
    user: { id: string; name: string; avatar: string | null; division: string | null };
    submitted_at: string | null;
    items_count: number;
    has_blockers: boolean;
  }[];
}

export interface TugasTerlambat {
  id: string;
  key: string;
  title: string;
  workspace: string;
  priority: number;
  due_date: string | null;
  days_late: number;
  assignees: { id: string; name: string }[];
}

export interface MetrikDivisi {
  period: PeriodeInfo;
  kpis: {
    completion_rate: Banding;
    on_time_rate: Banding;
    overdue_tasks: { value: number; people: number; top_person: number };
    lead_time: Banding;
    attendance_discipline: Banding;
    average_lateness: Banding;
  };
  trend: { week_start: string; label: string; value: number | null; numerator: number; denominator: number }[];
  workload: { user: { id: string; name: string; avatar: string | null }; open: number; overdue: number; estimate_hours: number | null }[];
  overdue: { total: number; items: TugasTerlambat[] };
  projects: {
    id: string;
    key: string;
    name: string;
    health: string | null;
    health_label: string | null;
    last_update_at: string | null;
    stale: boolean;
    target_date: string | null;
    lead: string | null;
  }[];
}

export interface DasborDivisi extends KepalaDasbor {
  attendance?: KehadiranDivisi;
  approvals?: { count: number; items: EmployeeRequestRow[] };
  reports?: LaporanTim;
  metrics?: MetrikDivisi;
}

export interface FilterQuery {
  periode?: string;
  divisi?: string | null;
  tim?: string | null;
}

export function dasborDivisi(bagian: 'semua' | 'langsung' | 'metrik', filter: FilterQuery): Promise<DasborDivisi> {
  return apiRequest<DasborDivisi>('dashboard/divisi', {
    query: { bagian, periode: filter.periode ?? null, divisi: filter.divisi ?? null, tim: filter.tim ?? null },
  }).then(wajib);
}

export interface RingkasanAbsensiHr {
  date: string;
  counts: HitungKehadiran;
  shifts: { name: string; count: number }[];
  review_count: number;
  missing_check_out_count: number;
}

export interface DasborHr extends KepalaDasbor {
  attendance: RingkasanAbsensiHr;
  pending: { count: number; items: EmployeeRequestRow[] };
  hiring: { tersedia: boolean };
  briefing: KartuBriefing | null;
  pengumuman: Spanduk | null;
}

export function dasborHr(filter: FilterQuery): Promise<DasborHr> {
  return apiRequest<DasborHr>('dashboard/hr', {
    query: { periode: filter.periode ?? null, divisi: filter.divisi ?? null, tim: filter.tim ?? null },
  }).then(wajib);
}

// ── Briefing (menulis) ───────────────────────────────────────────────────────

export type PeriodeBriefing = 'pagi' | 'sore';

export interface BriefingTersimpan {
  id: string;
  date: string;
  period: PeriodeBriefing;
  title: string;
  content: string;
  saved_by: { id: string; name: string };
  delegated_from: { id: string; name: string } | null;
  saved_at: string;
}

export interface KartuBriefing {
  date: string;
  date_label: string;
  is_recorder: boolean;
  current: PeriodeBriefing | null;
  can_record: boolean;
  periods: { value: PeriodeBriefing; label: string; starts_at: string; ends_at: string; status: 'before' | 'open' | 'after' }[];
  delegations: Partial<Record<PeriodeBriefing, { to: { id: string; name: string }; by: { id: string; name: string } }>>;
  saved: Record<PeriodeBriefing, BriefingTersimpan | null>;
  latest: Record<PeriodeBriefing, BriefingTersimpan | null>;
}

export function briefingJendela(): Promise<{ jendela: KartuBriefing | null; can_delegate: boolean }> {
  return apiRequest<{ jendela: KartuBriefing | null; can_delegate: boolean }>('briefing/jendela').then(wajib);
}

export function simpanBriefing(
  period: PeriodeBriefing,
  content: string,
): Promise<{ message: string; created: boolean; briefing: { id: string; period: string; label: string; date: string; content: string; oleh: string; updated_at: string } }> {
  return apiRequest<{ message: string; created: boolean; briefing: { id: string; period: string; label: string; date: string; content: string; oleh: string; updated_at: string } }>('briefing', {
    method: 'POST',
    json: { period, content },
  }).then(wajib);
}

export function delegasiBriefing(userId: string, period: PeriodeBriefing): Promise<{ message: string; delegation: { date: string; period: string; to: { id: string; name: string }; by: { id: string; name: string } } }> {
  return apiRequest<{ message: string; delegation: { date: string; period: string; to: { id: string; name: string }; by: { id: string; name: string } } }>('briefing/delegasi', {
    method: 'POST',
    json: { user_id: userId, period },
  }).then(wajib);
}

export interface OrangRingkas {
  id: string;
  name: string;
  initials: string;
  avatar: string | null;
  position: string | null;
  division: string | null;
}

/** GET /orang?q= — maks. 20 karyawan aktif dalam cakupan pencarian. */
export function cariOrang(q: string): Promise<OrangRingkas[]> {
  return apiRequest<{ orang: OrangRingkas[] }>('orang', { query: { q } }).then((r) => wajib(r).orang);
}

// ── Pengumuman (spanduk) ─────────────────────────────────────────────────────

export function spandukPengumuman(): Promise<Spanduk> {
  return apiRequest<Spanduk>('pengumuman/spanduk').then(wajib);
}

/** POST /pengumuman/{id}/tutup — menutup spanduk untuk diri sendiri (204). */
export function tutupPengumuman(id: string): Promise<null> {
  return apiRequest<null>(`pengumuman/${id}/tutup`, { method: 'POST' });
}

// ── Kinerja ──────────────────────────────────────────────────────────────────

export interface Kinerja {
  person: { id: string; name: string; title: string | null; is_self: boolean };
  period: string;
  period_label: string;
  counts: {
    label: string;
    due: number;
    done_of_due: number;
    done_with_due: number;
    on_time: number;
    lead_time: number | null;
    lead_time_samples: number;
    division_lead_time: number | null;
    scheduled_days: number;
    on_time_days: number;
    attendance_label: string;
  };
  weeks: { week_start: string; on_time: number; late: number }[];
  by_workspace: { workspace: { id: string; key: string; name: string; color: string | null } | null; done: number }[];
  overdue: { key: string; title: string; due_date: string | null; url: string }[];
  overdue_count: number;
  attendance: { label: string; on_time_rate: number | null; average_check_in: string | null };
}

export function kinerja(periode: PeriodeDasbor, userId?: string | null): Promise<Kinerja> {
  const path = userId ? `kinerja/${userId}` : 'kinerja';
  return apiRequest<{ periode: string; kinerja: Kinerja }>(path, { query: { periode } }).then((r) => wajib(r).kinerja);
}
