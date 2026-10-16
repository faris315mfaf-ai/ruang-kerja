/**
 * Pure helpers of the external-guest flow (no React, no network): identity
 * and name rules, session state machine, polling back-off and the window /
 * screen decisions. Tested in lib.test.ts. Contract:
 * docs/sesi/rapat-tamu-eksternal.md.
 */
import { formatTime } from '@/lib/format';
import { countdownLabel } from '../video/lib';
import type {
    GuestInfo,
    GuestStatus,
    GuestStatusReply,
    GuestWindow,
    GuestWindowState,
} from './types';

// ---------------------------------------------------------------------------
// Identity and names
// ---------------------------------------------------------------------------

/** LiveKit identity of a guest: `guest:{participant ULID}`. */
export const GUEST_IDENTITY_PREFIX = 'guest:';

export function isGuestIdentity(identity: string): boolean {
    return identity.startsWith(GUEST_IDENTITY_PREFIX);
}

/** "Budi Mitra (Tamu)" → "Budi Mitra" (the server always appends it). */
export function stripGuestSuffix(name: string): string {
    return name.replace(/\s*\(\s*tamu\s*\)\s*$/i, '').trim();
}

export const GUEST_NAME_MIN = 2;
export const GUEST_NAME_MAX = 60;

/**
 * What the server will keep of a typed name: tags dropped, whitespace
 * collapsed, the word "(Tamu)" removed (it is always added server side).
 */
