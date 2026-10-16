import { afterEach, describe, expect, it } from 'vite-plus/test';
import type { RichDoc } from '@/features/tasks/editor/types';
import {
    clearUnsent,
    readUnsent,
    recoverUnsent,
    STASH_MAX_AGE_MS,
    stashUnsent,
} from './unsent-stash';

const NOTE = '01k6x0000000000000000aa';
const DOC: RichDoc = { type: 'doc', content: [{ type: 'paragraph' }] };
const BASE = '2026-10-09T02:00:00Z';

describe('unsent stash', () => {
    afterEach(() => clearUnsent(NOTE));

    it('round-trips through localStorage, keeping "no body" apart from a cleared body', () => {
        stashUnsent({
            noteId: NOTE,
            title: 'Rapat',
            pendingTitle: null,
            body: undefined,
            baseUpdatedAt: BASE,
        });
        expect(readUnsent(NOTE)?.body).toBeUndefined();

        stashUnsent({
            noteId: NOTE,
            title: 'Rapat',
            pendingTitle: 'Rapat',
            body: null,
            baseUpdatedAt: BASE,
        });
        expect(readUnsent(NOTE)?.body).toBeNull();
        expect(readUnsent(NOTE)?.pendingTitle).toBe('Rapat');

        clearUnsent(NOTE);
        expect(readUnsent(NOTE)).toBeNull();
    });

    it('recovers the body only while the server still has its base version', () => {
        const stash = {
            noteId: NOTE,
            title: 'Rapat baru',
            pendingTitle: 'Rapat baru',
            body: DOC,
            baseUpdatedAt: BASE,
            stashedAt: 1000,
        };

        expect(
            recoverUnsent(stash, { title: 'Rapat', updated_at: BASE }, 2000),
        ).toEqual({ body: DOC, pendingTitle: 'Rapat baru' });
        // The keepalive landed (or someone else saved): body not re-applied.
        expect(
            recoverUnsent(
                stash,
                { title: 'Rapat', updated_at: '2026-10-09T02:00:07Z' },
                2000,
            ),
        ).toEqual({ body: undefined, pendingTitle: 'Rapat baru' });
        // Everything already on the server.
        expect(
            recoverUnsent(
                stash,
                { title: 'Rapat baru', updated_at: '2026-10-09T02:00:07Z' },
                2000,
            ),
        ).toBeNull();
        // Too old.
        expect(
            recoverUnsent(
                stash,
                { title: 'Rapat', updated_at: BASE },
                1000 + STASH_MAX_AGE_MS + 1,
            ),
        ).toBeNull();
    });
});
