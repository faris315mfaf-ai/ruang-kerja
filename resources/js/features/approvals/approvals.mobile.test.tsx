import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import type { RequestItem } from '@/types/requests';

const post = vi.hoisted(() => vi.fn());

vi.mock('@inertiajs/react', () => ({
    router: { post, get: vi.fn() },
    usePage: () => ({ url: '/persetujuan', props: {} }),
    useForm: () => ({
        data: { note: '', redirect: '' },
        errors: {},
        processing: false,
        setData: vi.fn(),
        setError: vi.fn(),
        post: vi.fn(),
        reset: vi.fn(),
    }),
    Link: ({
        children,
        href,
        ...rest
    }: {
        children: ReactNode;
        href: string;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/routes/approvals', () => {
    const route = (path: string) =>
        Object.assign(() => path, { url: () => path });

    return {
        index: route('/persetujuan'),
        show: route('/persetujuan/x'),
        bulk: route('/persetujuan/massal'),
        approve: route('/persetujuan/x/setujui'),
        reject: route('/persetujuan/x/tolak'),
        revise: route('/persetujuan/x/revisi'),
    };
});
vi.mock('./delegation-dialog', () => ({ DelegationDialog: () => null }));

import { ApprovalsMobile } from './approvals.mobile';

function request(id: string, name: string): RequestItem {
    return {
        id,
        number: null,
        status: 'pending',
        status_label: 'Menunggu',
        type: {
            id: 'type-1',
            code: 'CT',
            name: 'Cuti tahunan',
            category: 'leave',
            category_label: 'Cuti',
            description: null,
            annual_quota_days: 12,
            requires_attachment_after_days: null,
            allow_half_day: true,
            max_backdate_days: null,
            is_paid: true,
        },
        user: { id: `u-${id}`, name, avatar: null },
        start_at: '2026-10-12T00:00:00Z',
        end_at: '2026-10-13T00:00:00Z',
        days: 2,
        minutes: null,
        payload: {},
        round: 1,
        step_position: 1,
        step_count: 2,
        waiting: {
            label: 'Anda',
            approver: null,
            since: '2026-10-05T01:00:00Z',
        },
        decision_note: null,
        submitted_at: '2026-10-05T01:00:00Z',
        created_at: null,
        updated_at: null,
        decided_at: null,
        colleagues: null,
    };
}

const items = [
    request('01J0000000000000000000000A', 'Ayu Lestari'),
    request('01J0000000000000000000000B', 'Bima Saputra'),
    request('01J0000000000000000000000C', 'Citra Dewi'),
];

function renderQueue(tab: 'menunggu' | 'diputus' = 'menunggu') {
    return render(
        <ApprovalsMobile
            tab={tab}
            counts={{ menunggu: 3, diputus: 0 }}
            items={items}
            selected={null}
            scope="Tim Anda"
            delegations={{} as never}
        />,
    );
}

describe('ApprovalsMobile "Pilih" mode', () => {
    beforeEach(() => post.mockReset());
    afterEach(cleanup);

    it('swaps swipe cards for checkboxes and back', () => {
        renderQueue();

        expect(
            screen.getAllByRole('button', { name: 'Setujui', hidden: true }),
        ).toHaveLength(3);
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

        fireEvent.click(screen.getByRole('button', { name: 'Pilih' }));

        expect(screen.getAllByRole('checkbox')).toHaveLength(3);
        // Swipe actions are gone while selecting.
        expect(
            screen.queryAllByRole('button', { name: 'Setujui', hidden: true }),
        ).toHaveLength(0);
        expect(
            screen.getByRole('button', { name: 'Setujui (0)' }),
        ).toHaveProperty('disabled', true);

        fireEvent.click(screen.getByRole('button', { name: 'Batal' }));

        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
        expect(screen.getByRole('button', { name: 'Pilih' })).toBeTruthy();
    });

    it('bulk-approves the checked requests', () => {
        renderQueue();
        fireEvent.click(screen.getByRole('button', { name: 'Pilih' }));

        const [first, , third] = screen.getAllByRole('checkbox');
        fireEvent.click(first!);
        fireEvent.click(third!);

        expect(first!.getAttribute('aria-checked')).toBe('true');
        expect(screen.getByText('2 dipilih')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Setujui (2)' }));

        expect(post).toHaveBeenCalledWith(
            '/persetujuan/massal',
            { ids: [items[0]!.id, items[2]!.id] },
            expect.any(Object),
        );
    });

    it('selects every request of the tab with "Pilih semua"', () => {
        renderQueue();
        fireEvent.click(screen.getByRole('button', { name: 'Pilih' }));
        fireEvent.click(screen.getByRole('button', { name: 'Pilih semua' }));

        expect(
            screen.getByRole('button', { name: 'Setujui (3)' }),
        ).toBeTruthy();

        fireEvent.click(
            screen.getByRole('button', { name: 'Batal pilih semua' }),
        );
        expect(
            screen.getByRole('button', { name: 'Setujui (0)' }),
        ).toBeTruthy();
    });

    it('offers no selection on the decided tab', () => {
        renderQueue('diputus');

        expect(screen.queryByRole('button', { name: 'Pilih' })).toBeNull();
    });
});