export function cleanGuestName(raw: string): string {
    return raw
        .replace(/<[^>]*>/g, '')
        .replace(/\(\s*tamu\s*\)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Error text for a typed name, or null when it is fine. */
export function validateGuestName(raw: string): string | null {
    const name = cleanGuestName(raw);

    if (name === '') {
        return 'Tulis nama Anda agar penyelenggara tahu siapa yang meminta masuk.';
    }

    if (Array.from(name).length < GUEST_NAME_MIN) {
        return `Nama minimal ${GUEST_NAME_MIN} karakter.`;
    }

    if (Array.from(name).length > GUEST_NAME_MAX) {
        return `Nama maksimal ${GUEST_NAME_MAX} karakter.`;
    }

    return null;
}

/** Optional name field of the organizer's add-guest form (empty is fine). */
export function validateOptionalGuestName(raw: string): string | null {
    return raw.trim() === '' ? null : validateGuestName(raw);
}

// ---------------------------------------------------------------------------
// Status and window
// ---------------------------------------------------------------------------

/** After these there is nothing to wait for: polling stops. */
export function isFinalStatus(status: GuestStatus): boolean {
    return (
        status === 'denied' ||
        status === 'removed' ||
        status === 'expired' ||
        status === 'closed' ||
        status === 'unknown'
    );
}

/**
 * Where `now` falls in the join window (guests have no organizer exception:
 * 15 minutes before the start until the close). Falls back to the state the
 * server reported when there is no window.
 */
export function liveWindowState(
    window: Pick<GuestWindow, 'opens_at' | 'closes_at'> | null | undefined,
    reported: GuestWindowState | null,
    now: number,
): GuestWindowState | null {
    if (!window) {
        return reported;
    }

    const opens = Date.parse(window.opens_at);
    const closes = Date.parse(window.closes_at);

    if (Number.isNaN(opens) || Number.isNaN(closes)) {
        return reported;
    }

    return now < opens ? 'early' : now > closes ? 'closed' : 'open';
}

export type WindowNotice = {
    tone: 'info' | 'danger';
    text: string;
};

/**
 * Message when the room cannot be asked yet / any more, or null when open.
 * Times are shown in the office timezone with an explicit "WIB".
 */
export function windowNotice(
    window: GuestWindow | null | undefined,
    state: GuestWindowState | null,
    now: number,
): WindowNotice | null {
    if (state === 'early') {
        const opens = window ? Date.parse(window.opens_at) : Number.NaN;

        return {
            tone: 'info',
            text: Number.isNaN(opens)
                ? 'Ruang rapat belum dibuka. Coba lagi mendekati jam mulai.'
                : `Ruang rapat dibuka pukul ${formatTime(opens)} WIB. ${countdownLabel(opens - now)}.`,
        };
    }

    if (state === 'closed') {
        return {
            tone: 'danger',
            text: 'Waktu masuk rapat ini sudah lewat. Minta tautan baru kepada penyelenggara bila rapat masih berlangsung.',
        };
    }

    return null;
}

/** Which screen a status calls for. */
export type GuestScreen =
    | 'form'
    | 'waiting'
    | 'admitted'
    | 'denied'
    | 'removed'
    | 'expired'
    | 'closed'
    | 'unknown';

export function screenFor(status: GuestStatus): GuestScreen {
    switch (status) {
        case 'none':
            return 'form';
        case 'waiting':
            return 'waiting';
        case 'admitted':
            return 'admitted';
        default:
            return status;
    }
}

// ---------------------------------------------------------------------------
// Session state machine
// ---------------------------------------------------------------------------

export type GuestSession = {
    status: GuestStatus;
    statusLabel: string;
    /** Window state as last reported by the server. */
    window: GuestWindowState | null;
    /** Consecutive polling failures (network / 5xx / 429), for back-off. */
    failures: number;
    /** Seconds the server asked us to wait (Retry-After), if any. */
    retryAfter: number | null;
};

export type GuestSessionEvent =
    | { type: 'reply'; reply: GuestStatusReply }
    | { type: 'final'; status: GuestStatus; label: string }
    | { type: 'failed'; retryAfter?: number | null };

export function initialSession(info: GuestInfo): GuestSession {
    return {
        status: info.status,
        statusLabel: info.status_label,
        window: info.window?.state ?? null,
        failures: 0,
        retryAfter: null,
    };
}

/**
 * Reducer of the guest session. A failed poll never throws away the status
 * we already know (a network blip while waiting must not look like a
 * rejection); it only increments the back-off counter.
 */
export function reduceSession(
    session: GuestSession,
    event: GuestSessionEvent,
): GuestSession {
    switch (event.type) {
        case 'reply':
            return {
                status: event.reply.status,
                statusLabel: event.reply.status_label,
                window: event.reply.window ?? session.window,
                failures: 0,
                retryAfter: null,
            };
        case 'final':
            return {
                ...session,
                status: event.status,
                statusLabel: event.label,
                failures: 0,
                retryAfter: null,
            };
        case 'failed':
            return {
                ...session,
                failures: session.failures + 1,
                retryAfter: event.retryAfter ?? null,
            };
    }
}

const POLL_MIN_SECONDS = 2;
const POLL_MAX_SECONDS = 30;
const RETRY_AFTER_CAP_SECONDS = 60;

/**
 * Delay before the next status poll: the server's `poll_seconds` (default 3),
 * doubled per consecutive failure up to 30 s, never shorter than a
 * `Retry-After` the server asked for (capped at 60 s).
 */
export function pollDelayMs(session: {
    pollSeconds?: number;
    failures: number;
    retryAfter: number | null;
}): number {
    const base = Math.min(
        POLL_MAX_SECONDS,
        Math.max(POLL_MIN_SECONDS, session.pollSeconds ?? 3),
    );
    const backoff = Math.min(
        POLL_MAX_SECONDS,
        base * 2 ** Math.min(session.failures, 6),
    );
    const asked = Math.min(RETRY_AFTER_CAP_SECONDS, session.retryAfter ?? 0);

    return Math.max(backoff, asked) * 1000;
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/**
 * A guest link for display only ("ruangkerja.test/tamu/01jb…x9Qa"): the
 * secret is never shown in full in a list; "Salin tautan" copies the real one.
 */
export function maskGuestLink(url: string): string {
    try {
        const parsed = new URL(url);
        const token = parsed.pathname.split('/').filter(Boolean).pop() ?? '';

        return `${parsed.host}/tamu/${token.slice(0, 4)}…${token.slice(-4)}`;
    } catch {
        return 'Tautan tamu';
    }
}

/** Display name of a guest of the organizer's list (name, else the e-mail). */
export function guestLabel(guest: {
    name: string | null;
    email: string | null;
}): string {
    return guest.name?.trim() || guest.email || 'Tamu';
}

/** Short label for the lobby badge: "1 tamu menunggu", "3 tamu menunggu". */
export function waitingLabel(count: number): string {
    return count === 0 ? 'Tidak ada yang menunggu' : `${count} tamu menunggu`;
}

/** New names in a waiting list compared to the one already seen. */
export function newlyWaiting(
    previous: ReadonlySet<string>,
    waiting: { id: string; name: string | null; email: string | null }[],
): { id: string; name: string | null; email: string | null }[] {
    return waiting.filter((entry) => !previous.has(entry.id));
}
