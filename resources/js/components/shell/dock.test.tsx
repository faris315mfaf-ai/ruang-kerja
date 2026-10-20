import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

const page = vi.hoisted(() => ({
    url: '/dashboard',
    props: {
        auth: { user: { name: 'Uji' }, roles: [] as string[] },
        approvals: { pending: 0 },
        workspaces: [],
    },
}));

vi.mock('@inertiajs/react', () => ({
    usePage: () => page,
    Link: ({
        children,
        href,
        prefetch: _prefetch,
        ...rest
    }: {
        children: ReactNode;
        href: string;
        prefetch?: boolean;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));
vi.mock('@/hooks/use-reduced-motion', () => ({
    useReducedMotion: () => false,
}));
vi.mock('@/features/notifications/unread-store', () => ({
    useUnreadCount: () => 0,
}));

import { Dock } from './dock';

function renderFor(roles: string[]) {
    page.props.auth.roles = roles;

    return render(<Dock />);
}

describe('Dock', () => {
    afterEach(cleanup);

    it('groups the organization screens in one stack for HR', () => {
        renderFor(['hr']);

        expect(screen.getByRole('button', { name: 'Organisasi' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Admin' })).toBeTruthy();
        expect(
            screen.queryByRole('link', { name: 'Struktur organisasi' }),
        ).toBeNull();
    });

    it('keeps the org chart as a plain tile when it is the only entry', () => {
        renderFor(['direksi']);

        expect(
            screen
                .getByRole('link', { name: 'Struktur organisasi' })
                .getAttribute('href'),
        ).toBe('/organisasi/struktur');
        expect(screen.queryByRole('button', { name: 'Organisasi' })).toBeNull();
    });

    it('hides the org chart from staff (keputusan pemilik 6 Okt 2026)', () => {
        renderFor(['anggota']);

        expect(
            screen.queryByRole('link', { name: 'Struktur organisasi' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: 'Organisasi' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Admin' })).toBeNull();
    });

    it('gives Kepala Divisi the stack for their division members', () => {
        renderFor(['kepala_divisi']);

        expect(screen.getByRole('button', { name: 'Organisasi' })).toBeTruthy();
        // Attendance board still sits in the Admin stack.
        expect(screen.getByRole('button', { name: 'Admin' })).toBeTruthy();
    });

    it('shows the Manajemen tile only to Super Admin (keputusan pemilik 20 Okt 2026)', () => {
        renderFor(['super_admin']);
        expect(
            screen
                .getAllByRole('link', { name: 'Manajemen' })
                .map((link) => link.getAttribute('href')),
        ).toEqual(['/manajemen']);
        cleanup();

        for (const role of ['direksi', 'hr', 'anggota']) {
            renderFor([role]);
            expect(
                screen.queryByRole('link', { name: 'Manajemen' }),
            ).toBeNull();
            cleanup();
        }
    });

    it('starts with Dashboard and keeps the Workspace stack for everyone', () => {
        renderFor(['anggota']);

        expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe(
            '/dashboard',
        );
        expect(screen.getByRole('button', { name: 'Workspace' })).toBeTruthy();
    });
});
