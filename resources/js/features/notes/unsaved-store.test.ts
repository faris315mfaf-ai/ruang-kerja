import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { ApiError } from '@/features/tasks/lib/api';
import type { RichDoc } from '@/features/tasks/editor/types';

vi.mock('./api', () => ({
    notesApi: {
        rename: vi.fn(),
        saveContent: vi.fn(),
    },
}));

import { notesApi } from './api';
import {
    dismissUnsaved,
    flushUnsavedChanges,
    handoffUnsavedChanges,
    readUnsavedFor,
    SAVED_SHOWN_MS,
    takeUnsavedFor,
    settleUnsavedChanges,
    useUnsavedNote,
    useUnsavedNotes,
} from './unsaved-store';
import { readUnsent } from './unsent-stash';
import type { UnsavedNote } from './unsaved-store';

const NOTE = '01k6x0000000000000000aa';
const OTHER = '01k6x0000000000000000bb';
const DOC: RichDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

const rename = vi.mocked(notesApi.rename);
const saveContent = vi.mocked(notesApi.saveContent);

/** Enough microtask turns for the rename → saveContent chain to settle. */
async function drain() {
    for (let index = 0; index < 10; index++) {
        await Promise.resolve();
    }
}

const stuck: UnsavedNote = {
    noteId: NOTE,
    title: 'Rapat mingguan',
    pendingTitle: 'Rapat mingguan',
    body: DOC,
    baseUpdatedAt: '2026-10-09T02:00:00Z',
};

describe('unsaved store', () => {
    afterEach(() => {
        dismissUnsaved();
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('hands over, keeps saving in the background and clears after "Tersimpan"', async () => {
        vi.useFakeTimers();
        rename.mockResolvedValue({
            note: { updated_at: '2026-10-09T02:00:02Z' },
        } as never);
        saveContent.mockResolvedValue({ note: {} } as never);

        const { result } = renderHook(() => useUnsavedNote());

        act(() => {
            handoffUnsavedChanges(stuck);
        });
        expect(result.current?.phase).toBe('saving');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        // Title first, then the body against the base the rename bumped.
        expect(rename).toHaveBeenCalledWith(NOTE, 'Rapat mingguan');
        expect(saveContent).toHaveBeenCalledWith(
            NOTE,
            DOC,
            '2026-10-09T02:00:02Z',
        );
        expect(result.current?.phase).toBe('saved');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(SAVED_SHOWN_MS);
        });
        expect(result.current).toBeNull();
    });

    it('keeps the changes for "Coba lagi" when the save fails offline', async () => {
        rename.mockResolvedValue({
            note: { updated_at: '2026-10-09T02:00:02Z' },
        } as never);
        saveContent.mockRejectedValueOnce(new ApiError('Koneksi terputus.', 0));

        const { result } = renderHook(() => useUnsavedNote());

        act(() => {
            handoffUnsavedChanges(stuck);
        });
        await act(async () => {
            await drain();
        });

        expect(result.current?.phase).toBe('offline');
        expect(result.current?.body).toBe(DOC);
        // The rename landed — only the body stays stuck.
        expect(result.current?.pendingTitle).toBeNull();

        saveContent.mockResolvedValueOnce({ note: {} } as never);
        let saved = false;
        await act(async () => {
            saved = await flushUnsavedChanges();
        });

        expect(saved).toBe(true);
        expect(result.current?.phase).toBe('saved');
        expect(saveContent).toHaveBeenLastCalledWith(
            NOTE,
            DOC,
            '2026-10-09T02:00:02Z',
        );
    });

    it('marks a conflict so the pill offers "Muat ulang" instead of retrying', async () => {
        saveContent.mockRejectedValueOnce(new ApiError('Konflik.', 409));

        const { result } = renderHook(() => useUnsavedNote());

        act(() => {
            handoffUnsavedChanges({ ...stuck, pendingTitle: null });
        });
        await act(async () => {
            await drain();
        });

        expect(result.current?.phase).toBe('conflict');

        // Retrying a conflict is pointless; nothing is sent again.
        await act(async () => {
            await flushUnsavedChanges();
        });
        expect(saveContent).toHaveBeenCalledTimes(1);
    });

    it('reclaims the stuck changes for the reopening note page only', async () => {
        act(() => {
            handoffUnsavedChanges({ ...stuck, pendingTitle: null });
        });

        expect(readUnsavedFor(NOTE)?.noteId).toBe(NOTE);
        expect(readUnsavedFor(OTHER)).toBeNull();
        // Reading does not claim.
        expect(readUnsavedFor(NOTE)).not.toBeNull();

        expect(takeUnsavedFor(OTHER)).toBeNull();
        expect(readUnsavedFor(NOTE)).not.toBeNull();

        const claimed = takeUnsavedFor(NOTE);
        expect(claimed?.body).toBe(DOC);
        expect(readUnsavedFor(NOTE)).toBeNull();
    });

    it('keeps one entry per note: leaving a second note does not drop the first', async () => {
        saveContent.mockRejectedValue(new ApiError('Koneksi terputus.', 0));

        const { result } = renderHook(() => useUnsavedNotes());

        act(() => {
            handoffUnsavedChanges({ ...stuck, pendingTitle: null });
            handoffUnsavedChanges({
                ...stuck,
                noteId: OTHER,
                title: 'Catatan lain',
                pendingTitle: null,
            });
        });
        await act(async () => {
            await drain();
        });

        expect(result.current.map((entry) => entry.noteId)).toEqual([
            NOTE,
            OTHER,
        ]);
        expect(readUnsavedFor(NOTE)?.phase).toBe('offline');
        expect(readUnsavedFor(OTHER)?.phase).toBe('offline');
        // Failed entries survive a closed tab.
        expect(readUnsent(NOTE)?.body).toEqual(DOC);
        saveContent.mockReset();
    });

    it('waits for the page save in flight and locks against its updated_at', async () => {
        saveContent.mockResolvedValue({
            note: { updated_at: '2026-10-09T02:00:09Z' },
        } as never);
        let landed!: (value: {
            baseUpdatedAt: string;
            bodySaved: boolean;
        }) => void;
        const settle = new Promise<{
            baseUpdatedAt: string;
            bodySaved: boolean;
        }>((resolve) => {
            landed = resolve;
        });

        act(() => {
            handoffUnsavedChanges({ ...stuck, pendingTitle: null, settle });
        });
        await act(async () => {
            await drain();
        });
        expect(saveContent).not.toHaveBeenCalled();

        await act(async () => {
            landed({ baseUpdatedAt: '2026-10-09T02:00:05Z', bodySaved: false });
            await settleUnsavedChanges(NOTE);
        });

        expect(saveContent).toHaveBeenCalledWith(
            NOTE,
            DOC,
            '2026-10-09T02:00:05Z',
        );
        // The reopening page adopts the base the background save produced.
        expect(readUnsavedFor(NOTE)?.phase).toBe('saved');
        expect(readUnsavedFor(NOTE)?.baseUpdatedAt).toBe(
            '2026-10-09T02:00:09Z',
        );
    });

    it('does not resend a body the page save already landed', async () => {
        act(() => {
            handoffUnsavedChanges({
                ...stuck,
                pendingTitle: null,
                settle: Promise.resolve({
                    baseUpdatedAt: '2026-10-09T02:00:05Z',
                    bodySaved: true,
                }),
            });
        });
        await act(async () => {
            await settleUnsavedChanges();
        });

        expect(saveContent).not.toHaveBeenCalled();
        expect(readUnsavedFor(NOTE)?.phase).toBe('saved');
    });
});
