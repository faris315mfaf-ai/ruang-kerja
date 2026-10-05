import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const post = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock('@inertiajs/react', () => ({ router: { post } }));
vi.mock('sonner', () => ({ toast: { error: toastError } }));
vi.mock('@/routes/approvals', () => ({
    bulk: { url: () => '/persetujuan/massal' },
}));

import {
    BULK_LIMIT,
    isAllSelected,
    toggleAll,
    toggleId,
    useApprovalSelection,
    visibleSelection,
} from './use-approval-selection';

type VisitOptions = {
    onStart?: () => void;
    onFinish?: () => void;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
};

const lastVisit = (): [string, { ids: string[] }, VisitOptions] =>
    post.mock.calls.at(-1) as [string, { ids: string[] }, VisitOptions];

describe('selection helpers', () => {
    it('toggles one id in and out, keeping the order', () => {
        expect(toggleId([], 'a')).toEqual(['a']);
        expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
        expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
    });

    it('drops ids that left the list', () => {
        expect(visibleSelection(['a', 'x', 'b'], ['a', 'b', 'c'])).toEqual([
            'a',
            'b',
        ]);
    });

    it('knows when the whole tab is selected', () => {
        expect(isAllSelected(['a', 'b'], ['a', 'b'])).toBe(true);
        expect(isAllSelected(['a'], ['a', 'b'])).toBe(false);
        expect(isAllSelected([], [])).toBe(false);
    });

    it('selects all items of the tab, then none', () => {
        expect(toggleAll(['a'], ['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
        expect(toggleAll(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([]);
    });

    it('caps "select all" at the bulk endpoint limit', () => {
        const many = Array.from({ length: BULK_LIMIT + 5 }, (_, i) => `r${i}`);
        const all = toggleAll([], many);

        expect(all).toHaveLength(BULK_LIMIT);
        expect(isAllSelected(all, many)).toBe(true);
    });
});

describe('useApprovalSelection', () => {
    beforeEach(() => {
        post.mockReset();
        toastError.mockReset();
    });

    it('starts empty, toggles and cancels', () => {
        const { result } = renderHook(() =>
            useApprovalSelection(['a', 'b', 'c']),
        );

        expect(result.current.active).toBe(false);
        act(() => result.current.start());
        act(() => result.current.toggle('b'));
        act(() => result.current.toggle('a'));

        expect(result.current.active).toBe(true);
        expect(result.current.ids).toEqual(['b', 'a']);
        expect(result.current.isSelected('a')).toBe(true);
        expect(result.current.isSelected('c')).toBe(false);

        act(() => result.current.toggleAll());
        expect(result.current.count).toBe(3);
        expect(result.current.allSelected).toBe(true);

        act(() => result.current.cancel());
        expect(result.current.active).toBe(false);
        expect(result.current.count).toBe(0);
    });

    it('forgets requests that are no longer in the queue', () => {
        const { result, rerender } = renderHook(
            ({ ids }) => useApprovalSelection(ids),
            { initialProps: { ids: ['a', 'b'] } },
        );

        act(() => result.current.start());
        act(() => result.current.toggleAll());
        rerender({ ids: ['b'] });

        expect(result.current.ids).toEqual(['b']);
    });

    it('approves the selection through the bulk endpoint and leaves the mode', () => {
        const { result } = renderHook(() => useApprovalSelection(['a', 'b']));

        act(() => result.current.start());
        act(() => result.current.toggle('a'));
        act(() => result.current.approve());

        const [url, data, options] = lastVisit();
        expect(url).toBe('/persetujuan/massal');
        expect(data).toEqual({ ids: ['a'] });

        act(() => options.onStart?.());
        expect(result.current.processing).toBe(true);
        act(() => {
            options.onSuccess?.();
            options.onFinish?.();
        });

        expect(result.current.processing).toBe(false);
        expect(result.current.active).toBe(false);
    });

    it('does not post an empty selection', () => {
        const { result } = renderHook(() => useApprovalSelection(['a']));

        act(() => result.current.start());
        act(() => result.current.approve());

        expect(post).not.toHaveBeenCalled();
    });

    it('shows the validation message when the server refuses', () => {
        const { result } = renderHook(() => useApprovalSelection(['a']));

        act(() => result.current.start());
        act(() => result.current.toggle('a'));
        act(() => result.current.approve());
        act(() =>
            lastVisit()[2].onError?.({
                ids: 'Maksimal 100 pengajuan sekaligus.',
            }),
        );

        expect(toastError).toHaveBeenCalledWith(
            'Maksimal 100 pengajuan sekaligus.',
        );
        expect(result.current.active).toBe(true);
    });
});
