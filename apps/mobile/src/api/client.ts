/**
 * Klien HTTP API RuangKerja (/api/v1). Pembungkus fetch dengan token Bearer,
 * galat berbahasa Indonesia, multipart, dan 401 → sesi dianggap berakhir
 * (callback terdaftar oleh SessionProvider memaksa keluar).
 */

import { File } from 'expo-file-system';

import { API_URL, APP_VERSION } from '@/api/config';
import { bersihBasi, catatBasi } from '@/offline/basi';
import { bacaCache, bolehCache, cacheAktif, kunciCache, tulisCache } from '@/offline/cache';
import { gagalCepat, laporBerhasil, laporGagal, periksaSegera, timeoutEfektif } from '@/offline/jaringan';

export { API_URL, APP_VERSION };

/**
 * Asal aplikasi web (https://host) diturunkan dari EXPO_PUBLIC_API_URL
 * (https://host/api/v1) — dipakai Linking untuk tautan yang menuntut sesi
 * web: gabung rapat video (`/rapat/{id}/gabung`) dsb.
 */
export function webBase(): string {
  return API_URL.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
}

/** Galat API: pesan siap tampil, status HTTP, kode (403), errors (422). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly reason: string | null;
  readonly context: Record<string, unknown> | null;
  readonly errors: Record<string, string[]>;
  /** Detik tunggu dari header Retry-After (429/503), bila ada. */
  readonly retryAfter: number | null;
  /** `true` bila galat status 0 berasal dari jaringan/server tak terjangkau (bukan galat server). */
  readonly offline: boolean;

  constructor(init: {
    status: number;
    message: string;
    code?: string | null;
    reason?: string | null;
    context?: Record<string, unknown> | null;
    errors?: Record<string, string[]>;
    retryAfter?: number | null;
    offline?: boolean;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code ?? null;
    this.reason = init.reason ?? null;
    this.context = init.context ?? null;
    this.errors = init.errors ?? {};
    this.retryAfter = init.retryAfter ?? null;
    this.offline = init.offline ?? init.status === 0;
  }

  /** Pesan validasi pertama (422 Laravel) bila ada. */
  get firstValidationError(): string | null {
    const first = Object.values(this.errors)[0];
    return first?.[0] ?? null;
  }
}

/** Terpanggil saat server menjawab 401 untuk permintaan bertoken — dipakai SessionProvider. `message` = pesan server (mis. akun tidak aktif). */
let onUnauthorized: ((message: string | null) => void) | null = null;

export function setUnauthorizedHandler(handler: ((message: string | null) => void) | null): void {
  onUnauthorized = handler;
}

/** Status tingkat-aplikasi dari server: aplikasi terlalu lama (426) atau pemeliharaan (503). */
export type StatusAplikasi =
  | { kind: 'update_required'; message: string; minVersion: string | null }
  | { kind: 'maintenance'; message: string };

let onAppStatus: ((status: StatusAplikasi) => void) | null = null;

export function setAppStatusHandler(handler: ((status: StatusAplikasi) => void) | null): void {
  onAppStatus = handler;
}

/** Account-level blocks the server may answer any authenticated call with (403). */
export type KodeBlokirAkun = 'password_change_required' | 'two_factor_setup_required';

export interface BlokirAkun {
  code: KodeBlokirAkun;
  message: string;
}

const KODE_BLOKIR: readonly string[] = ['password_change_required', 'two_factor_setup_required'];

/** Called when an authenticated request is refused with an account block — used by SessionProvider. */
let onAccountBlocked: ((blokir: BlokirAkun) => void) | null = null;

export function setAccountBlockedHandler(handler: ((blokir: BlokirAkun) => void) | null): void {
  onAccountBlocked = handler;
}

/**
 * Pendengar mutasi sukses (POST/PUT/PATCH/DELETE 2xx) dengan path relatif API — dipakai
 * pemicu pembaruan widget layar utama (`src/widget/penyegar.ts`). Tidak boleh melempar.
 */
let onMutasiBerhasil: ((method: string, path: string) => void) | null = null;

export function setPendengarMutasi(pendengar: ((method: string, path: string) => void) | null): void {
  onMutasiBerhasil = pendengar;
}

let tokenGetter: (() => string | null) | null = null;

export function setTokenGetter(getter: (() => string | null) | null): void {
  tokenGetter = getter;
}

