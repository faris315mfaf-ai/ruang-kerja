/**
 * HR & admin (Bagian 5, B5-B): karyawan, permintaan reset sandi, struktur
 * organisasi, absensi tim (hari ini, perlu ditinjau, selfie, koreksi, rekap,
 * kedisiplinan) dan saldo cuti. Kontrak: docs/sesi/ponsel-b5b-hr.md.
 *
 * Blok dari presenter web dikirim apa adanya (sebagian camelCase); kunci
 * tingkat atas buatan API memakai snake_case. Tidak ada cache disk di modul
 * ini — layar memakai cadangan dalam memori saja.
 */
import * as SecureStore from 'expo-secure-store';

import { API_URL, ApiError, apiRequest } from './client';
import type { AttendanceLog, PageMeta, RecapDayCell } from './types';

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new ApiError({ status: 500, message: 'Respons server kosong. Coba lagi.' });
  }
  return nilai;
}

// ── Umum ─────────────────────────────────────────────────────────────────────

export interface Opsi<V extends string = string> {
  value: V;
  label: string;
}

export interface RujukanId {
  id: string;
  name: string;
}

// ── 1. Karyawan ──────────────────────────────────────────────────────────────

export type StatusKaryawan = 'active' | 'inactive' | 'resigned';
export type KodePeranHr = 'super_admin' | 'direksi' | 'hr' | 'kepala_divisi' | 'anggota';
export type UrutKaryawan = 'name' | 'division' | 'position' | 'manager' | 'work_mode' | 'joined_at' | 'status';

export interface BarisKaryawan {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  division: { id: string; name: string; code: string | null } | null;
  team: RujukanId | null;
  position: RujukanId | null;
  manager: { id: string; name: string; avatar_url: string | null } | null;
  work_mode: string | null;
  roles: string[];
  status: StatusKaryawan;
  joined_at: string | null;
  can: { update: boolean; deactivate: boolean };
}

export interface FilterKaryawan {
  search?: string | null;
  division?: string | null;
  status?: StatusKaryawan | null;
  role?: KodePeranHr | null;
  sort?: UrutKaryawan | null;
  direction?: 'asc' | 'desc' | null;
  per_page?: number | null;
  page?: number | null;
}

export interface DaftarKaryawan {
  employees: BarisKaryawan[];
  meta: PageMeta;
  filters: {
    search: string | null;
    division: string | null;
    role: string | null;
    status: string | null;
    sort: UrutKaryawan;
    direction: 'asc' | 'desc';
    per_page: number;
  };
  counts: { active: number; inactive: number };
  divisions: { id: string; name: string; code: string | null; count: number }[];
  options: {
    roles: Opsi<KodePeranHr>[];
    statuses: Opsi<StatusKaryawan>[];
    work_modes: Opsi[];
    sorts: UrutKaryawan[];
    per_page: number[];
  };
  /** null = penonton tidak berhak memutus permintaan (Direksi, Kadiv). */
  password_resets_pending: number | null;
  can: { manage: boolean; decide_password_resets: boolean };
  web_path: string;
}

export function daftarKaryawan(filter: FilterKaryawan = {}): Promise<DaftarKaryawan> {
  return apiRequest<DaftarKaryawan>('admin/karyawan', { query: { ...filter } }).then(wajib);
}

export interface PermintaanReset {
  id: string;
  employee: { id: string; name: string; email: string; avatar_url: string | null };
  requested_at: string;
  expires_at: string;
  ip: string | null;
  privileged_account?: boolean;
  can?: { decide: boolean };
}

export interface ProfilKaryawan extends BarisKaryawan {
  manager: { id: string; name: string; avatar_url: string | null; position: string | null } | null;
  division_head: RujukanId | null;
  team_lead: RujukanId | null;
  last_login_at: string | null;
  deactivated_at: string | null;
  employee_number: string | null;
  phone: string | null;
  /** null = penonton tanpa `employees.manage` (Direksi, Kadiv). Tidak pernah utuh. */
  nik_masked: string | null;
  has_password: boolean | null;
  password_change_required: boolean | null;
}

export interface AuditKaryawan {
  id: string;
  action: string;
  actor: string | null;
  fields: string[];
  reason: string | null;
  created_at: string;
}

export interface DetailKaryawan {
  employee: ProfilKaryawan;
  direct_reports: { id: string; name: string; avatar_url: string | null; position: string | null; status: StatusKaryawan }[];
  /** null bila penonton tidak `employees.manage`. */
  audit: AuditKaryawan[] | null;
  password_reset: PermintaanReset | null;
  /** Pesan aturan R-06 (akun Direksi/HR/Super Admin) pengganti banner desktop. */
  password_rule: string | null;
  can: { manage: boolean; update: boolean; deactivate: boolean; set_password: boolean; decide_password_reset: boolean; view_attendance: boolean };
  web_path: string;
}

