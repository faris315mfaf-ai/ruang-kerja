/**
 * Privasi & Data Saya (docs/sesi/ponsel-b2-privasi.md): data pribadi sendiri,
 * persetujuan lokasi/selfie, kebijakan privasi (publik), dan unduh ekspor
 * Excel/PDF lewat Bearer.
 */
import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';

import { API_URL, apiRequest } from './client';

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new Error('Respons server kosong.');
  }
  return nilai;
}

// ── Tipe ─────────────────────────────────────────────────────────────────────

export interface InfoKebijakan {
  version: string;
  effective_date: string;
}

export interface RiwayatPersetujuan {
  id: string;
  type: 'location' | 'selfie';
  type_label: string;
  version: string;
  granted_at: string;
  revoked_at: string | null;
}

export interface JenisPersetujuan {
  label: string;
  granted: boolean;
  granted_version: string | null;
  granted_at: string | null;
}

export interface Persetujuan {
  granted: boolean;
  version: string;
  policy_version: string;
  granted_version: string | null;
  granted_at: string | null;
  needs_renewal: boolean;
  retention_months: number;
  types: { location: JenisPersetujuan; selfie: JenisPersetujuan };
  history: RiwayatPersetujuan[];
}

export interface ProfilData {
  name: string;
  email: string;
  employee_number: string | null;
  nik_masked: string | null;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  emergency_contact: string | null;
  division: string | null;
  team: string | null;
  position: string | null;
  manager: string | null;
  work_mode: string;
  status: string;
  joined_at: string | null;
  roles: string[];
  google_linked: boolean;
  two_factor: boolean;
  last_login_at: string | null;
}

export interface HariAbsensiData {
  date: string;
  status: string;
  status_label: string;
  shift: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in: string | null;
  check_out: string | null;
  method: string | null;
  location: string | null;
  late_minutes: number;
  early_leave_minutes: number;
  work_minutes: number;
  overtime_minutes: number;
  note: string | null;
}

export interface PengajuanData {
  id: string;
  number: string | null;
  type: string;
  summary: string;
  reason: string | null;
  status: string;
  status_label: string;
  submitted_at: string | null;
  decided_at: string | null;
  url: string;
}

export interface KeputusanData {
  id: string;
  request_id: string;
  number: string | null;
  requester: string;
  type: string;
  summary: string;
  decision: string;
  decision_label: string;
  note: string | null;
  decided_at: string | null;
  url: string;
}

export interface DataSaya {
  policy: InfoKebijakan;
  profile: ProfilData;
  consent: Persetujuan;
  status_labels: Record<string, string>;
  attendance: {
    total_days: number;
    counts: Record<string, number>;
    first_date: string | null;
    logs: number;
    selfies: number;
    days: HariAbsensiData[];
  };
  requests: { count: number; items: PengajuanData[] };
  decisions: { count: number; items: KeputusanData[] };
}

export interface BagianKebijakan {
  title: string;
  body_markdown: string;
}

export interface KebijakanPrivasi {
  title: string;
  version: string;
  effective_date: string;
  sections: BagianKebijakan[];
}

// ── Panggilan ────────────────────────────────────────────────────────────────

/** GET /privasi/data-saya */
export function dataSaya(): Promise<DataSaya> {
  return apiRequest<DataSaya>('privasi/data-saya').then(wajib);
}

/** GET /persetujuan */
export function bacaPersetujuan(): Promise<Persetujuan> {
  return apiRequest<{ consent: Persetujuan }>('persetujuan').then((r) => wajib(r).consent);
}

/** POST /persetujuan — kedua jenis wajib bersama. */
export function berikanPersetujuan(): Promise<Persetujuan> {
  return apiRequest<{ consent: Persetujuan }>('persetujuan', {
    method: 'POST',
    json: { types: ['location', 'selfie'] },
  }).then((r) => wajib(r).consent);
}