/**
 * Token cadangan untuk sinkron latar belakang tanpa UI (tidak ada SessionProvider
 * yang memasang `tokenGetter`). Getter sesi React selalu didahulukan, jadi
 * pengaturan/pencabutan di sini tidak pernah menimpa sesi yang sedang hidup.
 */
let tokenSementara: string | null = null;

export function setTokenSementara(token: string | null): void {
  tokenSementara = token;
}

/** Token sesi saat ini (untuk sumber gambar RN yang butuh header Authorization, mis. ubin peta). */
export function tokenSaatIni(): string | null {
  return tokenGetter?.() ?? tokenSementara;
}

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Body JSON (Content-Type application/json). */
  json?: unknown;
  /** Body multipart (check-in/out selfie). */
  form?: FormData;
  query?: Record<string, QueryValue>;
  /** Batas waktu permintaan (ms). */
  timeoutMs?: number;
  /** Header tambahan (mis. X-Reset-Token). */
  headers?: Record<string, string>;
  /** `false` = lewati cache baca untuk permintaan GET ini (tidak membaca/menulis). Bawaan: ikut daftar putih `src/offline/cache.ts`. */
  cache?: boolean;
  /** Dikirim sebagai header `Idempotency-Key` (dipakai antrean offline: id klien item). */
  idempotencyKey?: string;
  /** Diisi klien: info tambahan tentang jawaban (mis. `dariCache`, `replayed`). */
  hasil?: HasilPermintaan;
  /**
   * `true` = jangan memicu penangan tingkat-aplikasi (401 → sesi berakhir, blokir akun,
   * 426/503). Dipakai sinkron latar belakang: tidak boleh mengeluarkan pengguna atau
   * menampilkan dialog dari proses tanpa layar; galatnya tetap dilempar ke pemanggil.
   */
  senyap?: boolean;
}

/** Keluaran tambahan `apiRequest` lewat `options.hasil`. */
export interface HasilPermintaan {
  /** Jawaban berasal dari cache karena jaringan gagal. */
  dariCache?: boolean;
  /** Epoch ms data cache disimpan (bila `dariCache`). */
  cachedAt?: number;
  /** Server membalas ulang hasil idempoten (header `Idempotent-Replayed: true`). */
  replayed?: boolean;
  /** Kode status HTTP sukses. */
  status?: number;
}

const PESAN_OFFLINE = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.';
const AWALAN_API = new URL(API_URL).pathname.replace(/\/+$/, '');

function galatOffline(): ApiError {
  return new ApiError({ status: 0, message: PESAN_OFFLINE, offline: true });
}

