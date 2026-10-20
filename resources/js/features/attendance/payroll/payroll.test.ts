import { describe, expect, it } from 'vite-plus/test';
import {
    formatDays,
    formatRupiahInput,
    nextMonthStart,
    parseRupiahInput,
    periodStatus,
    wageRanges,
} from './payroll';
import type { PayrollReport } from './types';

const period = (
    overrides: Partial<PayrollReport['period']> = {},
): PayrollReport['period'] => ({
    month: '2026-10',
    label: 'Oktober 2026',
    locked: false,
    locked_at: null,
    locked_by_name: null,
    workdays_elapsed: 14,
    workdays_total: 22,
    computed_at: null,
    ...overrides,
});

describe('payroll helpers', () => {
    it('reads and writes Rupiah text fields', () => {
        expect(parseRupiahInput('160.000')).toBe(160000);
        expect(parseRupiahInput('Rp 1.250.000,-')).toBe(1250000);
        expect(parseRupiahInput('')).toBeNull();
        expect(formatRupiahInput(160000)).toBe('160.000');
        expect(formatRupiahInput(null)).toBe('');
        expect(formatDays(1.5)).toBe('1,5 hari');
    });

    it('labels the period draft or locked', () => {
        expect(periodStatus(period(), true)).toEqual({
            label: 'Draf · periode berjalan',
            tone: 'warning',
        });
        expect(periodStatus(period(), false).label).toBe(
            'Draf · belum dikunci',
        );
        expect(
            periodStatus(
                period({ locked: true, locked_by_name: 'Hana Putri' }),
                false,
            ),
        ).toEqual({ label: 'Terkunci oleh Hana Putri', tone: 'success' });
    });

    it('derives wage validity ranges, newest first', () => {
        const wage = (id: string, from: string) => ({
            id,
            daily_wage: 150000,
            effective_from: from,
            note: null,
            created_by_name: null,
            updated_at: null,
            locked: false,
        });
        const ranges = wageRanges(
            [
                wage('a', '2025-03-01'),
                wage('c', '2026-11-01'),
                wage('b', '2026-01-01'),
            ],
            '2026-10-20',
        );

        expect(ranges).toEqual([
            {
                id: 'c',
                range: 'Sejak 01/11/2026',
                current: false,
                upcoming: true,
            },
            {
                id: 'b',
                range: '01/01/2026 – 31/10/2026',
                current: true,
                upcoming: false,
            },
            {
                id: 'a',
                range: '01/03/2025 – 31/12/2025',
                current: false,
                upcoming: false,
            },
        ]);
    });

    it('finds the first day of the next month', () => {
        expect(nextMonthStart('2026-10')).toBe('2026-11-01');
        expect(nextMonthStart('2026-12')).toBe('2027-01-01');
    });
});
