import type { BriefingPeriodValue } from './types';

/**
 * Device autosave of the unsent briefing note (localStorage), per user,
 * office date and period — "pagi" and "sore" drafts never overwrite each
 * other and yesterday's draft never resurfaces. Every access is wrapped in
 * try/catch: private mode, a full quota or blocked site data simply turn
 * autosave off (the note is only lost on navigation, never corrupted).
 */
export const BRIEFING_DRAFT_PREFIX = 'rk.briefing-draft.v1';

/** Storage-like object (window.localStorage in the app, a fake in tests). */
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The browser's localStorage, or null when it is unavailable/blocked. */
export function deviceStorage(): DraftStorage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
}

/** `rk.briefing-draft.v1.<user>.<date>.<period>`, e.g. …u1.2026-10-09.pagi. */
export function briefingDraftKey(
    userId: string,
    date: string,
    period: BriefingPeriodValue,
): string {
    return `${BRIEFING_DRAFT_PREFIX}.${userId}.${date}.${period}`;
}

export function saveBriefingDraft(
    storage: DraftStorage | null,
    key: string,
    content: string,
    now: Date = new Date(),
): boolean {
    if (!storage) {
        return false;
    }

    try {
        storage.setItem(
            key,
            JSON.stringify({ content, savedAt: now.toISOString() }),
        );

        return true;
    } catch {
        return false;
    }
}

/** The stored note text, or null when missing, unreadable or malformed. */
export function loadBriefingDraft(
    storage: DraftStorage | null,
    key: string,
): string | null {
    if (!storage) {
        return null;
    }

    try {
        const raw = storage.getItem(key);

        if (!raw) {
            return null;
        }

        const parsed: unknown = JSON.parse(raw);

        if (
            typeof parsed !== 'object' ||
            parsed === null ||
            typeof (parsed as { content?: unknown }).content !== 'string'
        ) {
            return null;
        }

        return (parsed as { content: string }).content;
    } catch {
        return null;
    }
}

export function clearBriefingDraft(
    storage: DraftStorage | null,
    key: string,
): void {
    try {
        storage?.removeItem(key);
    } catch {
        // Storage unavailable: nothing to clear.
    }
}
