/**
 * API Pengajuan saya (B4-A, `docs/sesi/ponsel-b4a-pengajuan.md`): jenis +
 * aturan isian, pratinjau ringkasan, daftar dengan filter & hitungan, draf,
 * kirim / kirim ulang / batal / hapus, lampiran, detail, dan pembatalan HR
 * atas pengajuan yang sudah disetujui. Fungsi lama di `endpoints.ts` tetap ada.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { API_URL, ApiError, apiRequest } from './client';

function wajib<T>(nilai: T | null): T {
  if (nilai === null) {
    throw new ApiError({ status: 500, message: 'Respons server kosong.' });
  }
  return nilai;
}

// ── Tipe bersama ─────────────────────────────────────────────────────────────

export type StatusPengajuan = 'draft' | 'pending' | 'approved' | 'rejected' | 'revision_requested' | 'canceled';
export type KategoriPengajuan = 'leave' | 'permit' | 'sick' | 'overtime' | 'correction' | 'business_trip' | 'procurement';
export type ModeIzin = 'days' | 'hours';

export interface Orang {
  id: string;
  name: string;
  avatar: string | null;
  position: string | null;
  division: string | null;
}

export interface RingkasanSaldo {
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

export interface JenisPengajuan {
  id: string;
  code: string;
  name: string;
  category: KategoriPengajuan;
  category_label: string;
  description: string | null;
  annual_quota_days: number | null;
  requires_attachment_after_days: number | null;
  allow_half_day: boolean;
  max_backdate_days: number | null;
  is_paid: boolean;
  counts_calendar_days: boolean;
  max_days_per_request: number | null;
  day_unit: string | null;
  is_provisional_default: boolean;
  locked: boolean;
  locked_reason: string | null;
}

export interface JenisForm extends JenisPengajuan {
  eligible: boolean;
  ineligible_reason: string | null;
  needs_substitute: boolean;
  modes: ModeIzin[] | null;
  fields: string[] | Record<ModeIzin, string[]>;
  /** Hanya non-staf (kunci tidak ada untuk staf). */
  balance?: RingkasanSaldo | null;
}

export interface KategoriJenis {
  value: KategoriPengajuan;
  label: string;
  slug: string;
  locked: boolean;
  types: JenisForm[];
}

export interface BatasLampiran {
  reason: number;
  max_files: number;
  max_kilobytes: number;
  mimes: string[];
}

export interface DaftarJenis {
  categories: KategoriJenis[];
  today: string;
  limits: BatasLampiran;
}

export interface PayloadPengajuan {
  mode?: ModeIzin;
  half_day?: boolean;
  date?: string;
  start_time?: string;
  end_time?: string;
  check_in?: string | null;
  check_out?: string | null;
  destination?: string;
  item_name?: string;
  quantity?: number;
  unit?: string | null;
  unit_price?: number | null;
  total?: number | null;
  reference_url?: string | null;
  urgency?: 'biasa' | 'mendesak';
}

export interface ItemPengajuan {
  id: string;
  number: string | null;
  status: StatusPengajuan;
  status_label: string;
  type: JenisPengajuan;
  user: Orang;
  start_at: string;
  end_at: string;
  days: number | null;
  minutes: number | null;
  payload: PayloadPengajuan;
  round: number;
  step_position: number | null;
  step_count: number;
  waiting: { label: string; approver: Orang | null; since: string | null } | null;
  decision_note: { status: string; note: string | null; by: string | null; at: string | null } | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
}

export interface LampiranServer {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number | null;
  url: string;
}

export type StatusLangkah = 'queued' | 'waiting' | 'approved' | 'rejected' | 'revision_requested' | 'skipped';

export interface LangkahTimeline {
  id: string;
  round: number;
  current_round: boolean;
  step_order: number;
  label: string;
  approver_type: string;
  status: StatusLangkah;
  status_label: string;
  approver: Orang | null;
  delegated_from: Orang | null;
  note: string | null;
  activated_at: string | null;
  decided_at: string | null;
}

