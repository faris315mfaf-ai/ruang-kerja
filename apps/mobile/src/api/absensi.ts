/**
 * Absensi ponsel (docs/sesi/ponsel-b2a-absensi.md): hari-ini + `state`, check-in/out
 * GPS+selfie (dengan `mock_location`), check-in/out QR, riwayat diperkaya, detail
 * hari, rekap bulanan, dan unduh rekap PDF. Persetujuan UU PDP ada di `privasi.ts`.
 *
 * Bentuk badan respons modul ini camelCase; `context` penolakan 422 tetap snake_case
 * seperti web (`distance_m`, `radius_m`, `opens_at`, ...).
 */
import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';

import { API_URL, ApiError, apiRequest, formFile } from './client';
import type { AttendanceHistory, AttendanceResult, RecapDayCell, TodayAttendance } from './types';

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons server kosong.');
  }
  return nilai;
}

// ── Tipe: hari ini ───────────────────────────────────────────────────────────

export type KodeKeadaan =
  | 'checked_in'
  | 'checked_out'
  | 'day_has_request'
  | 'holiday'
  | 'non_working_day'
  | 'too_early'
  | 'window_closed'
  | 'no_office_location'
  | 'not_checked_in';

export interface PusatTab {
  action: 'absen' | 'workspace';
  badge: boolean;
  /** Instan perubahan berikutnya (jam pulang − 60 menit); pasang timer, tanpa polling. */
  flipsAt: string | null;
}

/** Satu rentang jam absen perusahaan ("HH:MM", zona kantor); batas yang kosong = tanpa batas. */
export interface RentangJam {
  from: string | null;
  until: string | null;
}

/** Jam absen perusahaan; `null` bila kedua batas kosong (perilaku lama). */
export interface JendelaAbsen {
  checkIn: RentangJam | null;
  checkOut: RentangJam | null;
}

export interface PengajuanHari {
  status: string;
  statusLabel: string;
  portion: string | null;
  blocksCheckIn: boolean;
}

/** Jenis yang dibuka pintasan sakit/izin (B6). */
export interface JenisPintasan {
  id: string;
  code: string;
  name: string;
}

/** Pengajuan sakit/izin hari ini yang masih menunggu keputusan / revisi. */
export interface PengajuanMenunggu {
  id: string;
  number: string | null;
  typeLabel: string;
  status: 'pending' | 'revision_requested';
  statusLabel: string;
}

/** Pintasan "Tidak masuk? Ajukan sakit / izin" (docs/sesi/ponsel-b6-sakit-izin.md §4). */
export interface PintasanCuti {
  available: boolean;
  /** "HH:MM" waktu kantor, atau null. */
  sickCutoff: string | null;
  permitCutoff: string | null;
  sickClosed: boolean;
  permitClosed: boolean;
  sickType: JenisPintasan | null;
  permitType: JenisPintasan | null;
  closedReason: string | null;
  pending: PengajuanMenunggu | null;
}

export interface KeadaanAbsen {
  code: KodeKeadaan;
  label: string;
  message: string;
  punctuality: 'on_time' | 'late' | null;
  lateMinutes: number;
  officeDate: string;
  workDate: string;
  isWorkday: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  isRemote: boolean;
  isBusinessTrip: boolean;
  request: PengajuanHari | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  windowOpensAt: string | null;
  lateThreshold: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  locationName: string | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
  /** Alasan Indonesia bila absen pulang tertutup (di luar jam pulang), selain itu null. */
  checkOutBlockedReason: string | null;
  /** Jam absen perusahaan (server lama: tidak ada). */
  windows?: JendelaAbsen;
  consent: { granted: boolean; needsRenewal: boolean; version: string };
  center: PusatTab;
  /** Pintasan sakit/izin; server lama: tidak ada. */
  leaveShortcut?: PintasanCuti | null;
}

export type HariIni = TodayAttendance & {
  state: KeadaanAbsen | null;
  /** `today.windowsApply` false = shift lintas tengah malam (jam absen tidak berlaku). */
  today: { windowsApply?: boolean };
};

/** GET /absensi/hari-ini (bentuk lama + `state`). */
export function absensiHariIniLengkap(): Promise<HariIni> {
  return apiRequest<HariIni>('absensi/hari-ini').then((r) => {
    const data = wajib(r);
    return { ...data, state: data.state ?? null };
  });
}

// ── Kirim check-in / check-out ───────────────────────────────────────────────

export interface KirimGps {
  arah: 'masuk' | 'pulang';
  latitude: number;
  longitude: number;
  accuracy: number | null;
  mockLocation: boolean;
  selfieUri: string;
  deviceIdHash: string;
  note?: string | null;
  /** Rencana kerja (check-in); diabaikan untuk check-out. */
  workPlan?: string[];
  /** Laporan kerja (check-out, wajib ≥ 1 poin); diabaikan untuk check-in. */
  workReport?: string[];
}

