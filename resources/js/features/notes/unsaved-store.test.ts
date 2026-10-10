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
    useUnsavedNote,
} from './unsaved-store';
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
});
