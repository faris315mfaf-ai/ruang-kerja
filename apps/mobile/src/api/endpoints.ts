/**
 * Endpoint API ponsel — satu fungsi per rute routes/api.php.
 */
import { apiRequest, formFile } from './client';
import type { AnggotaWorkspace,
  AttendanceHistory,
  AttendanceResult,
  Briefing,
  CalendarMonth,
  ChatChannel,
  ChatMessage,
  ChatTaskRef,
  ChatTimeline,
  CommentPage,
  DeviceInfo,
  DeviceRow,
  InboxPage,
  KonfigurasiApp,
  LoginResponse,
  LupaSandiMinta,
  LupaSandiStatus,
  SesiDibuka,
  MeetingAgenda,
  MeetingDetailResponse,
  MeetingMinutesResponse,
  MeetingItem,
  NoteDetailData,
  RequestPage,
  RequestTypes,
  RentangRapat,
  RsvpValue,
  TaskComment,
  TaskDetail,
  TaskListItem,
  TaskPage,
  TaskStoreBody,
  TaskUpdateBody,
  TodayAttendance,
  TodayTasks,
  UserProfile,
  WorkspaceBoard,
  WorkspaceGroups,
  WorkspaceNotes,
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
    // supports_password_change: aplikasi sanggup menjalankan "wajib ganti sandi" sendiri (POST /auth/sandi).
    json: { email, password, device, supports_password_change: true },
  }).then(wajib);
}

/** POST /auth/dua-faktor — selesaikan tantangan TOTP dengan kode 6 digit atau kode pemulihan. */
export function duaFaktor(challengeToken: string, input: { code?: string; recoveryCode?: string }): Promise<SesiDibuka> {
  return apiRequest<SesiDibuka>('auth/dua-faktor', {
    method: 'POST',
    json: {
      challenge_token: challengeToken,
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.recoveryCode !== undefined ? { recovery_code: input.recoveryCode } : {}),
    },
  }).then(wajib);
}

/** POST /auth/sandi — ganti kata sandi sendiri (juga untuk "wajib ganti"). Mengembalikan profil lengkap. */
export function gantiSandi(input: { currentPassword: string; password: string; passwordConfirmation: string }): Promise<{ message: string; password_change_required: boolean; user: UserProfile }> {
  return apiRequest<{ message: string; password_change_required: boolean; user: UserProfile }>('auth/sandi', {
    method: 'POST',
    json: {
      current_password: input.currentPassword,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
    },
  }).then(wajib);
}

/** POST /auth/lupa-sandi — minta reset ke HR. Respons identik untuk email terdaftar atau tidak. */
export function lupaSandiMinta(email: string): Promise<LupaSandiMinta> {
  return apiRequest<LupaSandiMinta>('auth/lupa-sandi', { method: 'POST', json: { email } }).then(wajib);
}

/** GET /auth/lupa-sandi/status — token permintaan lewat header X-Reset-Token. */
export async function lupaSandiStatus(requestToken: string): Promise<LupaSandiStatus> {
  return apiRequest<LupaSandiStatus>('auth/lupa-sandi/status', { headers: { 'X-Reset-Token': requestToken } }).then(wajib);
}

/** POST /auth/lupa-sandi/selesai — sandi baru dengan setup token; hasil: sesi dibuka atau tantangan TOTP. */
export function lupaSandiSelesai(input: { setupToken: string; password: string; passwordConfirmation: string; device: DeviceInfo }): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('auth/lupa-sandi/selesai', {
    method: 'POST',
    json: {
      setup_token: input.setupToken,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
      device: input.device,
    },
  }).then(wajib);
}

/** GET /konfigurasi — publik: versi minimal/terbaru + pemeliharaan. */
export function konfigurasi(): Promise<KonfigurasiApp> {
  return apiRequest<KonfigurasiApp>('konfigurasi', { timeoutMs: 8_000 }).then(wajib);
}

/** POST /tautan-desktop — kirim tautan halaman web ke email pemilik akun (B2). */
export function kirimTautanDesktop(path: string): Promise<{ message: string; email: string }> {
  return apiRequest<{ message: string; email: string }>('tautan-desktop', { method: 'POST', json: { path } }).then(wajib);
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
  /** Laporan kerja (wajib untuk check-out GPS/WFH). */
  workReport?: string[];
}

/** POST /absensi/check-in — multipart dengan selfie. */
export function checkIn(payload: AbsensiPayload): Promise<AttendanceResult> {
  return postAbsensi('absensi/check-in', payload);
}

