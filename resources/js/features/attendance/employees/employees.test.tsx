import {
    cleanup,
    fireEvent,
    render,
    screen,
    within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { DayDetail, GridRow } from './types';

const put = vi.hoisted(() => vi.fn());

vi.mock('@inertiajs/react', async () => {
    const React = await import('react');

    return {
        useForm: <T extends Record<string, unknown>>(initial: T) => {
            const [data, setState] = React.useState(initial);

            return {
                data,
                errors: {},
                processing: false,
                setData: (key: keyof T | T, value?: unknown) =>
                    typeof key === 'object'
                        ? setState(key)
                        : setState((current) => ({ ...current, [key]: value })),
                setDefaults: () => {},
                clearErrors: () => {},
                transform: () => {},
                put,
                delete: vi.fn(),
            };
        },
    };
});

const detail = vi.hoisted((): { value: DayDetail | null } => ({ value: null }));

vi.mock('@/lib/http', () => ({
    HttpRequestError: class extends Error {},
    requestJson: () => Promise.resolve(detail.value),
}));

import { DaySheet } from './day-sheet';
import { StatusGrid } from './status-grid';

afterEach(cleanup);

const row: GridRow = {
    id: '01HRIZKY',
    name: 'Rizky Ananda',
    initials: 'RA',
    division: 'Operasional',
    position: null,
    cells: [
        {
            date: '2026-10-07',
            code: 'present',
            check_in: '07.58',
            check_out: '17.01',
            manual: false,
            from_request: false,
            has_logs: true,
        },
        {
            date: '2026-10-08',
            code: 'absent',
            check_in: null,
            check_out: null,
            manual: true,
            from_request: false,
            has_logs: false,
        },
    ],
    totals: { present: 1, late: 0, absent: 1, permit_sick_leave: 0 },
    problems: 1,
};

function dayDetail(overrides: Partial<DayDetail> = {}): DayDetail {
    return {
        employee: { id: row.id, name: row.name },
        date: '2026-10-08',
        scheduled: true,
        shift: 'Reguler 08.00–17.00',
        holiday: null,
        exists: true,
        status: 'absent',
        status_label: 'Alpha',
        check_in: null,
        check_out: null,
        late_minutes: 0,
        manual: false,
        set_by: null,
        set_at: null,
        from_request: false,
        request: null,
        has_logs: false,
        locked: false,
        can: { set_status: true, clear: true },
        logs: [],
        history: [],
        wage_effect: {
            paid: false,
            paid_days: 0,
            pending: false,
            label: 'Tidak dibayar · Alpha',
            daily_wage: 150000,
        },
        ...overrides,
    };
}

describe('StatusGrid', () => {
    it('renders one named button per day and reports the clicked cell', () => {
        const onSelect = vi.fn();

        render(
            <StatusGrid
                rows={[row]}
                dates={['2026-10-07', '2026-10-08']}
                today="2026-10-08"
                monthLabel="Oktober 2026"
                selected={null}
                onSelect={onSelect}
            />,
        );

        const present = screen.getByRole('button', {
            name: 'Rizky Ananda, 7 Okt: Hadir · 07.58–17.01',
        });
        const absent = screen.getByRole('button', {
            name: 'Rizky Ananda, 8 Okt: Alpha · diatur HR',
        });

        expect(present.textContent).toBe('H');
        expect(absent.textContent).toBe('A');

        fireEvent.click(absent);

        expect(onSelect).toHaveBeenCalledWith(row, row.cells[1]);
    });
});

describe('DaySheet', () => {
    it('asks for times only for attended statuses', async () => {
        detail.value = dayDetail();

        render(
            <DaySheet
                target={{
                    employeeId: row.id,
                    name: row.name,
                    date: '2026-10-08',
                }}
                variant="desktop"
                reload={['grid']}
                onClose={() => {}}
            />,
        );

        const status = await screen.findByRole('group', {
            name: 'Tetapkan status',
        });

        expect(screen.queryByLabelText('Jam masuk')).toBeNull();

        fireEvent.click(within(status).getByRole('button', { name: /Hadir/ }));
        expect(screen.getByLabelText('Jam masuk')).toBeTruthy();
        expect(screen.getByLabelText('Jam pulang')).toBeTruthy();
        expect(screen.getByText('dibayar 1 hari (Rp150.000)')).toBeTruthy();

        fireEvent.click(within(status).getByRole('button', { name: /Izin/ }));
        expect(screen.queryByLabelText('Jam masuk')).toBeNull();
    });

    it('explains why a day with check-in logs cannot be cleared', async () => {
        detail.value = dayDetail({
            status: 'present',
            status_label: 'Hadir',
            has_logs: true,
            can: { set_status: true, clear: false },
        });

        render(
            <DaySheet
                target={{
                    employeeId: row.id,
                    name: row.name,
                    date: '2026-10-07',
                }}
                variant="mobile"
                reload={['grid']}
                onClose={() => {}}
            />,
        );

        const clear = await screen.findByRole('button', {
            name: /Hapus catatan absen hari ini/,
        });

        expect((clear as HTMLButtonElement).disabled).toBe(true);
        expect(
            screen.getByText(/punya catatan check-in, jadi tidak bisa dihapus/),
        ).toBeTruthy();
    });
});
