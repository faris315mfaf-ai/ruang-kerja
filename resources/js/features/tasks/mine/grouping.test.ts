import { describe, expect, it } from 'vite-plus/test';

import type { MyTaskRow } from '../types';
import { groupRows, postponedDue, summarize } from './grouping';

const TODAY = '2026-10-05';

function row(id: string, overrides: Partial<MyTaskRow>): MyTaskRow {
    return {
        id,
        number: Number(id.replace(/\D/g, '') || 1),
        due_date: null,
        priority: 0,
        status_category: 'todo',
        workspace: {
            id: 'w1',
            key: 'OPS',
            name: 'Divisi Operasional',
            type: 'division',
            color: 'teal',
        },
        ...overrides,
    } as MyTaskRow;
}

const rows = [
    row('a1', { due_date: '2026-10-04' }),
    row('b2', { due_date: TODAY, priority: 1 }),
    row('c3', {
        due_date: '2026-10-08',
        workspace: {
            id: 'w2',
            key: 'PLQ',
            name: 'Proyek Peluncuran Q4',
            type: 'project',
            color: 'violet',
        },
    }),
    row('d4', { due_date: '2026-10-16' }),
    row('e5', {}),
    row('f6', { due_date: '2026-10-01', status_category: 'done' }),
];

describe('groupRows', () => {
    it('groups by due date like the mockup', () => {
        const groups = groupRows(rows.slice(0, 5), 'due', TODAY);

        expect(
            groups.map((group) => [
                group.label,
                group.items.map((item) => item.id),
            ]),
        ).toEqual([
            ['Terlambat', ['a1']],
            ['Hari ini', ['b2']],
            ['Minggu ini', ['c3']],
            ['Nanti', ['d4']],
            ['Tanpa tenggat', ['e5']],
        ]);
        expect(groups[1].hint).toBe('Sen, 5 Okt');
        expect(groups[2].hint).toBe('6–11 Okt');
    });

    it('groups by workspace and by priority', () => {
        expect(
            groupRows(rows, 'workspace', TODAY).map((group) => group.label),
        ).toEqual(['Divisi Operasional', 'Proyek Peluncuran Q4']);
        expect(
            groupRows(rows, 'priority', TODAY).map((group) => group.label),
        ).toEqual(['Urgent', 'Tanpa']);
    });
});

describe('summarize and postpone', () => {
    it('counts open, late and due today', () => {
        expect(summarize(rows, TODAY)).toEqual({
            open: 5,
            workspaces: 2,
            overdue: 1,
            today: 1,
            closed: 1,
        });
    });

    it('postpones to the next day', () => {
        expect(postponedDue('2026-10-01', TODAY)).toBe('2026-10-06');
        expect(postponedDue(null, TODAY)).toBe('2026-10-06');
        expect(postponedDue('2026-10-09', TODAY)).toBe('2026-10-10');
    });
});