export function detailKaryawan(id: string): Promise<DetailKaryawan> {
  return apiRequest<DetailKaryawan>(`admin/karyawan/${id}`).then(wajib);
}

// ── 2. Permintaan reset kata sandi ───────────────────────────────────────────

export interface DaftarPermintaanReset {
  requests: PermintaanReset[];
  total: number;
}

export interface HasilKeputusanReset {
  message: string;
  request: { id: string; status: 'approved' | 'rejected'; decided_at: string | null; setup_expires_at: string | null };
}

export function daftarPermintaanReset(): Promise<DaftarPermintaanReset> {
  return apiRequest<DaftarPermintaanReset>('admin/permintaan-sandi').then(wajib);
}

export function setujuiReset(id: string): Promise<HasilKeputusanReset> {
  return apiRequest<HasilKeputusanReset>(`admin/permintaan-sandi/${id}/setujui`, { method: 'POST' }).then(wajib);
}

export function tolakReset(id: string, reason: string): Promise<HasilKeputusanReset> {
  return apiRequest<HasilKeputusanReset>(`admin/permintaan-sandi/${id}/tolak`, { method: 'POST', json: { reason } }).then(wajib);
}

// ── 3. Struktur organisasi ───────────────────────────────────────────────────

export interface OrangStruktur {
  id: string;
  name: string;
  avatar: string | null;
  position: string | null;
  level: number | null;
  managerId: string | null;
  roles: string[];
}

export interface TimStruktur {
  id: string;
  name: string;
  code: string | null;
  lead: OrangStruktur | null;
  members: OrangStruktur[];
  size: number;
}

export interface UnitStruktur {
  id: string;
  name: string;
  code: string | null;
  isBoard: boolean;
  head: OrangStruktur | null;
  teams: TimStruktur[];
  members: OrangStruktur[];
  size: number;
  children: UnitStruktur[];
}

export interface StrukturOrganisasi {
  chart: {
    companyName: string;
    board: UnitStruktur | null;
    divisions: UnitStruktur[];
    unassigned: OrangStruktur[];
    stats: { divisions: number; teams: number; people: number };
  };
  can: { manage_employees: boolean; manage_organization: boolean; png_export: boolean };
  web_path: string;
}

export function strukturOrganisasi(): Promise<StrukturOrganisasi> {
  return apiRequest<StrukturOrganisasi>('organisasi/struktur').then(wajib);
}

// ── 4. Absensi tim ───────────────────────────────────────────────────────────

export type KeadaanOrang = 'on_time' | 'late' | 'leave' | 'not_checked_in';

export interface OrangPapan {
  id: string;
  name: string;
  initials: string;
  divisionId: string | null;
  divisionName: string | null;
  locationId: string | null;
  locationName: string | null;
  shiftName: string | null;
  scheduled: boolean;
  state: KeadaanOrang;
  status: string | null;
  statusLabel: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  method: string | null;
  isSuspicious: boolean;
}

export interface DivisiPapan {
  id: string | null;
  name: string;
  scheduled: number;
  onTime: number;
  late: number;
  onLeave: number;
  notCheckedIn: number;
}

export interface PenandaLog {
  value: string;
  label: string;
}

export interface TemuanLog {
  id: string;
  userId: string;
  name: string;
  initials: string;
  divisionName: string | null;
  type: 'check_in' | 'check_out';
  typeLabel: string;
  method: string;
  methodLabel: string;
  occurredAt: string | null;
  clientTime: string | null;
  locationName: string | null;
  radiusM: number | null;
  accuracyM: number | null;
  distanceM: number | null;
  note: string | null;
  flags: PenandaLog[];
  hasSelfie: boolean;
  canViewSelfie: boolean;
  canReview: boolean;
}

export interface LupaCheckOut {
  dayId: string;
  userId: string;
  name: string;
  initials: string;
  workDate: string;
  shiftName: string | null;
  locationName: string | null;
  checkInAt: string | null;
}

export interface PapanHariIni {
  filters: { lokasi: string | null };
  locations: RujukanId[];
  divisions: RujukanId[];
  board: {
    date: string;
    generatedAt: string;
    summary: {
      scheduled: number;
      shifts: { name: string; count: number }[];
      present: number;
      late: number;
      onLeave: number;
      leaveBreakdown: { status: string; label: string; count: number }[];
      notCheckedIn: number;
    };
    divisions: DivisiPapan[];
    people: OrangPapan[];
  };
  suspicious: { total: number; items: TemuanLog[] };
  missing_check_out: LupaCheckOut[];
  can: { correct: boolean; review: boolean };
  poll_seconds: number;
  web_path: string;
}