/** POST /absensi/check-out — laporan kerja (`work_report[]`) wajib untuk GPS + selfie. */
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
  const checkOut = path.endsWith('check-out');
  for (const point of (checkOut ? payload.workReport : payload.workPlan) ?? []) {
    form.append(checkOut ? 'work_report[]' : 'work_plan[]', point);
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

/** POST /tugas — 403 bila boleh lihat tapi tak boleh menyunting workspace. */
export function buatTugas(body: TaskStoreBody): Promise<TaskDetail> {
  return apiRequest<{ task: TaskDetail }>('tugas', {
    method: 'POST',
    json: body,
  }).then((r) => wajib(r).task);
}

/** PATCH /tugas/{task} — 403 bila bukan pembuat/atasan (matriks 9 Okt). */
export function suntingTugas(id: string, body: TaskUpdateBody): Promise<TaskDetail> {
  return apiRequest<{ task: TaskDetail }>(`tugas/${id}`, {
    method: 'PATCH',
    json: body,
  }).then((r) => wajib(r).task);
}

/** DELETE /tugas/{task} — 204 (null) sukses; 403 bila bukan pembuat/atasan. */
export function hapusTugas(id: string): Promise<null> {
  return apiRequest<null>(`tugas/${id}`, { method: 'DELETE' });
}

// ── Komentar tugas ───────────────────────────────────────────────────────────

/** Halaman komentar, terbaru dulu (30/halaman). */
export function komentarTugas(id: string, page: number): Promise<CommentPage> {
  return apiRequest<CommentPage>(`tugas/${id}/komentar`, {
    query: { page },
  }) as Promise<CommentPage>;
}

/** Kirim komentar teks polos → 201 komentar baru. */
export function kirimKomentar(id: string, body: string): Promise<TaskComment> {
  return apiRequest<{ comment: TaskComment }>(`tugas/${id}/komentar`, {
    method: 'POST',
    json: { body },
  }).then((r) => wajib(r).comment);
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
export async function briefingTerakhir(): Promise<Briefing | null> {
  // The server wraps the payload: {briefing: {...}}.
  const hasil = await apiRequest<{ briefing: Briefing }>('briefing/terakhir');
  return hasil?.briefing ?? null;
}

export function daftarWorkspace(): Promise<WorkspaceGroups> {
  return apiRequest<WorkspaceGroups>('workspace') as Promise<WorkspaceGroups>;
}

// ── Papan workspace ──────────────────────────────────────────────────────────

/** GET /workspace/{workspace}/papan — kolom + kartu (TaskResource web). */
export function papanWorkspace(workspaceId: string): Promise<WorkspaceBoard> {
  return apiRequest<WorkspaceBoard>(`workspace/${workspaceId}/papan`) as Promise<WorkspaceBoard>;
}

// ── Catatan (di balik flag features.notes — 404 saat mati) ───────────────────

export function catatanWorkspace(workspaceId: string): Promise<WorkspaceNotes> {
  return apiRequest<WorkspaceNotes>(`workspace/${workspaceId}/catatan`) as Promise<WorkspaceNotes>;
}

/** Buat catatan baru (judul saja) → detail catatan kosong. */
export function buatCatatan(workspaceId: string, title: string): Promise<NoteDetailData> {
  return apiRequest<{ note: NoteDetailData }>(`workspace/${workspaceId}/catatan`, {
    method: 'POST',
    json: { title },
  }).then((r) => wajib(r).note);
}

export function detailCatatan(id: string): Promise<NoteDetailData> {
  return apiRequest<{ note: NoteDetailData }>(`catatan/${id}`).then((r) => wajib(r).note);
}

/**
 * PATCH /catatan/{note} — SATU maksud per permintaan: `{title}` (rename)
 * ATAU `{body_html, updated_at}` (isi; konflik versi → 409).
 */
export function simpanCatatan(
  id: string,
  body: { title: string } | { body_html: string; updated_at: string },
): Promise<NoteDetailData> {
  return apiRequest<{ note: NoteDetailData }>(`catatan/${id}`, {
    method: 'PATCH',
    json: body,
  }).then((r) => wajib(r).note);
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

// ── Obrolan (di balik flag features.chat — 404 saat mati) ───────────────────

/** GET /obrolan/kanal — daftar kanal ChatInbox web (unread, pratinjau, izin). */
export function daftarKanal(): Promise<{ channels: ChatChannel[] }> {
  return apiRequest<{ channels: ChatChannel[] }>('obrolan/kanal') as Promise<{
    channels: ChatChannel[];
  }>;
}

/** GET /obrolan/kanal/{channel}/pesan — halaman 30 pesan; `sebelum` = id pesan utama tertua. */
export function pesanKanal(channelId: string, sebelum?: string | null): Promise<ChatTimeline> {
  return apiRequest<ChatTimeline>(`obrolan/kanal/${channelId}/pesan`, {
    query: { sebelum: sebelum ?? null },
  }) as Promise<ChatTimeline>;
}

/** POST /obrolan/kanal/{channel}/pesan — teks polos, 201; limiter 60/menit → 429. */
export async function kirimPesan(
  channelId: string,
  body: string,
): Promise<{ message: ChatMessage; tasks: ChatTaskRef[] }> {
  const hasil = await apiRequest<{ message: ChatMessage; tasks: ChatTaskRef[] }>(
    `obrolan/kanal/${channelId}/pesan`,
    { method: 'POST', json: { body } },
  );
  return wajib(hasil);
}

// ── Rapat (di balik flag features.meetings — 404 saat mati) ─────────────────

/** GET /rapat?rentang= — agenda "rapat saya" tiga rentang. */
export function agendaRapat(rentang: RentangRapat): Promise<MeetingAgenda> {
  return apiRequest<MeetingAgenda>('rapat', {
    query: { rentang },
  }) as Promise<MeetingAgenda>;
}

/** GET /rapat/{meeting}?tanggal=Y-m-d — detail satu kemunculan + izin + ruang video. */
export function detailRapat(
  meetingId: string,
  tanggal?: string | null,
): Promise<MeetingDetailResponse> {
  return apiRequest<MeetingDetailResponse>(`rapat/${meetingId}`, {
    query: { tanggal: tanggal ?? null },
  }) as Promise<MeetingDetailResponse>;
}

/** POST /rapat/{meeting}/kehadiran {rsvp: yes|maybe|no} — berlaku seluruh seri. */
export async function rsvpRapat(meetingId: string, rsvp: Exclude<RsvpValue, 'pending'>): Promise<RsvpValue> {
  const hasil = await apiRequest<{ rsvp: RsvpValue }>(`rapat/${meetingId}/kehadiran`, {
    method: 'POST',
    json: { rsvp },
  });
  return wajib(hasil).rsvp;
}

/** GET /rapat/{meeting}/notulen — notulen baca-saja satu kemunculan. */
export function notulenRapat(
  meetingId: string,
  tanggal?: string | null,
): Promise<MeetingMinutesResponse> {
  return apiRequest<MeetingMinutesResponse>(`rapat/${meetingId}/notulen`, {
    query: { tanggal: tanggal ?? null },
  }) as Promise<MeetingMinutesResponse>;
}

/** Baris agenda pertama yang belum selesai — kartu "Rapat berikutnya" Beranda. */
export async function rapatBerikutnya(): Promise<MeetingItem | null> {
  const [hariIni, akanDatang] = await Promise.allSettled([
    agendaRapat('hari-ini'),
    agendaRapat('akan-datang'),
  ]);
  const sekarang = Date.now();
  const kandidat: MeetingItem[] = [];
  if (hariIni.status === 'fulfilled') {
    kandidat.push(
      ...hariIni.value.items.filter((item) => new Date(item.ends_at).getTime() > sekarang),
    );
  }
  if (akanDatang.status === 'fulfilled') {
    kandidat.push(...akanDatang.value.items);
  }
  kandidat.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return kandidat[0] ?? null;
}

// ── Kalender ────────────────────────────────────────────────────────────────

/** GET /kalender?bulan=YYYY-MM — entri flat pekan-pekan penutup bulan; null = bulan berjalan. */
export function kalenderBulan(bulan?: string | null): Promise<CalendarMonth> {
  return apiRequest<CalendarMonth>('kalender', {
    query: { bulan: bulan ?? null },
  }) as Promise<CalendarMonth>;
}

// ── Perangkat ────────────────────────────────────────────────────────────────

export function daftarPerangkat(): Promise<{ devices: DeviceRow[] }> {
  return apiRequest<{ devices: DeviceRow[] }>('perangkat') as Promise<{ devices: DeviceRow[] }>;
}

/** PATCH /perangkat/{id}/biometrik — penanda "buka dengan sidik jari" per perangkat (B2). */
export function setBiometrikPerangkat(id: string, enabled: boolean): Promise<{ message: string; device_id: string; biometric_login: boolean } | null> {
  return apiRequest<{ message: string; device_id: string; biometric_login: boolean }>(`perangkat/${id}/biometrik`, {
    method: 'PATCH',
    json: { enabled },
  });
}

export function cabutPerangkat(id: string): Promise<{ message: string } | null> {
  return apiRequest<{ message: string }>(`perangkat/${id}`, { method: 'DELETE' });
}

/** POST /obrolan/kanal/{id}/dibaca — bersihkan lencana belum-dibaca kanal. */
export async function tandaiKanalDibaca(channelId: string): Promise<void> {
    await apiRequest(`/obrolan/kanal/${channelId}/dibaca`, { method: 'POST' });
}

/** GET /workspace/{id}/anggota — untuk pemilih penanggung tugas. */
export async function anggotaWorkspace(workspaceId: string): Promise<AnggotaWorkspace[]> {
    const data = await apiRequest<{ anggota?: AnggotaWorkspace[] }>(
        `/workspace/${workspaceId}/anggota`,
    );
    return data?.anggota ?? [];
}
