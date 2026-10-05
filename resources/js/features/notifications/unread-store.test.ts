import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';

const page = { props: { inbox: { unread: 3 } as { unread: number } | null } };

vi.mock('@inertiajs/react', () => ({ usePage: () => page }));

const { incrementUnread, resetUnreadStore, setUnreadCount, useUnreadCount } =
    await import('./unread-store');

describe('unread store', () => {
    afterEach(() => {
        page.props.inbox = { unread: 3 };
        act(() => resetUnreadStore());
    });

    it('starts from the shared Inertia prop', () => {
        const { result } = renderHook(() => useUnreadCount());

        expect(result.current).toBe(3);
    });

    it('layers live updates on top of the server value', () => {
        const { result } = renderHook(() => useUnreadCount());

        act(() => incrementUnread(3));
        expect(result.current).toBe(4);

        act(() => incrementUnread(3));
        expect(result.current).toBe(5);

        act(() => setUnreadCount(1, 3));
        expect(result.current).toBe(1);
    });

    it('lets a newer server value win', () => {
        const { result, rerender } = renderHook(() => useUnreadCount());

        act(() => incrementUnread(3));
        page.props.inbox = { unread: 7 };
        rerender();

        expect(result.current).toBe(7);
    });

    it('treats guests as zero', () => {
        page.props.inbox = null;
        const { result } = renderHook(() => useUnreadCount());

        expect(result.current).toBe(0);
    });
});
