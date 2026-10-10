import { describe, expect, it } from 'vite-plus/test';
import {
    briefingDraftKey,
    BRIEFING_DRAFT_PREFIX,
    clearBriefingDraft,
    type DraftStorage,
    loadBriefingDraft,
    saveBriefingDraft,
} from './draft';

/** In-memory Storage with the same surface as localStorage. */
function memoryStorage(): DraftStorage & { data: Map<string, string> } {
    const data = new Map<string, string>();

    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, String(value)),
        removeItem: (key) => void data.delete(key),
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

describe('briefing draft storage', () => {
    it('keys drafts per user, office date and period', () => {
        expect(briefingDraftKey('u1', '2026-10-09', 'pagi')).toBe(
            `${BRIEFING_DRAFT_PREFIX}.u1.2026-10-09.pagi`,
        );
        expect(briefingDraftKey('u1', '2026-10-09', 'sore')).not.toBe(
            briefingDraftKey('u1', '2026-10-09', 'pagi'),
        );
        expect(briefingDraftKey('u2', '2026-10-09', 'pagi')).not.toBe(
            briefingDraftKey('u1', '2026-10-09', 'pagi'),
        );
        expect(briefingDraftKey('u1', '2026-10-10', 'pagi')).not.toBe(
            briefingDraftKey('u1', '2026-10-09', 'pagi'),
        );
    });

    it('saves and loads the note text', () => {
        const storage = memoryStorage();
        const key = briefingDraftKey('u1', '2026-10-09', 'pagi');

        expect(
            saveBriefingDraft(
                storage,
                key,
                '1. Absen pagi\n2. Tenggat laporan',
                new Date('2026-10-09T01:05:00Z'),
            ),
        ).toBe(true);
        expect(loadBriefingDraft(storage, key)).toBe(
            '1. Absen pagi\n2. Tenggat laporan',
        );
    });

    it('returns null for missing, corrupt or malformed entries', () => {
        const storage = memoryStorage();

        expect(loadBriefingDraft(storage, 'nope')).toBeNull();
        storage.setItem('bad', '{not json');
        expect(loadBriefingDraft(storage, 'bad')).toBeNull();
        storage.setItem('shape', JSON.stringify({ content: 42 }));
        expect(loadBriefingDraft(storage, 'shape')).toBeNull();
        expect(loadBriefingDraft(null, 'any')).toBeNull();
    });

    it('survives storage that throws (private mode, full quota)', () => {
        expect(saveBriefingDraft(throwing, 'k', 'isi')).toBe(false);
        expect(saveBriefingDraft(null, 'k', 'isi')).toBe(false);
        expect(loadBriefingDraft(throwing, 'k')).toBeNull();
        expect(() => clearBriefingDraft(throwing, 'k')).not.toThrow();
    });

    it('clears only its own draft', () => {
        const storage = memoryStorage();
        const pagi = briefingDraftKey('u1', '2026-10-09', 'pagi');
        const sore = briefingDraftKey('u1', '2026-10-09', 'sore');

        saveBriefingDraft(storage, pagi, 'Pagi');
        saveBriefingDraft(storage, sore, 'Sore');
        clearBriefingDraft(storage, pagi);

        expect(loadBriefingDraft(storage, pagi)).toBeNull();
        expect(loadBriefingDraft(storage, sore)).toBe('Sore');
    });
});