/** POST /absensi/check-in | /check-out — multipart dengan selfie (GPS atau WFH; server menurunkan metode). */
export async function kirimGps(p: KirimGps): Promise<AttendanceResult> {
  const form = new FormData();
  form.append('latitude', String(p.latitude));
  form.append('longitude', String(p.longitude));
  if (p.accuracy !== null) {
    form.append('accuracy', String(Math.round(p.accuracy)));
  }
  form.append('client_time', new Date().toISOString());
  form.append('mock_location', p.mockLocation ? '1' : '0');
  form.append('selfie', formFile(p.selfieUri, 'selfie.jpg') as unknown as Blob);
  form.append('device_id', p.deviceIdHash);
  if (p.note && p.note.trim() !== '') {
    form.append('note', p.note.trim());
  }
  if (p.arah === 'masuk') {
    for (const poin of p.workPlan ?? []) {
      form.append('work_plan[]', poin);
    }
  } else {
    for (const poin of p.workReport ?? []) {
      form.append('work_report[]', poin);
    }
  }
  const data = await apiRequest<{ result: AttendanceResult }>(p.arah === 'masuk' ? 'absensi/check-in' : 'absensi/check-out', {
    method: 'POST',
    form,
    timeoutMs: 60_000,
  });
  return wajib(data).result;
}

export interface KirimQr {
  arah: 'masuk' | 'pulang';
  payload: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  mockLocation?: boolean;
}

/** POST /absensi/check-in/qr | /check-out/qr — tanpa selfie. */
export async function kirimQr(p: KirimQr): Promise<AttendanceResult> {
  const json: Record<string, unknown> = {
    payload: p.payload.slice(0, 512),
    client_time: new Date().toISOString(),
    mock_location: p.mockLocation === true,
  };
  if (p.latitude !== null && p.latitude !== undefined && p.longitude !== null && p.longitude !== undefined) {
    json.latitude = p.latitude;
    json.longitude = p.longitude;
    if (p.accuracy !== null && p.accuracy !== undefined) {
      json.accuracy = Math.round(p.accuracy);
    }
  }
  const data = await apiRequest<{ result: AttendanceResult }>(p.arah === 'masuk' ? 'absensi/check-in/qr' : 'absensi/check-out/qr', {
    method: 'POST',
    json,
    timeoutMs: 30_000,
  });
  return wajib(data).result;
}

// ── Penolakan check-in/out ───────────────────────────────────────────────────

/** Konteks penolakan 422 (snake_case persis web). */
export interface KonteksTolak {
  distance_m?: number;
  radius_m?: number;
  accuracy_m?: number;
  location?: { name?: string; latitude?: number; longitude?: number; radius_m?: number } | null;
  opens_at?: string | null;
  /** Jam absen: `before` = belum dibuka, `after` = sudah ditutup. */
  phase?: 'before' | 'after';
  from?: string | null;
  until?: string | null;
  at?: string;
  status?: string;
}

export interface GagalAbsen {
  /** Alasan server (`outside_geofence`, `qr_expired`, ...), `jaringan`, `batas`, atau `lain`. */
  reason: string;
  message: string;
  status: number;
  context: KonteksTolak;
  retryAfter: number | null;
}

/** Ubah galat apa pun dari kirim menjadi bentuk layar "Check-in belum bisa". */
export function jadikanGagal(err: unknown): GagalAbsen {
  if (err instanceof ApiError) {
    if (err.status === 0) {
      return { reason: 'jaringan', message: 'Koneksi terputus. Check-in butuh koneksi internet, coba lagi. Data form dan foto Anda tidak hilang.', status: 0, context: {}, retryAfter: null };
    }
    if (err.status === 429) {
      return { reason: 'batas', message: 'Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi.', status: 429, context: {}, retryAfter: err.retryAfter };
    }
    const adaLaporan = Object.keys(err.errors).some((k) => k === 'work_report' || k.startsWith('work_report.'));
    return {
      reason: err.reason ?? (err.errors.note !== undefined ? 'note_required' : adaLaporan ? 'work_report_required' : 'lain'),
      message: err.firstValidationError ?? err.message,
      status: err.status,
      context: (err.context ?? {}) as KonteksTolak,
      retryAfter: err.retryAfter,
    };
  }
  return { reason: 'lain', message: 'Gagal mengirim. Coba lagi beberapa saat.', status: -1, context: {}, retryAfter: null };
}

// ── Tipe: riwayat, detail hari, rekap ────────────────────────────────────────