/**
 * Permintaan JSON ke API. Melempar ApiError untuk semua kegagalan
 * (termasuk jaringan — status 0), mengembalikan hasil parse JSON,
 * atau null untuk 204.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
  const { method = 'GET', json, form, query, timeoutMs = 30_000, headers: extraHeaders, cache: pakaiCache, idempotencyKey, hasil, senyap = false } = options;

  const url = new URL(path.startsWith('http') ? path : `${API_URL}/${path.replace(/^\//, '')}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  // Cache baca (stale-while-revalidate): hanya GET pada path daftar putih, hanya bila ada pengguna aktif.
  const relatif = url.pathname.startsWith(AWALAN_API) ? url.pathname.slice(AWALAN_API.length) : url.pathname;
  const kunci = method === 'GET' && pakaiCache !== false && cacheAktif() && bolehCache(relatif) ? kunciCache(relatif, url.searchParams) : null;

  const sajikanDariCache = async <R,>(): Promise<R | null | undefined> => {
    if (kunci === null) {
      return undefined;
    }
    const entri = await bacaCache(kunci);
    if (entri === null) {
      return undefined;
    }
    try {
      const data = JSON.parse(entri.body) as R;
      catatBasi(kunci, entri.ts);
      if (hasil) {
        hasil.dariCache = true;
        hasil.cachedAt = entri.ts;
      }
      return data;
    } catch {
      return undefined;
    }
  };

  // Jaringan sudah diketahui mati: jangan menggantung — salinan cache bila ada, selain itu gagal cepat.
  if (gagalCepat()) {
    void periksaSegera();
    const basi = await sajikanDariCache<T>();
    if (basi !== undefined) {
      return basi;
    }
    throw galatOffline();
  }

  const headers: Record<string, string> = { Accept: 'application/json', 'X-App-Version': APP_VERSION, ...extraHeaders };
  const token = tokenGetter?.() ?? tokenSementara;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutEfektif(timeoutMs));

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
      signal: controller.signal,
    });
  } catch {
    laporGagal();
    const basi = await sajikanDariCache<T>();
    if (basi !== undefined) {
      return basi;
    }
    throw galatOffline();
  } finally {
    clearTimeout(timer);
  }
  laporBerhasil();
  if (hasil) {
    hasil.status = response.status;
    hasil.replayed = response.headers.get('Idempotent-Replayed') === 'true';
  }

  if (response.status === 401) {
    let pesan401: string | null = null;
    try {
      const b401 = (await response.json()) as { message?: string };
      // Hanya pesan khusus akun (nonaktif) yang dipakai; "Unauthenticated." bawaan Laravel dibuang.
      pesan401 = typeof b401.message === 'string' && /tidak aktif|nonaktif/i.test(b401.message) ? b401.message : null;
    } catch {
      pesan401 = null;
    }
    if (token && !senyap) {
      onUnauthorized?.(pesan401);
    }
    throw new ApiError({ status: 401, message: pesan401 ?? 'Sesi berakhir. Silakan masuk kembali.' });
  }

  // Mutasi sukses (2xx) dikabarkan ke pendengar (pembaruan widget layar utama), tanpa pernah mengganggu permintaan.
  const kabarMutasi = (): void => {
    if (method === 'GET') {
      return;
    }
    try {
      onMutasiBerhasil?.(method, relatif.replace(/^\/+/, ''));
    } catch {
      // Pendengar tidak boleh melempar.
    }
  };

  if (response.status === 204) {
    kabarMutasi();
    return null;
  }

  let body: unknown = null;
  const text = await response.text();
  if (text !== '') {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const data = (body ?? {}) as {
      message?: string;
      code?: string;
      reason?: string;
      context?: Record<string, unknown>;
      errors?: Record<string, string[]>;
    };
    if (!senyap && response.status === 426 && data.code === 'update_required') {
      onAppStatus?.({
        kind: 'update_required',
        message: data.message ?? 'Versi aplikasi ini tidak lagi didukung. Perbarui RuangKerja untuk melanjutkan.',
        minVersion: (data as { min_app_version?: string }).min_app_version ?? null,
      });
    }
    if (!senyap && response.status === 503 && data.code === 'maintenance') {
      onAppStatus?.({
        kind: 'maintenance',
        message: data.message ?? 'RuangKerja sedang dalam pemeliharaan. Coba lagi beberapa saat lagi.',
      });
    }
    if (!senyap && response.status === 403 && token && data.code !== undefined && KODE_BLOKIR.includes(data.code)) {
      onAccountBlocked?.({
        code: data.code as KodeBlokirAkun,
        message: data.message ?? 'Akun Anda perlu tindakan di RuangKerja web sebelum aplikasi bisa dipakai.',
      });
    }
    throw new ApiError({
      status: response.status,
      message:
        data.message ??
        (response.status >= 500
          ? 'Server sedang bermasalah. Coba lagi beberapa saat.'
          : 'Permintaan gagal. Coba lagi.'),
      code: data.code ?? null,
      reason: data.reason ?? null,
      context: data.context ?? null,
      errors: data.errors ?? {},
      retryAfter: Number.isFinite(Number(response.headers.get('Retry-After'))) && response.headers.get('Retry-After') !== null ? Number(response.headers.get('Retry-After')) : null,
    });
  }

  kabarMutasi();

  if (kunci !== null && text !== '' && body !== null) {
    tulisCache(kunci, text);
    bersihBasi(kunci);
  }

  return (body ?? null) as T | null;
}

/**
 * Lampiran FormData dari berkas lokal. Berisi `uri` (FormData native React Native)
 * sekaligus `bytes()` (fetch bawaan Expo — `convertFormData` menolak bagian yang
 * hanya punya `uri`, galatnya "Unsupported FormDataPart implementation").
 */
export function formFile(uri: string, name: string, mime = 'image/jpeg'): { uri: string; name: string; type: string; bytes: () => Promise<Uint8Array> } {
  return { uri, name, type: mime, bytes: () => new File(uri).bytes() };
}
