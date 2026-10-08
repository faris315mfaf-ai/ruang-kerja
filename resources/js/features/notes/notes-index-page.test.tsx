import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { NotesIndexProps } from '@/features/notes/types';

const USER = '01k6x0000000000000000000aa';
const ROOT = '01k6x0000000000000000000cc';

const visit = vi.hoisted(() => vi.fn());

vi.mock('@inertiajs/react', () => ({ Head: () => null }));
vi.mock('sonner', () => ({ toast: { info: vi.fn() } }));
vi.mock('@/hooks/use-breakpoint', () => ({ useBreakpoint: () => 'desktop' }));
vi.mock('@/features/notes/minutes-navigation', () => ({
    visitMinutes: visit,
}));
vi.mock('@/features/notes/notes-index', () => ({
    NotesIndex: () => <p>Daftar catatan</p>,
}));

import {
    endMinutesSession,
    startMinutesSession,
} from '@/features/notes/minutes-session';
import NotesIndexPage from '@/pages/notes/index';

function props(query = ''): { notes: NotesIndexProps } {
    return {
        notes: {
            viewer_id: USER,
            people: [],
            workspaces: [],
            notes: [],
            query,
            matches: null,
        },
    };
}

describe('/catatan while note-taking mode is on', () => {
    afterEach(() => {
        cleanup();
        endMinutesSession();
        visit.mockClear();
    });

    it('shows the list without a running session', () => {
        render(<NotesIndexPage {...props()} />);

        expect(screen.getByText('Daftar catatan')).toBeTruthy();
        expect(visit).not.toHaveBeenCalled();
    });

    it('goes straight back to the running minutes', () => {
        startMinutesSession({
            userId: USER,
            noteId: ROOT,
            rootId: ROOT,
            title: 'Notulensi',
        });
        render(<NotesIndexPage {...props()} />);

        expect(screen.queryByText('Daftar catatan')).toBeNull();
        expect(visit).toHaveBeenCalledTimes(1);
        expect(visit).toHaveBeenCalledWith(
            expect.objectContaining({ noteId: ROOT }),
            { replace: true },
        );
    });

    it('still searches the list', () => {
        startMinutesSession({
            userId: USER,
            noteId: ROOT,
            rootId: ROOT,
            title: 'Notulensi',
        });
        render(<NotesIndexPage {...props('sop')} />);

        expect(screen.getByText('Daftar catatan')).toBeTruthy();
        expect(visit).not.toHaveBeenCalled();
    });
});
