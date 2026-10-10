/**
 * Endpoint API ponsel — satu fungsi per rute routes/api.php.
 */
import { apiRequest, formFile } from './client';
import type {
  AttendanceHistory,
  AttendanceResult,
  Briefing,
  DeviceInfo,
  DeviceRow,
  InboxPage,
  LoginResponse,
  RequestPage,
  RequestTypes,
  TaskDetail,
  TaskListItem,
  TaskPage,
  TodayAttendance,
  TodayTasks,
  UserProfile,
  WorkspaceGroups,
} from './types';

/** Ambil nilai non-null dari permintaan yang sukses (200 selalu berbody). */
function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons server kosong.');
  }
  return nilai;
}

// ── Sesi ─────────────────────────────────────────────────────────────────────

export function login(email: string, password: string, device: DeviceInfo): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('auth/login', {
    method: 'POST',
    json: { email, password, device },
  }) as Promise<LoginResponse>;
}

export function logout(): Promise<{ message: string } | null> {
  return apiRequest<{ message: string }>('auth/logout', { method: 'POST' });
}

export function saya(): Promise<UserProfile> {
  return apiRequest<{ user: UserProfile }>('auth/saya').then((r) => wajib(r).user);
}

// ── Absensi ──────────────────────────────────────────────────────────────────

export function absensiHariIni(): Promise<TodayAttendance> {
  return apiRequest<TodayAttendance>('absensi/hari-ini') as Promise<TodayAttendance>;
}

export function absensiRiwayat(bulan?: string): Promise<AttendanceHistory> {
  return apiRequest<AttendanceHistory>('absensi/riwayat', {
    query: { bulan: bulan ?? null },
  }) as Promise<AttendanceHistory>;
}

export interface AbsensiPayload {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  selfieUri: string;
  deviceIdHash: string;
  note?: string | null;
  workPlan?: string[];
}

/** POST /absensi/check-in — multipart dengan selfie. */
export function checkIn(payload: AbsensiPayload): Promise<AttendanceResult> {
  return postAbsensi('absensi/check-in', payload);
}

/** POST /absensi/check-out — tanpa rencana kerja. */
export function checkOut(payload: AbsensiPayload): Promise<AttendanceResult> {
  return postAbsensi('absensi/check-out', payload);
}

async function postAbsensi(path: string, payload: AbsensiPayload): Promise<AttendanceResult> {
  const form = new FormData();
  form.append('latitude', String(payload.latitude));
  form.append('longitude', String(payload.longitude));
  if (payload.accuracy !== null) {
    form.append('accuracy', String(Math.round(payload.accuracy)));
  }
  form.append('client_time', new Date().toISOString());
  // Di React Native FormData menerima {uri,name,type}; tipe DOM tidak mengenalnya.
  form.append('selfie', formFile(payload.selfieUri, 'selfie.jpg') as unknown as Blob);
  form.append('device_id', payload.deviceIdHash);
  if (payload.note && payload.note.trim() !== '') {
    form.append('note', payload.note.trim());
  }
  for (const point of payload.workPlan ?? []) {
    form.append('work_plan[]', point);
  }

  const data = await apiRequest<{ result: AttendanceResult }>(path, {
    method: 'POST',
    form,
    timeoutMs: 60_000,
  });
  return wajib(data).result;
}

// ── Tugas ────────────────────────────────────────────────────────────────────

export function tugasHariIni(): Promise<TodayTasks> {
  return apiRequest<TodayTasks>('tugas/hari-ini') as Promise<TodayTasks>;
}

export function daftarTugas(page: number, saya: boolean): Promise<TaskPage> {
  return apiRequest<TaskPage>('tugas', {
    query: { page, saya: saya ? 1 : null },
  }) as Promise<TaskPage>;
}

export function detailTugas(id: string): Promise<TaskDetail> {
  return apiRequest<{ task: TaskDetail }>(`tugas/${id}`).then((r) => wajib(r).task);
}

export function ubahStatusTugas(id: string, body: { done: boolean } | { status_id: string }): Promise<TaskListItem> {
  return apiRequest<{ task: TaskListItem }>(`tugas/${id}/status`, {
    method: 'PATCH',
    json: body,
  }).then((r) => wajib(r).task);
}

// ── Inbox ────────────────────────────────────────────────────────────────────

export function inbox(page: number, belumDibaca: boolean): Promise<InboxPage> {
  return apiRequest<InboxPage>('inbox', {
    query: { page, 'belum-dibaca': belumDibaca ? 1 : null },
  }) as Promise<InboxPage>;
}

export function tandaiBaca(id: string): Promise<number> {
  return apiRequest<{ unread: number }>(`inbox/${id}/baca`, { method: 'POST' }).then((r) => wajib(r).unread);
}

// ── Briefing & workspace ─────────────────────────────────────────────────────

/** 204 = belum ada briefing → null. */
export function briefingTerakhir(): Promise<Briefing | null> {
  return apiRequest<Briefing>('briefing/terakhir');
}

export function daftarWorkspace(): Promise<WorkspaceGroups> {
  return apiRequest<WorkspaceGroups>('workspace') as Promise<WorkspaceGroups>;
}

// ── Pengajuan ────────────────────────────────────────────────────────────────

export function jenisPengajuan(): Promise<RequestTypes> {
  return apiRequest<RequestTypes>('pengajuan/jenis') as Promise<RequestTypes>;
}

export function daftarPengajuan(page: number): Promise<RequestPage> {
  return apiRequest<RequestPage>('pengajuan', { query: { page } }) as Promise<RequestPage>;
}

/** Kirim pengajuan baru — field sesuai kategori (lihat SubmitEmployeeRequestRequest). */
export function kirimPengajuan(
  body: Record<string, unknown>,
): Promise<import('./types').EmployeeRequestRow> {
  return apiRequest<{ request: import('./types').EmployeeRequestRow }>('pengajuan', {
    method: 'POST',
    json: body,
  }).then((r) => wajib(r).request);
}

// ── Perangkat ────────────────────────────────────────────────────────────────

export function daftarPerangkat(): Promise<{ devices: DeviceRow[] }> {
  return apiRequest<{ devices: DeviceRow[] }>('perangkat') as Promise<{ devices: DeviceRow[] }>;
}

export function cabutPerangkat(id: string): Promise<{ message: string } | null> {
  return apiRequest<{ message: string }>(`perangkat/${id}`, { method: 'DELETE' });
}
