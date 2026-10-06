import { useSyncExternalStore } from 'react';

/**
 * "Mode catat" (keputusan pemilik 6 Okt 2026): while minutes are being
 * taken, the session survives navigation to other modules. It lives in
 * localStorage (per device, shared by browser tabs through the `storage`
 * event) and belongs to one signed-in user. Only "Selesai mencatat" in the
 * editor ends it (or the note becoming unavailable). Every storage access
 * is wrapped: without storage the mode lasts for this page only.
 */
export const SESSION_KEY = 'rk.notes.session.v1';

export type MinutesSession = {
    userId: string;
    /** Open tab (the note or one of its document tabs). */
    noteId: string;
    /** The document (top note) the tabs belong to. */
    rootId: string;
    /** Title of the document, shown on the pill. */
    title: string;
    startedAt: string;
};

let memory: string | null = null;
let cachedRaw: string | null = null;
let cached: MinutesSession | null = null;
const listeners = new Set<() => void>();

function readRaw(): string | null {
    try {
        return window.localStorage.getItem(SESSION_KEY);
    } catch {
        return memory;
    }
}

function writeRaw(value: string | null): void {
    memory = value;

    try {
        if (value === null) {
            window.localStorage.removeItem(SESSION_KEY);
        } else {
            window.localStorage.setItem(SESSION_KEY, value);
        }
    } catch {
        // Kept in memory only.
    }

    listeners.forEach((listener) => listener());
}

function isId(value: unknown): value is string {
    return typeof value === 'string' && /^[0-9a-z]{26}$/i.test(value);
}

/** Parsed session, null when missing or damaged. */
export function parseSession(raw: string | null): MinutesSession | null {
    if (raw === null) {
        return null;
    }

    try {
        const value: unknown = JSON.parse(raw);

        if (typeof value !== 'object' || value === null) {
            return null;
        }

        const data = value as Record<string, unknown>;

        if (
            !isId(data.userId) ||
            !isId(data.noteId) ||
            !isId(data.rootId) ||
            typeof data.title !== 'string' ||
            typeof data.startedAt !== 'string'
        ) {
            return null;
        }

        return {
            userId: data.userId,
            noteId: data.noteId,
            rootId: data.rootId,
            title: data.title.slice(0, 200),
            startedAt: data.startedAt,
        };
    } catch {
        return null;
    }
}

export function readSession(): MinutesSession | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const raw = readRaw();

    if (raw !== cachedRaw) {
        cachedRaw = raw;
        cached = parseSession(raw);
    }

    return cached;
}

/**
 * Starts (or continues) note-taking on a document. Opening another tab of
 * the same document keeps the start time.
 */
export function startMinutesSession(
    session: Omit<MinutesSession, 'startedAt'>,
): MinutesSession {
    const previous = readSession();
    const next: MinutesSession = {
        ...session,
        startedAt:
            previous &&
            previous.userId === session.userId &&
            previous.rootId === session.rootId
                ? previous.startedAt
                : new Date().toISOString(),
    };
    writeRaw(JSON.stringify(next));

    return next;
}

/** Updates the open tab / title of the running session (no-op without one). */
export function updateMinutesSession(
    changes: Partial<Pick<MinutesSession, 'noteId' | 'title'>>,
): void {
    const previous = readSession();

    if (!previous) {
        return;
    }

    const next = { ...previous, ...changes };

    if (next.noteId !== previous.noteId || next.title !== previous.title) {
        writeRaw(JSON.stringify(next));
    }
}

export function endMinutesSession(): void {
    writeRaw(null);
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    const onStorage = (event: StorageEvent) => {
        if (event.key === SESSION_KEY || event.key === null) {
            listener();
        }
    };
    window.addEventListener('storage', onStorage);

    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
    };
}

/** The running session of this user, null when none (or another user's). */
export function useMinutesSession(
    userId: string | null | undefined,
): MinutesSession | null {
    const session = useSyncExternalStore(subscribe, readSession, () => null);

    return session && userId && session.userId === userId ? session : null;
}

/** URL of the open tab of a session. */
export function sessionUrl(session: MinutesSession): string {
    return `/catatan/${session.noteId}`;
}
