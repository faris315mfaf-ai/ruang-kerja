import { http } from '@inertiajs/react';
import { ApiError } from '@/features/tasks/lib/api';
import videoRoutes from '@/routes/meetings/video';
import type { Minutes } from '../types';
import type {
    MinutesCollabToken,
    MinutesEditingHolder,
    OwnAttributes,
    NotesSource,
    NotesSourceKind,
    NotJoined,
    RemovedParticipant,
    SpeakingTotals,
    VideoAttendee,
    VideoToken,
} from './types';

type Method = 'get' | 'post' | 'put' | 'delete';

const FALLBACK: Record<number, string> = {
    403: 'Anda tidak punya akses untuk melakukan ini.',
    404: 'Ruang rapat tidak ditemukan.',
    409: 'Keadaan sudah berubah. Muat ulang halaman.',
    419: 'Sesi berakhir. Muat ulang halaman lalu coba lagi.',
    429: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
    502: 'Server rapat tidak menjawab. Coba lagi.',
    503: 'Video RuangKerja belum disiapkan di server ini. Hubungi admin.',
};

function parse(data: unknown): Record<string, unknown> | null {
    if (typeof data === 'object' && data !== null) {
        return data as Record<string, unknown>;
    }

    if (typeof data !== 'string' || data === '') {
        return null;
    }

    try {
        return JSON.parse(data) as Record<string, unknown>;
    } catch {
        return null;
    }
}

/** ApiError + `retry_after` (seconds) of a 429 (Panggil cooldown). */
export class RoomApiError extends ApiError {
    constructor(
        message: string,
        status: number,
        errors: Record<string, string[]>,
        public readonly retryAfter: number | null,
    ) {
        super(message, status, errors);
    }
}

function failure(status: number, data: unknown): ApiError {
    const body = parse(data);
    const errors = (body?.errors ?? {}) as Record<string, string[]>;
    const message =
        Object.values(errors)[0]?.[0] ??
        (typeof body?.message === 'string' && body.message !== ''
            ? body.message
            : undefined) ??
        FALLBACK[status] ??
        'Terjadi kesalahan. Coba lagi sebentar lagi.';

    const retry = Number(body?.retry_after);

    return new RoomApiError(
        message,
        status,
        errors,
        Number.isFinite(retry) && retry > 0 ? retry : null,
    );
}

/**
 * JSON request with the server's own message on failure (the policy says
 * *why*: "Ruang rapat dibuka pukul 09.45."). CSRF via the XSRF cookie.
 */
export async function request<T>(
    method: Method,
    url: string,
    data?: Record<string, unknown>,
): Promise<T> {
    try {
        const response = await http.getClient().request({
            method,
            url,
            data,
            headers: { Accept: 'application/json' },
        });

        return parse(response.data) as T;
    } catch (error) {
        const response =
            typeof error === 'object' && error !== null && 'response' in error
                ? (error as { response?: { status?: unknown; data?: unknown } })
                      .response
                : undefined;

        if (response && typeof response.status === 'number') {
            throw failure(response.status, response.data);
        }

        throw new ApiError(
            'Koneksi terputus. Periksa jaringan Anda lalu coba lagi.',
            0,
        );
    }
}

/** XSRF token from the cookie Laravel sets (for `keepalive` requests). */
function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

/**
 * POST that survives page unload (leaving the room): `fetch` with
 * `keepalive`; `sendBeacon` cannot carry the CSRF header (contract §3.2).
 */
export function postKeepalive(url: string, data: Record<string, unknown>) {
    return fetch(url, {
        method: 'POST',
        keepalive: true,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': xsrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(data),
    }).catch(() => undefined);
}

export type AttendanceRoster = {
    attendance: VideoAttendee[];
    in_room: number;
    not_joined: NotJoined[];
    late_grace_minutes: number;
    removed?: RemovedParticipant[];
};

/**
 * routes/meetings.php › video.* (MeetingVideoController) and the room
 * endpoints of docs/fitur/rapat-video-kontrak.md, called with the `links`
 * the server puts in the props (no hard-coded URLs for new endpoints).
 */
export const videoApi = {
    token: (meetingId: string, date: string) =>
        request<VideoToken>('post', videoRoutes.token(meetingId).url, {
            tanggal: date,
        }),

    mute: (
        meetingId: string,
        date: string,
        identity: string,
        trackSid: string,
    ) =>
        request<{ ok: boolean }>(
            'post',
            videoRoutes.mute({ meeting: meetingId, identity }).url,
            { tanggal: date, track_sid: trackSid },
        ),

    remove: (meetingId: string, date: string, identity: string) =>
        request<{ ok: boolean }>(
            'delete',
            videoRoutes.remove({ meeting: meetingId, identity }).url,
            { tanggal: date },
        ),

    /** contract §1.4 › GET links.data */
    minutes: (url: string) => request<{ minutes: Minutes }>('get', url),

    /** contract §2.2 */
    chooseNotesSource: (url: string, source: NotesSourceKind) =>
        request<{
            applied: boolean;
            notes_source: NotesSource;
            minutes: Minutes;
        }>('post', url, { source }),

    /** contract §3.1 */
    speaking: (url: string) => request<SpeakingTotals>('get', url),

    /** contract §3.2: my own accumulated speaking time. */
    reportSpeaking: (url: string, ms: number) =>
        request<SpeakingTotals & { accepted_ms: number }>('post', url, {
            ms: Math.round(ms),
        }),

    /** contract §4.1 */
    attendance: (url: string) => request<AttendanceRoster>('get', url),

    /** Raise/lower my hand; the server sets the LiveKit attribute (R-05). */
    hand: (url: string, raised: boolean) =>
        request<{ hand: string }>('post', url, { raised }),

    /** Own LiveKit attributes through the server (tokens cannot set them). */
    attributes: (url: string, attributes: OwnAttributes) =>
        request<{ attributes: OwnAttributes }>('post', url, { attributes }),

    /** Organizer: let a removed person join again. */
    readmit: (template: string, userId: string) =>
        request<{ readmitted: boolean }>(
            'delete',
            template.replace('{user}', encodeURIComponent(userId)),
        ),

    /** autosave mode: "X sedang menyunting" heartbeat. */
    editing: (url: string, active: boolean) =>
        request<{ editing: MinutesEditingHolder | null }>('post', url, {
            active,
        }),

    /** collab mode: token for the Yjs document of the minutes. */
    collabToken: (url: string) => request<MinutesCollabToken>('get', url),

    /** contract §4.2 — `{user}` in the link is replaced by the person's id. */
    call: (template: string, userId: string) =>
        request<{
            called: { user_id: string; called_at: string; called_by: string };
        }>('post', template.replace('{user}', encodeURIComponent(userId))),
};
