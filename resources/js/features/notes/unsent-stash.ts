import type { RichDoc } from '@/features/tasks/editor/types';

/**
 * Last-resort copy of note changes that could not be confirmed by the
 * server before the page went away (tab closed, page frozen in the
 * back/forward cache, keepalive body too large, background save offline).
 * Kept in localStorage per note and recovered the next time that note opens.
 */
export type UnsentStash = {
    noteId: string;
    title: string;
    pendingTitle: string | null;
    /** undefined = no body change, null = cleared document. */
    body: RichDoc | null | undefined;
    /** `updated_at` the body was edited against. */
    baseUpdatedAt: string;
    stashedAt: number;
};

/** Stashes older than this are dropped instead of recovered (ms). */
export const STASH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const PREFIX = 'ruangkerja:catatan-belum-terkirim:';

function storage(): Storage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
}

export function stashUnsent(note: Omit<UnsentStash, 'stashedAt'>): void {
    try {
        storage()?.setItem(
            PREFIX + note.noteId,
            JSON.stringify({
                noteId: note.noteId,
                title: note.title,
                pendingTitle: note.pendingTitle,
                // JSON drops undefined: a missing key = no body change.
                ...(note.body !== undefined ? { body: note.body } : {}),
                baseUpdatedAt: note.baseUpdatedAt,
                stashedAt: Date.now(),
            }),
        );
    } catch {
        // Quota exceeded / storage blocked: nothing more we can do.
    }
}

export function readUnsent(noteId: string): UnsentStash | null {
    try {
        const raw = storage()?.getItem(PREFIX + noteId);

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as Partial<UnsentStash> &
            Record<string, unknown>;

        if (
            parsed.noteId !== noteId ||
            typeof parsed.baseUpdatedAt !== 'string' ||
            typeof parsed.stashedAt !== 'number'
        ) {
            return null;
        }

        return {
            noteId,
            title: typeof parsed.title === 'string' ? parsed.title : '',
            pendingTitle:
                typeof parsed.pendingTitle === 'string'
                    ? parsed.pendingTitle
                    : null,
            body:
                'body' in parsed ? (parsed.body as RichDoc | null) : undefined,
            baseUpdatedAt: parsed.baseUpdatedAt,
            stashedAt: parsed.stashedAt,
        };
    } catch {
        return null;
    }
}

export function clearUnsent(noteId: string): void {
    try {
        storage()?.removeItem(PREFIX + noteId);
    } catch {
        // ignore
    }
}

/**
 * What of a stash still needs saving against the note as the server has it
 * now. The body is only re-applied when nobody saved the note since it was
 * stashed (same `updated_at`): a newer server version means the keepalive
 * landed, or someone else edited — never overwrite that. A pending title is
 * re-applied when the server title differs.
 */
export function recoverUnsent(
    stash: UnsentStash | null,
    server: { title: string; updated_at: string | null },
    now: number = Date.now(),
): { body: RichDoc | null | undefined; pendingTitle: string | null } | null {
    if (stash === null || now - stash.stashedAt > STASH_MAX_AGE_MS) {
        return null;
    }

    const body =
        stash.body !== undefined &&
        stash.baseUpdatedAt === (server.updated_at ?? '')
            ? stash.body
            : undefined;
    const pendingTitle =
        stash.pendingTitle !== null && stash.pendingTitle !== server.title
            ? stash.pendingTitle
            : null;

    return body !== undefined || pendingTitle !== null
        ? { body, pendingTitle }
        : null;
}