export interface RekanAbsen {
  group: string | null;
  size: number;
  people: { id: string; name: string; dates: string[] }[];
}

export interface PratinjauBatal {
  refund_days: number | null;
  balance_year: number | null;
  attendance: {
    removed_dates: string[];
    unlinked_dates: string[];
    overtime_date: string | null;
    correction_date: string | null;
    blocker: string | null;
  };
  past_dates: string[];
  blocker: string | null;
  reason_min: number;
  reason_max: number;
}

export interface NilaiFormServer {
  leave_type_id: string;
  mode: ModeIzin | null;
  start_date: string | null;
  end_date: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  check_in: string | null;
  check_out: string | null;
  half_day: boolean;
  destination: string | null;
  item_name: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  reference_url: string | null;
  urgency: 'biasa' | 'mendesak' | null;
  substitute_id: string | null;
  reason: string | null;
}

export interface DetailPengajuan extends ItemPengajuan {
  reason: string;
  health_details_hidden: boolean;
  substitute: Orang | null;
  attachments: LampiranServer[];
  timeline: LangkahTimeline[];
  /** Tidak ada untuk staf. */
  balance?: { year: number; before: number; after: number; summary: RingkasanSaldo } | null;
  colleagues: RekanAbsen | null;
  cancellation: { by: Orang | null; by_requester: boolean; at: string | null; reason: string | null; after_approval: boolean } | null;
  cancel_preview: PratinjauBatal | null;
  can: {
    edit: boolean;
    cancel: boolean;
    decide: boolean;
    cancel_approved: boolean;
    submit: boolean;
    resubmit: boolean;
    delete: boolean;
    attach: boolean;
    approve: boolean;
    reject: boolean;
    revise: boolean;
  };
  form: NilaiFormServer | null;
}

// ── Jenis & pratinjau ────────────────────────────────────────────────────────

export function daftarJenis(): Promise<DaftarJenis> {
  return apiRequest<DaftarJenis>('pengajuan/jenis').then(wajib);
}

export interface LangkahAlur {
  step_order: number;
  approver_type: string;
  label: string;
  role: string | null;
  status: string;
  approver: Orang | null;
  delegated_from: Orang | null;
  note: string | null;
}

export interface Pratinjau {
  period: { start_at: string; end_at: string; days: number | null; minutes: number | null; work_dates: string[] } | null;
  errors: Record<string, string> | null;
  balance: { year: number; before: number; after: number; enough: boolean; summary: RingkasanSaldo } | null;
  overlap: string | null;
  colleagues: RekanAbsen | null;
  flow: LangkahAlur[];
  attachment_required: boolean;
}

/** Isian yang dikirim ke server (kunci = nama isian form web). */
export type IsianKirim = Record<string, string | number | boolean | null>;

export function pratinjau(isian: IsianKirim, requestId?: string | null): Promise<Pratinjau> {
  const query: Record<string, string | number | boolean | null> = { ...isian };
  if (typeof query.half_day === 'boolean') {
    query.half_day = query.half_day ? 1 : 0;
  }
  if (requestId) {
    query.request_id = requestId;
  }
  return apiRequest<Pratinjau>('pengajuan/pratinjau', { query, timeoutMs: 15_000 }).then(wajib);
}

// ── Daftar ───────────────────────────────────────────────────────────────────

export type FilterStatus = 'semua' | 'menunggu' | 'disetujui' | 'ditolak' | 'revisi' | 'draf' | 'dibatalkan';

export interface KartuSaldo {
  type: JenisPengajuan;
  kind: 'balance' | 'info' | 'ineligible';
  year: number;
  balance: RingkasanSaldo | null;
}

export interface HalamanPengajuan {
  requests: ItemPengajuan[];
  meta: { current_page: number; from: number | null; last_page: number; per_page: number; to: number | null; total: number };
  filter: { status: FilterStatus; jenis: string | null; tahun: number | null };
  counts: Record<FilterStatus, number>;
  /** Hanya non-staf. */
  balances?: KartuSaldo[];
}

