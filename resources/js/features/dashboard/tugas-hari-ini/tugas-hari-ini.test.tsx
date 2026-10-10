import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({
        props: { auth: { user: { name: 'Andi Pratama' } } },
    }),
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

import { TugasHariIniCard } from './tugas-hari-ini';
import type { TugasHariIniItem, TugasHariIniPayload } from './types';

const pribadiTasks: TugasHariIniItem[] = [
    {
        id: 't1',
        key: 'AND-1',
        title: 'Susun laporan mingguan',
        workspace: { key: 'AND', name: 'Pribadi Andi' },
        status: {
            name: 'Dikerjakan',
            category: 'in_progress',
            is_done: false,
        },
        priority: 'Tinggi',
        assignees: ['Andi Pratama'],
        source: 'attendance',
        url: '/w/AND/tasks/1',
    },
];

const timTasks: TugasHariIniItem[] = [
    {
        id: 't2',
        key: 'TMH-3',
        title: 'Rilis fitur absensi',
        workspace: { key: 'TMH', name: 'Tim Produk' },
        status: { name: 'Todo', category: 'todo', is_done: false },
        priority: 'Tanpa',
        assignees: ['Andi Pratama', 'Budi'],
        source: 'manual',
        url: '/w/TMH/tasks/3',
    },
];

const payload: TugasHariIniPayload = {
    today: '2026-10-09',
    pribadi: pribadiTasks,
    tim: timTasks,
    semua: [...pribadiTasks, ...timTasks],
    counts: {
        pribadi: pribadiTasks.length,
        tim: timTasks.length,
        semua: pribadiTasks.length + timTasks.length,
    },
};

describe('TugasHariIniCard', () => {
    afterEach(cleanup);

    it('opens on the Pribadi segment with its tasks and markers', () => {
        render(<TugasHariIniCard tugas={payload} variant="mobile" />);

        expect(screen.getByText('Susun laporan mingguan')).toBeTruthy();
        expect(screen.getByText('dari absen')).toBeTruthy();
        expect(screen.getByText('Tinggi')).toBeTruthy();
        expect(screen.queryByText('Rilis fitur absensi')).toBeNull();

        const link = screen.getByRole('link', {
            name: 'AND-1: Susun laporan mingguan, buka tugas',
        });
        expect(link.getAttribute('href')).toBe('/w/AND/tasks/1');
    });

    it('switches to Tim and marks tasks assigned by the lead', () => {
        render(<TugasHariIniCard tugas={payload} variant="desktop" />);

        fireEvent.click(screen.getByRole('tab', { name: /Tim 1/ }));

        expect(screen.getByText('Rilis fitur absensi')).toBeTruthy();
        expect(screen.getByText('penugasan atasan')).toBeTruthy();
        // "Tanpa" priority never becomes a chip.
        expect(screen.queryByText('Tanpa')).toBeNull();
    });

    it('shows the empty state of a segment without tasks', () => {
        render(
            <TugasHariIniCard
                tugas={{
                    ...payload,
                    tim: [],
                    counts: { pribadi: 1, tim: 0, semua: 1 },
                }}
                variant="mobile"
            />,
        );

        fireEvent.click(screen.getByRole('tab', { name: /Tim 0/ }));

        expect(screen.getByText('Belum ada tugas tim hari ini')).toBeTruthy();
    });
});
