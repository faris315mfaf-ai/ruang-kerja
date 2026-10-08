import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MouseEvent, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

const state = vi.hoisted(() => ({
    url: '/dashboard',
    unread: 0,
    chat: true,
    chatUnread: 0,
    keyboardOpen: false,
    attendanceStatus: null as null | Record<string, unknown>,
    finish: [] as Array<() => void>,
}));

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({
        url: state.url,
        props: {
            features: { prototype: false, chat: state.chat },
            chatUnread: state.chatUnread,
            attendanceStatus: state.attendanceStatus,
        },
    }),
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
        state.chat = true;
        state.chatUnread = 0;
        state.keyboardOpen = false;
        state.attendanceStatus = null;
    });

    it('orders the tabs mobile-first with Absen raised in the middle', () => {
        render(<TabBar />);

        expect(
            screen.getAllByRole('link').map((link) => link.textContent),
        ).toEqual(['Beranda', 'Tugas', 'Absen', 'Obrolan', 'Lainnya']);
        expect(
            screen
                .getByRole('link', { name: 'Absen' })
                .hasAttribute('data-tab-center'),
        ).toBe(true);
    });

    it('puts the pill under the tab of the current page', () => {
        state.url = '/tugas';
        render(<TabBar />);

        expect(pill().style.transform).toBe('translateX(100%)');
        expect(
            screen
                .getByRole('link', { name: 'Tugas' })
                .getAttribute('aria-current'),
        ).toBe('page');
    });

    it('slides the pill on tap before the page arrives, then follows the URL', () => {
        render(<TabBar />);
        expect(pill().style.transform).toBe('translateX(0%)');

        fireEvent.click(screen.getByRole('link', { name: 'Lainnya' }));
        expect(pill().style.transform).toBe('translateX(400%)');

        // Visit cancelled: the pill returns to the page that is shown.
        act(() => state.finish.forEach((fn) => fn()));
        expect(pill().style.transform).toBe('translateX(0%)');
    });

    it('lets the raised Absen button stand in for the pill', () => {
        state.url = '/absensi/riwayat';
        render(<TabBar />);

        expect(pill().className).toContain('opacity-0');
        expect(
            screen
                .getByRole('link', { name: 'Absen' })
                .getAttribute('aria-current'),
        ).toBe('page');
    });

    it('hides the pill on pages outside the five tabs', () => {
        state.url = '/persetujuan';
        render(<TabBar />);

        expect(pill().className).toContain('opacity-0');
    });

    it('badges Obrolan with unread conversations', () => {
        state.chatUnread = 120;
        state.unread = 4;
        render(<TabBar />);

        expect(screen.getByText('99+')).toBeTruthy();
        expect(screen.getByText(/120 belum dibaca/)).toBeTruthy();
        expect(screen.queryByText('4')).toBeNull();
    });

    it('gives the fourth slot back to Inbox when Obrolan is off', () => {
        state.chat = false;
        state.unread = 7;
        render(<TabBar />);

        expect(screen.queryByRole('link', { name: /Obrolan/ })).toBeNull();
        expect(screen.getByRole('link', { name: /Inbox/ })).toBeTruthy();
        expect(screen.getByText('7')).toBeTruthy();
    });

    it('hides while the keyboard is open', () => {
        state.keyboardOpen = true;
        render(<TabBar />);

        expect(screen.queryByRole('navigation')).toBeNull();
    });
});

describe('TabBar tombol Absen kontekstual', () => {
    afterEach(() => {
        cleanup();
        state.url = '/dashboard';
        state.attendanceStatus = null;
    });

    it('keeps Absen before the morning check-in', () => {
        state.attendanceStatus = {
            action: 'check_in',
            end: null,
        };
        render(<TabBar />);

        expect(
            screen.getAllByRole('link').map((link) => link.textContent),
        ).toEqual(['Beranda', 'Tugas', 'Absen', 'Obrolan', 'Lainnya']);
    });

    it('shrinks to four tabs after the check-in until one hour before the shift ends', () => {
        state.attendanceStatus = {
            action: 'check_out',
            end: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
        };
        render(<TabBar />);

        expect(
            screen.getAllByRole('link').map((link) => link.textContent),
        ).toEqual(['Beranda', 'Tugas', 'Obrolan', 'Lainnya']);
    });

    it('brings Absen back an hour before the shift ends', () => {
        state.attendanceStatus = {
            action: 'check_out',
            end: new Date(Date.now() + 30 * 60_000).toISOString(),
        };
        render(<TabBar />);

        expect(screen.getByRole('link', { name: 'Absen' })).toBeTruthy();
    });

    it('stays four tabs after the check-out', () => {
        state.attendanceStatus = { action: 'done', end: null };
        render(<TabBar />);

        expect(screen.queryByRole('link', { name: 'Absen' })).toBeNull();
    });
});