export function daftarPengajuanSaya(opsi: { status?: FilterStatus; jenis?: string | null; tahun?: number | null; page?: number }): Promise<HalamanPengajuan> {
  return apiRequest<HalamanPengajuan>('pengajuan', {
    query: { status: opsi.status ?? 'semua', jenis: opsi.jenis ?? undefined, tahun: opsi.tahun ?? undefined, page: opsi.page ?? 1 },
  }).then(wajib);
}

// ── Detail & tindakan ────────────────────────────────────────────────────────

export function detailPengajuan(id: string): Promise<DetailPengajuan> {
  return apiRequest<{ request: DetailPengajuan }>(`pengajuan/${id}`).then((r) => wajib(r).request);
}

/** Berkas lokal yang akan diunggah. */
export interface BerkasLokal {
  uri: string;
  name: string;
  mime: string;
  size: number;
}

function keFormData(isian: IsianKirim, berkas: BerkasLokal[]): FormData {
  const fd = new FormData();
  for (const [kunci, nilai] of Object.entries(isian)) {
    if (nilai === null || nilai === undefined) {
      continue;
    }
    fd.append(kunci, typeof nilai === 'boolean' ? (nilai ? '1' : '0') : String(nilai));
  }
  for (const b of berkas) {
    // React Native FormData menerima objek {uri, name, type}.
    fd.append('attachments[]', { uri: b.uri, name: b.name, type: b.mime } as unknown as Blob);
  }
  return fd;
}

function kirimIsian(path: string, isian: IsianKirim, berkas: BerkasLokal[]): Promise<{ request: DetailPengajuan } | null> {
  return berkas.length > 0
    ? apiRequest<{ request: DetailPengajuan }>(path, { method: 'POST', form: keFormData(isian, berkas), timeoutMs: 120_000 })
    : apiRequest<{ request: DetailPengajuan }>(path, { method: 'POST', json: isian });
}

/** POST /pengajuan — kirim baru (201 `{request: item}`). */
export function kirimBaru(isian: IsianKirim, berkas: BerkasLokal[]): Promise<ItemPengajuan> {
  return kirimIsian('pengajuan', isian, berkas).then((r) => wajib(r).request);
}

/** POST /pengajuan/draf — simpan draf baru (201 `{request: detail}`). */
export function simpanDrafBaru(isian: IsianKirim, berkas: BerkasLokal[]): Promise<DetailPengajuan> {
  return kirimIsian('pengajuan/draf', isian, berkas).then((r) => wajib(r).request);
}

/** PATCH /pengajuan/{id} — ubah draf / pengajuan revisi tanpa mengirim. */
export function ubahPengajuan(id: string, isian: IsianKirim): Promise<DetailPengajuan> {
  return apiRequest<{ request: DetailPengajuan }>(`pengajuan/${id}`, { method: 'PATCH', json: isian }).then((r) => wajib(r).request);
}

/** POST /pengajuan/{id}/kirim — kirim draf. */
export function kirimDraf(id: string, isian: IsianKirim): Promise<DetailPengajuan> {
  return apiRequest<{ request: DetailPengajuan }>(`pengajuan/${id}/kirim`, { method: 'POST', json: isian }).then((r) => wajib(r).request);
}

/** POST /pengajuan/{id}/kirim-ulang — revisi & kirim ulang (putaran + 1). */
export function kirimUlang(id: string, isian: IsianKirim): Promise<DetailPengajuan> {
  return apiRequest<{ request: DetailPengajuan }>(`pengajuan/${id}/kirim-ulang`, { method: 'POST', json: isian }).then((r) => wajib(r).request);
}

/** POST /pengajuan/{id}/batal — dibatalkan pemohon (draf/menunggu/revisi). */
export function batalkanPengajuan(id: string): Promise<DetailPengajuan> {
  return apiRequest<{ request: DetailPengajuan }>(`pengajuan/${id}/batal`, { method: 'POST' }).then((r) => wajib(r).request);
}

/** DELETE /pengajuan/{id} — hapus draf yang belum pernah dikirim (204). */
export async function hapusDraf(id: string): Promise<void> {
  await apiRequest<null>(`pengajuan/${id}`, { method: 'DELETE' });
}

