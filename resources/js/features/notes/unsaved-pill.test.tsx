import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

const page = vi.hoisted(() => ({
    component: 'tasks/index',
    props: {
        features: { notes: true },
        note: undefined as unknown,
    },
}));
const visit = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({
    state: null as import('./unsaved-store').UnsavedState | null,
    flush: vi.fn(() => Promise.resolve(true)),
    settle: vi.fn(() => Promise.resolve()),
}));

vi.mock('@inertiajs/react', () => ({
    usePage: () => page,
    router: { visit },
}));
vi.mock('@/hooks/use-breakpoint', () => ({ useBreakpoint: () => 'desktop' }));
vi.mock('./unsaved-store', () => ({
    flushUnsavedChanges: store.flush,
    settleUnsavedChanges: store.settle,
    useUnsavedNote: () => store.state,
}));

import { unsavedPillState, UnsavedNotePill } from './unsaved-pill';
import type { UnsavedState } from './unsaved-store';

const NOTE = '01k6x0000000000000000aa';
const OTHER = '01k6x0000000000000000bb';

const stuck = (phase: UnsavedState['phase']): UnsavedState => ({
    noteId: NOTE,
    title: 'Rapat mingguan',
    pendingTitle: 'Rapat mingguan',
    body: { type: 'doc' },
    baseUpdatedAt: '2026-10-09T02:00:00Z',
    phase,
});

describe('unsavedPillState', () => {
    it('is hidden without stuck changes, on the note itself, or with the feature off', () => {
        expect(
            unsavedPillState({
                unsaved: null,
                onNote: false,
                notesEnabled: true,
            }),
        ).toBeNull();
        expect(
            unsavedPillState({
                unsaved: stuck('saving'),
                onNote: true,
                notesEnabled: true,
            }),
        ).toBeNull();
        expect(
            unsavedPillState({
                unsaved: stuck('saving'),
                onNote: false,
                notesEnabled: false,
            }),
        ).toBeNull();
    });

    it('asks to save while unsaved, celebrates briefly once saved', () => {
        expect(
            unsavedPillState({
                unsaved: stuck('saving'),
                onNote: false,
                notesEnabled: true,
            }),
        ).toEqual({
            tone: 'warning',
            label: 'Catatan belum tersimpan',
            action: { kind: 'save', label: 'Simpan' },
        });
        expect(
            unsavedPillState({
                unsaved: stuck('saved'),
                onNote: false,
                notesEnabled: true,
            }),
        ).toEqual({ tone: 'success', label: 'Tersimpan ✓', action: null });
    });

    it('offers a retry when offline and a reload on a conflict', () => {
        expect(
            unsavedPillState({
                unsaved: stuck('offline'),
                onNote: false,
                notesEnabled: true,
            }),
        ).toEqual({
            tone: 'warning',
            label: 'Catatan belum tersimpan. Periksa koneksi.',
            action: { kind: 'save', label: 'Coba lagi' },
        });
        expect(
            unsavedPillState({
                unsaved: stuck('conflict'),
                onNote: false,
                notesEnabled: true,
            }),
        ).toEqual({
            tone: 'danger',
            label: 'Catatan diubah orang lain',
            action: { kind: 'reload', label: 'Muat ulang' },
        });
    });
});

describe('UnsavedNotePill', () => {
    afterEach(() => {
        cleanup();
        store.state = null;
        store.flush.mockClear();
        store.settle.mockClear();
        visit.mockClear();
        page.component = 'tasks/index';
        page.props.note = undefined;
        page.props.features.notes = true;
    });

    it('is hidden without stuck changes', () => {
        render(<UnsavedNotePill />);
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('shows the note title with a disabled save while the background save runs', () => {
        store.state = stuck('saving');
        render(<UnsavedNotePill />);

        expect(screen.getByRole('status').textContent).toContain(
            'Catatan belum tersimpan',
        );
        expect(screen.getByRole('status').textContent).toContain(
            'Rapat mingguan',
        );

        const save = screen.getByRole('button', { name: 'Simpan' });
        expect((save as HTMLButtonElement).disabled).toBe(true);
    });

    it('retries from "Coba lagi" and waits for the save before going back', async () => {
        store.state = stuck('offline');
        render(<UnsavedNotePill />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
        });
        expect(store.flush).toHaveBeenCalledTimes(1);
        expect(visit).not.toHaveBeenCalled();

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Kembali ke catatan Rapat mingguan',
                }),
            );
        });
        expect(store.settle).toHaveBeenCalledTimes(1);
        expect(visit).toHaveBeenCalledWith(`/catatan/${NOTE}`);
    });

    it('reloads the note on a conflict', async () => {
        store.state = stuck('conflict');
        render(<UnsavedNotePill />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' }));
        });
        expect(visit).toHaveBeenCalledWith(`/catatan/${NOTE}`);
    });

    it('is hidden on the stuck note itself and while the feature is off', () => {
        page.component = 'notes/show';
        page.props.note = { current: { id: NOTE } };
        store.state = stuck('saving');
        const { unmount } = render(<UnsavedNotePill />);
        expect(screen.queryByRole('status')).toBeNull();
        unmount();

        page.props.note = { current: { id: OTHER } };
        store.state = stuck('saving');
        render(<UnsavedNotePill />);
        expect(screen.getByRole('status')).not.toBeNull();
        cleanup();

        page.component = 'tasks/index';
        page.props.note = undefined;
        page.props.features.notes = false;
        render(<UnsavedNotePill />);
        expect(screen.queryByRole('status')).toBeNull();
    });
});