export interface KoreksiInfo {
  available: boolean;
  typeId: string | null;
  typeCode: string | null;
  typeName: string | null;
  maxBackdateDays: number | null;
}

export interface PengajuanTerkait {
  id: string;
  number: string | null;
  type: string;
  category: string;
  categoryLabel: string;
  status: string;
  statusLabel: string;
  portion: string | null;
}

export interface KoreksiHari {
  canCorrect: boolean;
  deadline: string | null;
  pendingRequest: { id: string; number: string | null; status: string; statusLabel: string } | null;
}

export interface Penanda {
  code: string;
  label: string;
}

export interface SelHari extends RecapDayCell {
  status: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  locationLabel: string | null;
  workPlan: string[];
  workReport: string[];
  note: string | null;
  flags: Penanda[];
  isCorrected: boolean;
  request: PengajuanTerkait | null;
  correction: KoreksiHari;
}

export type RiwayatBulan = Omit<AttendanceHistory, 'recap'> & {
  recap: Omit<AttendanceHistory['recap'], 'days'> & { days: SelHari[] };
  today: string;
  correction: KoreksiInfo;
};

/** GET /absensi/riwayat?bulan=YYYY-MM */
export function riwayatBulan(bulan?: string): Promise<RiwayatBulan> {
  return apiRequest<RiwayatBulan>('absensi/riwayat', { query: { bulan: bulan ?? null } }).then(wajib);
}

export interface LogHari {
  id: string;
  type: 'check_in' | 'check_out';
  typeLabel: string;
  method: string;
  methodLabel: string;
  occurredAt: string | null;
  locationName: string | null;
  inside: boolean;
  distanceM: number | null;
  accuracyM: number | null;
  note: string | null;
  flags: Penanda[];
  isCorrection: boolean;
  reviewedAt: string | null;
}

export interface DetailHari {
  date: string;
  dateLabel: string;
  day: SelHari;
  logs: LogHari[];
  correction: KoreksiInfo & { available: boolean };
  privacyNote: string;
}

/** GET /absensi/hari/{date} */
export function detailHari(tanggal: string): Promise<DetailHari> {
  return apiRequest<DetailHari>(`absensi/hari/${tanggal}`).then(wajib);
}

export interface RekapPribadi {
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
  overtimeMinutes: number;
  attendanceRate: number | null;
  averageCheckIn: string | null;
}

export interface RekapBulan {
  period: AttendanceHistory['period'];
  recap: RekapPribadi;
  downloadFormats: string[];
}

/** GET /absensi/rekap?bulan=YYYY-MM */
export function rekapBulan(bulan?: string): Promise<RekapBulan> {
  return apiRequest<RekapBulan>('absensi/rekap', { query: { bulan: bulan ?? null } }).then(wajib);
}

// ── Unduh PDF rekap ──────────────────────────────────────────────────────────

export class GalatUnduhRekap extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GalatUnduhRekap';
  }
}

async function tokenSesi(): Promise<string | null> {
  try {
    const mentah = await SecureStore.getItemAsync('rk.sesi');
    if (!mentah) {
      return null;
    }
    return (JSON.parse(mentah) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

/** GET /absensi/rekap/unduh?bulan=…&format=pdf dengan Bearer → berkas di cache aplikasi. */
export async function unduhRekapPdf(bulan: string): Promise<File> {
  const token = await tokenSesi();
  if (token === null) {
    throw new GalatUnduhRekap('Sesi berakhir. Silakan masuk kembali.');
  }
  const folder = new Directory(Paths.cache, 'absensi');
  if (!folder.exists) {
    folder.create({ intermediates: true, idempotent: true });
  }
  const tujuan = new File(folder, `rekap-absensi-saya-${bulan}.pdf`);
  try {
    return await File.downloadFileAsync(`${API_URL}/absensi/rekap/unduh?bulan=${encodeURIComponent(bulan)}&format=pdf`, tujuan, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
      idempotent: true,
    });
  } catch (galat) {
    const teks = galat instanceof Error ? galat.message : '';
    const status = /\b(401|422|429|5\d\d)\b/.exec(teks)?.[1];
    if (status === '429') {
      throw new GalatUnduhRekap('Terlalu banyak unduhan. Coba lagi beberapa saat lagi.');
    }
    if (status === '401') {
      throw new GalatUnduhRekap('Sesi berakhir. Silakan masuk kembali.');
    }
    if (status !== undefined) {
      throw new GalatUnduhRekap('Server sedang bermasalah. Coba lagi beberapa saat.');
    }
    throw new GalatUnduhRekap('Koneksi terputus sebelum berkas selesai.');
  }
}
