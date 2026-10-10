/**
 * Klien HTTP API RuangKerja (/api/v1). Pembungkus fetch dengan token Bearer,
 * galat berbahasa Indonesia, multipart, dan 401 → sesi dianggap berakhir
 * (callback terdaftar oleh SessionProvider memaksa keluar).
 */

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://spkd.store/api/v1';

/** Galat API: pesan siap tampil, status HTTP, kode (403), errors (422). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly reason: string | null;
  readonly context: Record<string, unknown> | null;
  readonly errors: Record<string, string[]>;

  constructor(init: {
    status: number;
    message: string;
    code?: string | null;
    reason?: string | null;
    context?: Record<string, unknown> | null;
    errors?: Record<string, string[]>;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code ?? null;
    this.reason = init.reason ?? null;
    this.context = init.context ?? null;
    this.errors = init.errors ?? {};
  }

  /** Pesan validasi pertama (422 Laravel) bila ada. */
  get firstValidationError(): string | null {
    const first = Object.values(this.errors)[0];
    return first?.[0] ?? null;
  }
}

/** Terpanggil sekali saat server menjawab 401 — dipakai SessionProvider. */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
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
}

/**
 * Permintaan JSON ke API. Melempar ApiError untuk semua kegagalan
 * (termasuk jaringan — status 0), mengembalikan hasil parse JSON,
 * atau null untuk 204.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
  const { method = 'GET', json, form, query, timeoutMs = 30_000 } = options;

  const url = new URL(path.startsWith('http') ? path : `${API_URL}/${path.replace(/^\//, '')}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
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
    onUnauthorized?.();
    throw new ApiError({ status: 401, message: 'Sesi berakhir. Silakan masuk kembali.' });
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
    });
  }

  return (body ?? null) as T | null;
}

/** Ambil byte file lokal sebagai lampiran FormData (selfie). */
export function formFile(uri: string, name: string, mime = 'image/jpeg'): { uri: string; name: string; type: string } {
  return { uri, name, type: mime };
}