/** DELETE /persetujuan — HR diberi tahu server. */
export function cabutPersetujuan(): Promise<Persetujuan> {
  return apiRequest<{ consent: Persetujuan }>('persetujuan', { method: 'DELETE' }).then((r) => wajib(r).consent);
}

/** GET /kebijakan-privasi — publik (tanpa sesi pun bisa). */
export function ambilKebijakanPrivasi(): Promise<KebijakanPrivasi> {
  return apiRequest<KebijakanPrivasi>('kebijakan-privasi').then(wajib);
}

// ── Salinan luring kebijakan privasi ─────────────────────────────────────────

const BERKAS_KEBIJAKAN = 'kebijakan-privasi.json';

/** Simpan salinan terakhir ke penyimpanan aplikasi (bukan data pribadi). */
export function simpanSalinanKebijakan(kebijakan: KebijakanPrivasi): void {
  try {
    const berkas = new File(Paths.document, BERKAS_KEBIJAKAN);
    if (!berkas.exists) {
      berkas.create();
    }
    berkas.write(JSON.stringify(kebijakan));
  } catch {
    // Tanpa salinan: layar tetap bekerja online.
  }
}

/** Baca salinan tersimpan; null bila belum ada/rusak. */
export function bacaSalinanKebijakan(): KebijakanPrivasi | null {
  try {
    const berkas = new File(Paths.document, BERKAS_KEBIJAKAN);
    if (!berkas.exists) {
      return null;
    }
    const data = JSON.parse(berkas.textSync()) as KebijakanPrivasi;
    return Array.isArray(data.sections) ? data : null;
  } catch {
    return null;
  }
}

// ── Unduh ekspor ─────────────────────────────────────────────────────────────

export type FormatEkspor = 'xlsx' | 'pdf';

export class GalatUnduh extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'GalatUnduh';
    this.status = status;
  }
}

/** Token sesi dibaca dari SecureStore (kunci yang sama dengan SessionProvider). */
async function tokenSesi(): Promise<string | null> {
  try {
    const mentah = await SecureStore.getItemAsync('rk.sesi');
    if (!mentah) {
      return null;
    }
    const sesi = JSON.parse(mentah) as { token?: string };
    return sesi.token ?? null;
  } catch {
    return null;
  }
}

function pesanUnduh(galat: unknown): GalatUnduh {
  const teks = galat instanceof Error ? galat.message : '';
  const status = /\b(401|422|429|5\d\d)\b/.exec(teks)?.[1];
  if (status === '401') {
    return new GalatUnduh('Sesi berakhir. Silakan masuk kembali.', 401);
  }
  if (status === '429') {
    return new GalatUnduh('Terlalu banyak unduhan. Coba lagi beberapa saat lagi.', 429);
  }
  if (status !== undefined) {
    return new GalatUnduh('Server sedang bermasalah. Coba lagi beberapa saat.', Number(status));
  }
  return new GalatUnduh('Koneksi terputus sebelum berkas selesai.');
}

/**
 * GET /privasi/ekspor?format=… dengan Bearer → berkas di cache aplikasi.
 * Nama tetap per format sehingga unduhan baru menimpa yang lama.
 */
export async function unduhEkspor(format: FormatEkspor, signal?: AbortSignal): Promise<File> {
  const token = await tokenSesi();
  if (token === null) {
    throw new GalatUnduh('Sesi berakhir. Silakan masuk kembali.', 401);
  }
  const folder = new Directory(Paths.cache, 'ekspor');
  if (!folder.exists) {
    folder.create({ intermediates: true, idempotent: true });
  }
  const tujuan = new File(folder, `data-saya.${format}`);
  try {
    return await File.downloadFileAsync(`${API_URL}/privasi/ekspor?format=${format}`, tujuan, {
      headers: { Authorization: `Bearer ${token}`, Accept: format === 'pdf' ? 'application/pdf' : 'application/octet-stream' },
      idempotent: true,
      signal,
    });
  } catch (galat) {
    if (signal?.aborted) {
      throw new GalatUnduh('Unduhan dibatalkan.');
    }
    throw pesanUnduh(galat);
  }
}