export function papanHariIni(lokasi?: string | null): Promise<PapanHariIni> {
  return apiRequest<PapanHariIni>('absensi/tim/hari-ini', { query: { lokasi } }).then(wajib);
}

export interface DaftarTemuan {
  items: TemuanLog[];
  meta: PageMeta;
}

export function perluDitinjau(page = 1): Promise<DaftarTemuan> {
  return apiRequest<DaftarTemuan>('absensi/tim/perlu-ditinjau', { query: { page } }).then(wajib);
}

export function tandaiDitinjau(logId: string): Promise<{ message: string; log: { id: string; reviewed_at: string | null; reviewed_by: RujukanId | null } }> {
  return apiRequest<{ message: string; log: { id: string; reviewed_at: string | null; reviewed_by: RujukanId | null } }>(`absensi/log/${logId}/tinjau`, { method: 'POST' }).then(wajib);
}

/** Tautan selfie bertanda tangan (5 menit). 404 = sudah dihapus retensi. */
export function tautanSelfie(logId: string): Promise<{ url: string; expires_at: string }> {
  return apiRequest<{ url: string; expires_at: string }>(`absensi/log/${logId}/selfie-url`).then(wajib);
}

/**
 * Ambil gambar selfie dari tautan bertanda tangan (dengan Bearer) sebagai
 * data URI di memori — tidak melewati cache gambar/disk. Setiap pengambilan
 * diaudit server (`selfie.viewed`).
 */
async function tokenSesi(): Promise<string | null> {
  try {
    const mentah = await SecureStore.getItemAsync('rk.sesi');
    return mentah ? ((JSON.parse(mentah) as { token?: string }).token ?? null) : null;
  } catch {
    return null;
  }
}

export async function ambilGambarSelfie(url: string): Promise<string> {
  if (!url.startsWith(API_URL)) {
    throw new ApiError({ status: 403, message: 'Tautan selfie tidak dikenal.' });
  }
  const token = await tokenSesi();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'image/jpeg', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError({ status: 0, message: 'Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.' });
  }
  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      message: res.status === 403 ? 'Tautan selfie sudah tidak berlaku atau Anda tidak berhak melihatnya.' : res.status === 404 ? 'Selfie sudah dihapus sesuai masa retensi.' : 'Selfie gagal dimuat. Coba lagi.',
    });
  }
  const blob = await res.blob();
  return await new Promise<string>((selesai, gagal) => {
    const pembaca = new FileReader();
    pembaca.onload = () => (typeof pembaca.result === 'string' ? selesai(pembaca.result) : gagal(new ApiError({ status: 500, message: 'Selfie gagal dibaca.' })));
    pembaca.onerror = () => gagal(new ApiError({ status: 500, message: 'Selfie gagal dibaca.' }));
    pembaca.readAsDataURL(blob);
  });
}

export interface LogKoreksi extends AttendanceLog {
  methodLabel: string;
}

export interface HariKoreksi {
  id: string;
  workDate: string;
  status: string;
  statusLabel: string;
  shiftName: string | null;
  hours: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number;
  isSuspicious: boolean;
  checkIn: LogKoreksi | null;
  checkOut: LogKoreksi | null;
}

export interface IsianKoreksi {
  user_id: string;
  work_date: string;
  check_in?: string | null;
  check_out?: string | null;
  reason: string;
}

export function koreksiManual(isian: IsianKoreksi): Promise<{ message: string; day: HariKoreksi }> {
  const json: Record<string, string> = { user_id: isian.user_id, work_date: isian.work_date, reason: isian.reason };
  if (isian.check_in) json.check_in = isian.check_in;
  if (isian.check_out) json.check_out = isian.check_out;
  return apiRequest<{ message: string; day: HariKoreksi }>('absensi/koreksi', { method: 'POST', json }).then(wajib);
}

export interface PeriodeRekap {
  month: string;
  label: string;
  start: string;
  end: string;
  countedUntil: string | null;
  isRunning: boolean;
  previous: string;
  next: string;
}

export interface BarisRekap {
  userId: string;
  name: string;
  initials: string;
  divisionName: string | null;
  positionName: string | null;
  shiftName: string | null;
  workDays: number;
  presentDays: number;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveCount: number;
  absentDays: number;
  leaveDays: number;
  permitDays: number;
  sickDays: number;
  businessTripDays: number;
  wfhDays: number;
  needsCorrectionDays: number;
  offDays: number;
  overtimeHours: number;
  attendanceRate: number | null;
  averageCheckIn: string | null;
  suspiciousDays: number;
}

