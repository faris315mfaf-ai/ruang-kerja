import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { Note, NoteShowProps } from './types';

const USER = '01k6x0000000000000000000aa';
const ROOT = '01k6x0000000000000000000cc';
const TAB = '01k6x0000000000000000000dd';
const OTHER_NOTE = '01k6x0000000000000000000ff';

const page = vi.hoisted(() => ({
    component: 'tasks/index',
    url: '/tugas',
    props: {
        auth: { user: { id: '01k6x0000000000000000000aa', name: 'Uji' } },
        features: { notes: true },
        note: undefined as unknown,
    },
}));
const visit = vi.hoisted(() => vi.fn());

vi.mock('@inertiajs/react', () => ({ usePage: () => page }));
vi.mock('@/hooks/use-breakpoint', () => ({ useBreakpoint: () => 'desktop' }));
vi.mock('./minutes-navigation', () => ({ visitMinutes: visit }));

import { endMinutesSession, startMinutesSession } from './minutes-session';
import { isOnSessionDocument, MinutesReturnPill } from './minutes-return-pill';

function row(id: string, parent: string | null): Note {
    return {
        id,
        workspace_id: 'w',
        parent_id: parent,
        kind: 'note',
        preset: parent ? null : 'minutes',
        title: id,
        access: 'workspace',
        created_by: USER,
        updated_by: USER,
        position: 'a',
        created_at: null,
        updated_at: null,
    };
}

function noteProps(currentId: string): NoteShowProps {
    const notes = [row(ROOT, null), row(TAB, ROOT), row(OTHER_NOTE, null)];

    return {
        viewer_id: USER,
        people: [],
        workspaces: [],
        notes,
        current: {
            ...notes.find((note) => note.id === currentId)!,
            workspace_key: 'PRB',
            workspace_type: 'personal',
            content: null,
            can_edit: true,
            can_share: false,
            can_delete: true,
        },
        share: null,
        collab: false,
    };
}

function startSession() {
    act(() => {
        startMinutesSession({
            userId: USER,
            noteId: TAB,
            rootId: ROOT,
            title: 'Notulensi · Selasa, 06/10/2026 14.05',
        });
    });
}

describe('MinutesReturnPill', () => {
    afterEach(() => {
        cleanup();
        endMinutesSession();
        window.localStorage.clear();
        visit.mockClear();
        page.component = 'tasks/index';
        page.props.note = undefined;
        page.props.features.notes = true;
    });

    it('is hidden without a running session', () => {
        render(<MinutesReturnPill />);

        expect(screen.queryByRole('button')).toBeNull();
    });

    it('shows on other pages and returns to the open tab', () => {
        render(<MinutesReturnPill />);
        startSession();

        const pill = screen.getByRole('button', {
            name: 'Kembali ke notulensi Notulensi · Selasa, 06/10/2026 14.05',
        });
        expect(pill.textContent).toContain('Notulensi berjalan');
        expect(screen.queryByRole('button', { name: /tutup/i })).toBeNull();

        fireEvent.click(pill);
        expect(visit).toHaveBeenCalledWith(
            expect.objectContaining({ noteId: TAB, rootId: ROOT }),
        );
    });

    it('is not shown on any tab of the running document', () => {
        page.component = 'notes/show';
        page.props.note = noteProps(ROOT);
        startSession();
        render(<MinutesReturnPill />);

        expect(screen.queryByRole('button')).toBeNull();
    });

    it('stays hidden while the notes feature is off', () => {
        page.props.features.notes = false;
        startSession();
        render(<MinutesReturnPill />);

        expect(screen.queryByRole('button')).toBeNull();
    });

    it('knows which note pages belong to the session document', () => {
        const session = {
            userId: USER,
            noteId: TAB,
            rootId: ROOT,
            title: 'x',
            startedAt: '',
        };

        expect(
            isOnSessionDocument(
                { component: 'notes/show', note: noteProps(TAB) },
                session,
            ),
        ).toBe(true);
        expect(
            isOnSessionDocument(
                { component: 'notes/show', note: noteProps(OTHER_NOTE) },
                session,
            ),
        ).toBe(false);
        expect(isOnSessionDocument({ component: 'notes/index' }, session)).toBe(
            false,
        );
    });
});
