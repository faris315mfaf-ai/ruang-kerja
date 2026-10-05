import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MouseEvent, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

const state = vi.hoisted(() => ({
    url: '/dashboard',
    unread: 0,
    keyboardOpen: false,
    finish: [] as Array<() => void>,
}));

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ url: state.url, props: {} }),
    router: {
        on: (_event: string, callback: () => void) => {
            state.finish.push(callback);

            return () => {
                state.finish = state.finish.filter((fn) => fn !== callback);
            };
        },
    },
    Link: ({
        children,
        href,
        prefetch: _prefetch,
        onClick,
        ...rest
    }: {
        children: ReactNode;
        href: string;
        prefetch?: boolean;
        onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    }) => (
        <a
            href={href}
            onClick={(event) => {
                event.preventDefault();
                onClick?.(event);
            }}
            {...rest}
        >
            {children}
        </a>
    ),
}));
vi.mock('@/features/notifications/unread-store', () => ({
    useUnreadCount: () => state.unread,
}));
vi.mock('@/hooks/use-keyboard-open', () => ({
    useKeyboardOpen: () => state.keyboardOpen,
}));

import { act } from 'react';
import { TabBar } from './tab-bar';

const pill = () => screen.getByTestId('tab-pill');

describe('TabBar (dock capsule)', () => {
    afterEach(() => {
        cleanup();
        state.url = '/dashboard';
        state.unread = 0;
        state.keyboardOpen = false;
    });

    it('puts the pill under the tab of the current page', () => {
        state.url = '/tugas';
        render(<TabBar />);

        expect(pill().style.transform).toBe('translateX(200%)');
        expect(
            screen
                .getByRole('link', { name: 'Tugas' })
                .getAttribute('aria-current'),
        ).toBe('page');
    });

    it('slides the pill on tap before the page arrives, then follows the URL', () => {
        render(<TabBar />);
        expect(pill().style.transform).toBe('translateX(0%)');

        fireEvent.click(screen.getByRole('link', { name: 'Menu' }));
        expect(pill().style.transform).toBe('translateX(400%)');

        // Visit cancelled: the pill returns to the page that is shown.
        act(() => state.finish.forEach((fn) => fn()));
        expect(pill().style.transform).toBe('translateX(0%)');
    });

    it('hides the pill on pages outside the five tabs', () => {
        state.url = '/persetujuan';
        render(<TabBar />);

        expect(pill().className).toContain('opacity-0');
    });

    it('keeps the unread badge on Inbox', () => {
        state.unread = 120;
        render(<TabBar />);

        expect(screen.getByText('99+')).toBeTruthy();
        expect(screen.getByText(/120 belum dibaca/)).toBeTruthy();
    });

    it('hides while the keyboard is open', () => {
        state.keyboardOpen = true;
        render(<TabBar />);

        expect(screen.queryByRole('navigation')).toBeNull();
    });
});