export interface EfekBatal {
  refund_days: number | null;
  balance_year: number | null;
  removed_dates: string[];
  unlinked_dates: string[];
  reclosed_dates: string[];
  overtime_date: string | null;
  correction_date: string | null;
}

/** POST /pengajuan/{id}/batal-disetujui — HR/Super Admin. */
export function batalkanDisetujui(id: string, reason: string): Promise<{ request: DetailPengajuan; effects: EfekBatal }> {
  return apiRequest<{ request: DetailPengajuan; effects: EfekBatal }>(`pengajuan/${id}/batal-disetujui`, { method: 'POST', json: { reason } }).then(wajib);
}

// ── Lampiran ─────────────────────────────────────────────────────────────────

export function unggahLampiran(id: string, berkas: BerkasLokal[]): Promise<DetailPengajuan> {
  return apiRequest<{ request: DetailPengajuan }>(`pengajuan/${id}/lampiran`, { method: 'POST', form: keFormData({}, berkas), timeoutMs: 120_000 }).then(
    (r) => wajib(r).request,
  );
}

export function hapusLampiran(id: string, lampiranId: string): Promise<DetailPengajuan> {
  return apiRequest<{ request: DetailPengajuan }>(`pengajuan/${id}/lampiran/${lampiranId}`, { method: 'DELETE' }).then((r) => wajib(r).request);
}

async function tokenSesi(): Promise<string | null> {
  try {
    const mentah = await SecureStore.getItemAsync('rk.sesi');
    return mentah ? ((JSON.parse(mentah) as { token?: string }).token ?? null) : null;
  } catch {
    return null;
  }
}

function namaAman(nama: string): string {
  return nama.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80) || 'lampiran';
}

/** Unduh lampiran ber-Bearer ke cache aplikasi lalu kembalikan berkasnya (buka lewat `contentUri`). */
export async function unduhLampiran(requestId: string, lampiran: LampiranServer): Promise<File> {
  const token = await tokenSesi();
  if (token === null) {
    throw new ApiError({ status: 401, message: 'Sesi berakhir. Silakan masuk kembali.' });
  }
  const folder = new Directory(Paths.cache, 'pengajuan', requestId);
  if (!folder.exists) {
    folder.create({ intermediates: true, idempotent: true });
  }
  const tujuan = new File(folder, `${lampiran.id}-${namaAman(lampiran.filename)}`);
  if (tujuan.exists) {
    return tujuan;
  }
  try {
    return await File.downloadFileAsync(`${API_URL}/pengajuan/${requestId}/lampiran/${lampiran.id}`, tujuan, {
      headers: { Authorization: `Bearer ${token}`, Accept: lampiran.mime_type || '*/*' },
      idempotent: true,
    });
  } catch (galat) {
    const teks = galat instanceof Error ? galat.message : '';
    const status = /\b(401|403|404|429|5\d\d)\b/.exec(teks)?.[1];
    if (status === '403') {
      throw new ApiError({ status: 403, message: 'Detail kesehatan disembunyikan untuk penyetuju pengganti.' });
    }
    if (status === '404') {
      throw new ApiError({ status: 404, message: 'Lampiran tidak ditemukan.' });
    }
    if (status === '401') {
      throw new ApiError({ status: 401, message: 'Sesi berakhir. Silakan masuk kembali.' });
    }
    if (status !== undefined) {
      throw new ApiError({ status: Number(status), message: 'Server sedang bermasalah. Coba lagi beberapa saat.' });
    }
    throw new ApiError({ status: 0, message: 'Lampiran gagal diunduh. Periksa koneksi internet Anda.' });
  }
}

// ── Pemilih pengganti ────────────────────────────────────────────────────────

/** GET /orang?q= — karyawan aktif (pemilih pengganti cuti). */
export function cariRekan(q: string): Promise<Orang[]> {
  return apiRequest<{ orang: Orang[] }>('orang', { query: { q } }).then((r) => wajib(r).orang);
}
