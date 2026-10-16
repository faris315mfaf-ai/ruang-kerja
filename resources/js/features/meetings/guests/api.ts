import { request } from '../video/api';
import type {
    GuestInfo,
    GuestListReply,
    GuestStatusReply,
    GuestVideoToken,
    LobbyReply,
    OrganizerGuest,
} from './types';

// ---------------------------------------------------------------------------
// Public side: /api/tamu/{token}/* (no session, no CSRF, no cookies)
// ---------------------------------------------------------------------------

/** Failure of a guest endpoint; `code` is the contract's machine code. */
export class GuestApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code: string | null,
        public readonly errors: Record<string, string[]> = {},
        public readonly retryAfter: number | null = null,
    ) {
        super(message);
    }
}

const GUEST_FALLBACK: Record<number, string> = {
    404: 'Tautan tidak berlaku.',
    409: 'Ruang rapat belum bisa dimasuki.',
    410: 'Rapat ini sudah selesai atau tautan sudah kedaluwarsa.',
    422: 'Periksa isian Anda lalu coba lagi.',
    429: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
    503: 'Video RuangKerja belum disiapkan. Hubungi penyelenggara rapat.',
};

function bodyOf(text: string): Record<string, unknown> | null {
    if (text === '') {
        return null;
    }

    try {
        const value: unknown = JSON.parse(text);

        return typeof value === 'object' && value !== null
            ? (value as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

/**
 * Calls a public guest endpoint. The token only travels in the URL path of
 * the request itself: it is never logged, stored or put in another URL.
 */
async function callGuest<T>(
    token: string,
    path: string,
    method: 'GET' | 'POST',
    data?: Record<string, unknown>,
): Promise<T> {
    let response: Response;

    try {
        response = await fetch(
            `/api/tamu/${encodeURIComponent(token)}/${path}`,
            {
                method,
                credentials: 'omit',
                cache: 'no-store',
                referrerPolicy: 'no-referrer',
                headers: {
                    Accept: 'application/json',
                    ...(data ? { 'Content-Type': 'application/json' } : {}),
                },
                ...(data ? { body: JSON.stringify(data) } : {}),
            },
        );
    } catch {
        throw new GuestApiError(
            'Koneksi terputus. Periksa jaringan Anda lalu coba lagi.',
            0,
            null,
        );
    }

    const body = bodyOf(await response.text());

    if (response.ok) {
        return (body ?? {}) as T;
    }

    const errors = (body?.errors ?? {}) as Record<string, string[]>;
    const header = Number(response.headers.get('Retry-After'));
    const fromBody = Number(body?.retry_after);
    const retry = header > 0 ? header : fromBody > 0 ? fromBody : null;

    throw new GuestApiError(
        Object.values(errors)[0]?.[0] ??
            (typeof body?.message === 'string' && body.message !== ''
                ? body.message
                : (GUEST_FALLBACK[response.status] ??
                  'Terjadi kesalahan. Coba lagi sebentar lagi.')),
        response.status,
        typeof body?.code === 'string' ? body.code : null,
        errors,
        retry,
    );
}

export const guestApi = {
    info: (token: string) => callGuest<GuestInfo>(token, 'info', 'GET'),

    requestAdmission: (token: string, name: string) =>
        callGuest<GuestStatusReply>(token, 'minta-masuk', 'POST', { name }),

    status: (token: string) =>
        callGuest<GuestStatusReply>(token, 'status', 'GET'),

    token: (token: string) =>
        callGuest<GuestVideoToken>(token, 'token', 'POST', {}),
};

// ---------------------------------------------------------------------------
// Organizer / internal side (session + CSRF, same client as the video room)
// ---------------------------------------------------------------------------

function withDate(url: string, date: string | null): string {
    return date ? `${url}?tanggal=${encodeURIComponent(date)}` : url;
}

export const meetingGuestsApi = {
    list: (meetingId: string, date: string | null) =>
        request<GuestListReply>(
            'get',
            withDate(`/rapat/${meetingId}/tamu`, date),
        ),

    add: (
        meetingId: string,
        date: string | null,
        input: { email: string; name?: string | null },
    ) =>
        request<{ guest: OrganizerGuest }>(
            'post',
            withDate(`/rapat/${meetingId}/tamu`, date),
            {
                email: input.email,
                ...(input.name ? { name: input.name } : {}),
            },
        ),

    rotate: (meetingId: string, date: string | null, guestId: string) =>
        request<{ guest: OrganizerGuest }>(
            'post',
            withDate(`/rapat/${meetingId}/tamu/${guestId}/putar`, date),
        ),

    revoke: (meetingId: string, date: string | null, guestId: string) =>
        request<{ ok: boolean }>(
            'delete',
            withDate(`/rapat/${meetingId}/tamu/${guestId}`, date),
        ),

    lobby: (meetingId: string, date: string | null) =>
        request<LobbyReply>(
            'get',
            withDate(`/rapat/${meetingId}/video/ruang-tunggu`, date),
        ),

    admit: (meetingId: string, date: string | null, guestId: string) =>
        request<{ guest: { id: string; status: string } }>(
            'post',
            withDate(
                `/rapat/${meetingId}/video/ruang-tunggu/${guestId}/izinkan`,
                date,
            ),
        ),

    deny: (meetingId: string, date: string | null, guestId: string) =>
        request<{ guest: { id: string; status: string } }>(
            'post',
            withDate(
                `/rapat/${meetingId}/video/ruang-tunggu/${guestId}/tolak`,
                date,
            ),
        ),
};
