/**
 * Device autosave of the unsent request form (localStorage), per user and
 * category ("Draf dipulihkan dari perangkat ini"). Only plain field values are
 * stored: never attachments (binary) or the server intent. Every storage access
 * is wrapped in try/catch — private mode, a full quota or blocked site data
 * simply turn autosave off. The server-side "Simpan draf" is unaffected.
 */
import type { RequestCategory } from '@/types/requests';

export const DRAFT_PREFIX = 'rk.request-draft.v1';

/** Field values kept on the device (no files, no intent). */
export type StoredDraftFields = {
    leave_type_id: string;
    start_date: string;
    end_date: string;
    date: string;
    start_time: string;
    end_time: string;
    check_in: string;
    check_out: string;
    half_day: boolean;
    destination: string;
    substitute_id: string;
    reason: string;
};

export type StoredDraft = {
    fields: StoredDraftFields;
    permitMode: 'days' | 'hours';
    savedAt: string;
};

const STRING_FIELDS = [
    'leave_type_id',
    'start_date',
    'end_date',
    'date',
    'start_time',
    'end_time',
    'check_in',
    'check_out',
    'destination',
    'substitute_id',
    'reason',
] as const;

/** Storage-like object (window.localStorage in the app, a fake in tests). */
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> &
    Partial<Pick<Storage, 'key' | 'length'>>;

/** The browser's localStorage, or null when it is unavailable/blocked. */
export function deviceStorage(): DraftStorage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
}

/**
 * Key per user, form (new request or the edited request) and category, e.g.
 * `rk.request-draft.v1.<user>.baru.leave`.
 */
export function draftKey(
    userId: string,
    category: RequestCategory,
    requestId: string | null = null,
): string {
    return `${DRAFT_PREFIX}.${userId}.${requestId ?? 'baru'}.${category}`;
}

/** Keeps only the known plain fields (drops attachments, intent, …). */
export function pickDraftFields(
    data: Partial<StoredDraftFields> & Record<string, unknown>,
): StoredDraftFields {
    const fields = {} as StoredDraftFields;

    for (const name of STRING_FIELDS) {
        const value = data[name];
        fields[name] = typeof value === 'string' ? value : '';
    }

    fields.half_day = data.half_day === true;

    return fields;
}

export function saveDraft(
    storage: DraftStorage | null,
    key: string,
    data: Partial<StoredDraftFields> & Record<string, unknown>,
    permitMode: 'days' | 'hours',
    now: Date = new Date(),
): boolean {
    if (!storage) {
        return false;
    }

    const draft: StoredDraft = {
        fields: pickDraftFields(data),
        permitMode,
        savedAt: now.toISOString(),
    };

    try {
        storage.setItem(key, JSON.stringify(draft));

        return true;
    } catch {
        return false;
    }
}

/** The stored draft, or null when missing, unreadable or malformed. */
export function loadDraft(
    storage: DraftStorage | null,
    key: string,
): StoredDraft | null {
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
            typeof (parsed as StoredDraft).fields !== 'object' ||
            (parsed as StoredDraft).fields === null
        ) {
            return null;
        }

        const draft = parsed as {
            fields: Record<string, unknown>;
            permitMode?: unknown;
            savedAt?: unknown;
        };

        return {
            fields: pickDraftFields(draft.fields),
            permitMode: draft.permitMode === 'hours' ? 'hours' : 'days',
            savedAt: typeof draft.savedAt === 'string' ? draft.savedAt : '',
        };
    } catch {
        return null;
    }
}

export function clearDraft(storage: DraftStorage | null, key: string): void {
    try {
        storage?.removeItem(key);
    } catch {
        // Storage unavailable: nothing to clear.
    }
}

/**
 * Removes every category draft of one form (new request, or one edited
 * request), e.g. after it was sent, saved on the server or canceled.
 */
export function clearFormDrafts(
    storage: DraftStorage | null,
    userId: string,
    requestId: string | null = null,
): void {
    if (!storage) {
        return;
    }

    const prefix = `${DRAFT_PREFIX}.${userId}.${requestId ?? 'baru'}.`;

    try {
        const keys: string[] = [];
        const length = storage.length ?? 0;

        for (let index = 0; index < length; index++) {
            const key = storage.key?.(index);

            if (key?.startsWith(prefix)) {
                keys.push(key);
            }
        }

        keys.forEach((key) => storage.removeItem(key));
    } catch {
        // Storage unavailable: nothing to clear.
    }
}

/** Whether the stored fields differ from the form's starting values. */
export function differsFrom(
    fields: StoredDraftFields,
    initial: Partial<StoredDraftFields> & Record<string, unknown>,
): boolean {
    const base = pickDraftFields(initial);

    return (Object.keys(fields) as (keyof StoredDraftFields)[]).some(
        (name) => fields[name] !== base[name],
    );
}