export interface RekapBulanan {
  period: PeriodeRekap;
  filters: { bulan: string; divisi: string | null; q: string | null };
  divisions: RujukanId[];
  report: {
    summary: { employees: number; calendarWorkDays: number; weekendDays: number; holidayDays: number; attendanceRate: number | null; lateCount: number; overtimeHours: number; lateToleranceMin: number };
    rows: BarisRekap[];
  };
  generated_at: string;
  can: { export: boolean; correct: boolean };
  web_path: string;
}

export function rekapBulanan(param: { bulan?: string | null; divisi?: string | null; q?: string | null } = {}): Promise<RekapBulanan> {
  return apiRequest<RekapBulanan>('absensi/tim/rekap', { query: { ...param } }).then(wajib);
}

export interface LogRekap extends AttendanceLog {
  typeLabel: string;
  accuracyM: number | null;
  flags: PenandaLog[];
  reviewedAt: string | null;
  isCorrection: boolean;
  hasSelfie: boolean;
  canViewSelfie: boolean;
  canReview: boolean;
}

export interface DetailRekap {
  period: PeriodeRekap;
  detail: BarisRekap & { days: RecapDayCell[]; logs: LogRekap[] };
  can: { export: boolean; correct: boolean };
}

export function rekapKaryawan(userId: string, bulan?: string | null): Promise<DetailRekap> {
  return apiRequest<DetailRekap>(`absensi/tim/rekap/${userId}`, { query: { bulan } }).then(wajib);
}

export type PresetPeriode = 'minggu' | 'bulan' | 'kuartal' | 'kustom';

export interface NilaiKpi {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  previous: number | null;
  delta: number | null;
}

export type KunciKpi = 'attendance_discipline' | 'average_lateness' | 'absent_days' | 'late_days' | 'completion_rate' | 'lead_time';

export interface OrangKedisiplinan {
  user: { id: string; name: string; avatar: string | null; division: string | null };
  scheduled: number;
  on_time: number;
  discipline: number | null;
  late_days: number;
  average_late: number | null;
  absent_days: number;
}

export interface LaporanKedisiplinan {
  filters: {
    periode: PresetPeriode;
    dari: string | null;
    sampai: string | null;
    divisi: string | null;
    tim: string | null;
    period: { preset: string; from: string; to: string; label: string; previous_label: string | null };
    presets: Opsi<PresetPeriode>[];
    divisions: RujukanId[];
    teams: RujukanId[];
  };
  scope: { label: string; member_count: number };
  definitions: Record<string, { label: string; definition: string; unit: string }>;
  report: {
    kpis: Partial<Record<KunciKpi, NilaiKpi>>;
    trend: { week_start: string; label: string; value: number | null; numerator: number; denominator: number }[];
    people: OrangKedisiplinan[];
  };
  web_path: string;
}

export function kedisiplinan(param: { periode?: PresetPeriode | null; divisi?: string | null } = {}): Promise<LaporanKedisiplinan> {
  return apiRequest<LaporanKedisiplinan>('absensi/tim/kedisiplinan', { query: { ...param } }).then(wajib);
}

// ── 5. Saldo cuti ────────────────────────────────────────────────────────────

export interface RingkasSaldo {
  id: string;
  year: number;
  entitled: number;
  carried_over: number;
  opening: number;
  adjustments: number;
  used: number;
  pending: number;
  total: number;
  available: number;
  remaining: number;
}

export interface JenisCutiHr {
  id: string;
  code: string;
  name: string;
  category: string;
  category_label: string;
  annual_quota_days: number | null;
}

export interface BarisSaldo {
  user: { id: string; name: string; avatar: string | null; position: string | null; division: string | null };
  eligible: boolean;
  balance: RingkasSaldo | null;
  prorated: boolean;
  joined_at: string | null;
  can: { adjust: boolean };
}

export interface DaftarSaldo {
  types: JenisCutiHr[];
  type: JenisCutiHr | null;
  year: number;
  years: number[];
  search: string;
  rows: BarisSaldo[];
  web_path: string;
}

export function daftarSaldo(param: { jenis?: string | null; tahun?: number | null; cari?: string | null } = {}): Promise<DaftarSaldo> {
  return apiRequest<DaftarSaldo>('admin/saldo-cuti', { query: { ...param } }).then(wajib);
}

export interface RiwayatSaldo {
  balance: RingkasSaldo;
  items: { id: string; delta_days: number; reason: string; actor: string | null; created_at: string }[];
}

export function riwayatSaldo(balanceId: string): Promise<RiwayatSaldo> {
  return apiRequest<RiwayatSaldo>(`admin/saldo-cuti/${balanceId}/riwayat`).then(wajib);
}
