import { describe, expect, it } from 'vite-plus/test';

import {
    clearDraft,
    clearFormDrafts,
    differsFrom,
    draftKey,
    loadDraft,
    pickDraftFields,
    saveDraft,
} from './draft-storage';
import type { DraftStorage } from './draft-storage';

/** In-memory Storage with the same surface as localStorage. */
function memoryStorage(): DraftStorage & { data: Map<string, string> } {
    const data = new Map<string, string>();

    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, String(value)),
        removeItem: (key) => void data.delete(key),
        key: (index) => [...data.keys()][index] ?? null,
        get length() {
            return data.size;
        },
    };
}

const throwing: DraftStorage = {
    getItem: () => {
        throw new Error('SecurityError');
    },
    setItem: () => {
        throw new Error('QuotaExceededError');
    },
    removeItem: () => {
        throw new Error('SecurityError');
    },
};

const fields = {
    leave_type_id: 't1',
    start_date: '2026-10-12',
    end_date: '2026-10-14',
    date: '2026-10-12',
    start_time: '',
    end_time: '',
    check_in: '',
    check_out: '',
    half_day: false,
    destination: '',
    substitute_id: '',
    reason: 'Acara keluarga',
};

describe('draft storage', () => {
    it('keys drafts per user, form and category', () => {
        expect(draftKey('u1', 'leave')).toBe(
            'rk.request-draft.v1.u1.baru.leave',
        );
        expect(draftKey('u1', 'sick', 'r9')).toBe(
            'rk.request-draft.v1.u1.r9.sick',
        );
        expect(draftKey('u2', 'leave')).not.toBe(draftKey('u1', 'leave'));
    });

    it('saves and loads the plain fields, never attachments or intent', () => {
        const storage = memoryStorage();
        const key = draftKey('u1', 'leave');
        const file = new File(['x'], 'surat.pdf');

        expect(
            saveDraft(
                storage,
                key,
                {
                    ...fields,
                    intent: 'submit',
                    attachments: [file],
                    remove_attachments: ['a1'],
                },
                'days',
                new Date('2026-10-05T02:00:00Z'),
            ),
        ).toBe(true);

        const raw = storage.data.get(key) ?? '';
        expect(raw).not.toContain('attachments');
        expect(raw).not.toContain('intent');
        expect(raw).not.toContain('surat.pdf');

        expect(loadDraft(storage, key)).toEqual({
            fields,
            permitMode: 'days',
            savedAt: '2026-10-05T02:00:00.000Z',
        });
    });

    it('returns null for missing, corrupt or malformed entries', () => {
        const storage = memoryStorage();

        expect(loadDraft(storage, 'nope')).toBeNull();
        storage.setItem('bad', '{not json');
        expect(loadDraft(storage, 'bad')).toBeNull();
        storage.setItem('shape', JSON.stringify({ fields: null }));
        expect(loadDraft(storage, 'shape')).toBeNull();
        expect(loadDraft(null, 'any')).toBeNull();
    });

    it('fills unknown or wrongly typed fields with safe defaults', () => {
        const storage = memoryStorage();
        storage.setItem(
            'k',
            JSON.stringify({
                fields: { reason: 42, half_day: 'yes', leave_type_id: 't2' },
                permitMode: 'weird',
            }),
        );

        const draft = loadDraft(storage, 'k');
        expect(draft?.fields.reason).toBe('');
        expect(draft?.fields.half_day).toBe(false);
        expect(draft?.fields.leave_type_id).toBe('t2');
        expect(draft?.permitMode).toBe('days');
    });

    it('survives storage that throws (private mode, full quota)', () => {
        expect(saveDraft(throwing, 'k', fields, 'days')).toBe(false);
        expect(loadDraft(throwing, 'k')).toBeNull();
        expect(() => clearDraft(throwing, 'k')).not.toThrow();
        expect(() => clearFormDrafts(throwing, 'u1')).not.toThrow();
        expect(saveDraft(null, 'k', fields, 'days')).toBe(false);
    });

    it('clears all category drafts of one form only', () => {
        const storage = memoryStorage();
        saveDraft(storage, draftKey('u1', 'leave'), fields, 'days');
        saveDraft(storage, draftKey('u1', 'sick'), fields, 'days');
        saveDraft(storage, draftKey('u1', 'leave', 'r1'), fields, 'days');
        saveDraft(storage, draftKey('u2', 'leave'), fields, 'days');
        storage.setItem('other-app', 'keep');

        clearFormDrafts(storage, 'u1');

        expect([...storage.data.keys()].sort()).toEqual(
            [
                draftKey('u1', 'leave', 'r1'),
                draftKey('u2', 'leave'),
                'other-app',
            ].sort(),
        );

        clearDraft(storage, draftKey('u2', 'leave'));
        expect(storage.data.has(draftKey('u2', 'leave'))).toBe(false);
    });

    it('detects whether a draft differs from the starting values', () => {
        expect(differsFrom(pickDraftFields(fields), fields)).toBe(false);
        expect(
            differsFrom(pickDraftFields({ ...fields, reason: 'Lain' }), {
                ...fields,
                attachments: [],
            }),
        ).toBe(true);
    });
});
