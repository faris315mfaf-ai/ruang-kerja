/**
 * Klien HTTP API RuangKerja (/api/v1). Pembungkus fetch dengan token Bearer,
 * galat berbahasa Indonesia, multipart, dan 401 → sesi dianggap berakhir
 * (callback terdaftar oleh SessionProvider memaksa keluar).
 */

import Constants from 'expo-constants';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://spkd.store/api/v1';

/**
 * Asal aplikasi web (https://host) diturunkan dari EXPO_PUBLIC_API_URL
 * (https://host/api/v1) — dipakai Linking untuk tautan yang menuntut sesi
 * web: gabung rapat video (`/rapat/{id}/gabung`) dsb.
 */
export function webBase(): string {
  return API_URL.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
}

/** Versi aplikasi yang dikirim di header `X-App-Version` pada setiap permintaan. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '1.0.0';

/** Galat API: pesan siap tampil, status HTTP, kode (403), errors (422). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly reason: string | null;
  readonly context: Record<string, unknown> | null;
  readonly errors: Record<string, string[]>;
  /** Detik tunggu dari header Retry-After (429/503), bila ada. */
  readonly retryAfter: number | null;

  constructor(init: {
    status: number;
    message: string;
    code?: string | null;
    reason?: string | null;
    context?: Record<string, unknown> | null;
    errors?: Record<string, string[]>;
    retryAfter?: number | null;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code ?? null;
    this.reason = init.reason ?? null;
    this.context = init.context ?? null;
    this.errors = init.errors ?? {};
    this.retryAfter = init.retryAfter ?? null;
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

let tokenGetter: (() => string | null) | null = null;

export function setTokenGetter(getter: (() => string | null) | null): void {
  tokenGetter = getter;
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
}

/**
 * Permintaan JSON ke API. Melempar ApiError untuk semua kegagalan
 * (termasuk jaringan — status 0), mengembalikan hasil parse JSON,
 * atau null untuk 204.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
  const { method = 'GET', json, form, query, timeoutMs = 30_000, headers: extraHeaders } = options;

  const url = new URL(path.startsWith('http') ? path : `${API_URL}/${path.replace(/^\//, '')}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json', 'X-App-Version': APP_VERSION, ...extraHeaders };
  const token = tokenGetter?.();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError({
      status: 0,
      message: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.',
    });
  } finally {
    clearTimeout(timer);
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
    if (token) {
      onUnauthorized?.(pesan401);
    }
    throw new ApiError({ status: 401, message: pesan401 ?? 'Sesi berakhir. Silakan masuk kembali.' });
  }

  if (response.status === 204) {
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
    if (response.status === 426 && data.code === 'update_required') {
      onAppStatus?.({
        kind: 'update_required',
        message: data.message ?? 'Versi aplikasi ini tidak lagi didukung. Perbarui RuangKerja untuk melanjutkan.',
        minVersion: (data as { min_app_version?: string }).min_app_version ?? null,
      });
    }
    if (response.status === 503 && data.code === 'maintenance') {
      onAppStatus?.({
        kind: 'maintenance',
        message: data.message ?? 'RuangKerja sedang dalam pemeliharaan. Coba lagi beberapa saat lagi.',
      });
    }
    if (response.status === 403 && token && data.code !== undefined && KODE_BLOKIR.includes(data.code)) {
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

  return (body ?? null) as T | null;
}

/** Ambil byte file lokal sebagai lampiran FormData (selfie). */
export function formFile(uri: string, name: string, mime = 'image/jpeg'): { uri: string; name: string; type: string } {
  return { uri, name, type: mime };
}
