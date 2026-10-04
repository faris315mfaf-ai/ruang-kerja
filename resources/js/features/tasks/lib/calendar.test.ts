import { describe, expect, it } from 'vite-plus/test';

import {
    addMonths,
    groupByDueDate,
    isSameMonth,
    monthGrid,
    monthStart,
    weekDays,
} from './calendar';

describe('month helpers', () => {
    it('normalizes and shifts months across years', () => {
        expect(monthStart('2026-10-05')).toBe('2026-10-01');
        expect(addMonths('2026-10-05', 1)).toBe('2026-11-01');
        expect(addMonths('2026-01-31', -1)).toBe('2025-12-01');
        expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
        expect(isSameMonth('2026-10-01', '2026-10-31')).toBe(true);
    });

    it('builds a Monday-first grid like the October 2026 mockup', () => {
        const grid = monthGrid('2026-10-05');

        expect(grid).toHaveLength(5);
        expect(grid[0][0]).toBe('2026-09-28');
        expect(grid[0][3]).toBe('2026-10-01');
        expect(grid[4][6]).toBe('2026-11-01');
        expect(grid.every((week) => week.length === 7)).toBe(true);
    });

    it('lists the days of a week', () => {
        expect(weekDays('2026-10-08')).toEqual([
            '2026-10-05',
            '2026-10-06',
            '2026-10-07',
            '2026-10-08',
            '2026-10-09',
            '2026-10-10',
            '2026-10-11',
        ]);
    });
});

describe('groupByDueDate', () => {
    it('groups by date and skips undated items', () => {
        const groups = groupByDueDate([
            { id: 1, due_date: '2026-10-08' },
            { id: 2, due_date: null },
            { id: 3, due_date: '2026-10-08' },
        ]);

        expect([...groups.keys()]).toEqual(['2026-10-08']);
        expect(groups.get('2026-10-08')?.map((item) => item.id)).toEqual([
            1, 3,
        ]);
    });
});
