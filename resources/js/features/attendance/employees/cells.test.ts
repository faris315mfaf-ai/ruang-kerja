import { describe, expect, it } from 'vite-plus/test';
import {
    CELL_STYLES,
    cellAriaLabel,
    cellStyle,
    dayHeader,
    defaultDate,
    isAttended,
    matchesDayFilter,
    monthDates,
    wageHint,
    weekStripDates,
} from './cells';
import type { GridCell } from './types';

const cell = (overrides: Partial<GridCell> = {}): GridCell => ({
    date: '2026-10-08',
    code: 'absent',
    check_in: null,
    check_out: null,
    manual: false,
    from_request: false,
    has_logs: false,
    ...overrides,
});

describe('grid cells', () => {
    it('maps every status to the mockup letter', () => {
        const letters = Object.fromEntries(
            Object.entries(CELL_STYLES).map(([code, style]) => [
                code,
                style.letter,
            ]),
        );

        expect(letters).toMatchObject({
            present: 'H',
            late: 'T',
            absent: 'A',
            permit: 'I',
            sick: 'S',
            leave: 'C',
            business_trip: 'D',
            wfh: 'W',
            needs_correction: '!',
            not_checked_in: '·',
            holiday: '',
            future: '',
        });
    });

    it('uses token classes only and falls back for unknown codes', () => {
        expect(cellStyle('present').className).toContain('bg-success-soft');
        expect(cellStyle('absent').className).toContain('text-danger');
        expect(cellStyle('something-new')).toBe(CELL_STYLES.off);

        for (const style of Object.values(CELL_STYLES)) {
            expect(style.className).not.toMatch(/#[0-9a-f]{3,6}/i);
        }
    });

    it('names a cell for screen readers with times and the manual mark', () => {
        expect(cellAriaLabel('Rizky Ananda', cell())).toBe(
            'Rizky Ananda, 8 Okt: Alpha',
        );
        expect(
            cellAriaLabel(
                'Sari',
                cell({
                    code: 'late',
                    check_in: '08.24',
                    check_out: '17.02',
                    manual: true,
                }),
            ),
        ).toBe('Sari, 8 Okt: Terlambat · 08.24–17.02 · diatur HR');
    });

    it('builds day headers with Indonesian weekday letters', () => {
        expect(dayHeader('2026-10-20')).toEqual({
            letter: 'S',
            short: 'Sel',
            day: 20,
            weekend: false,
        });
        expect(dayHeader('2026-10-24').weekend).toBe(true);
        expect(dayHeader('2026-10-22').letter).toBe('K');
    });

    it('only asks for times on attended statuses', () => {
        expect(isAttended('present')).toBe(true);
        expect(isAttended('late')).toBe(true);
        expect(isAttended('wfh')).toBe(true);
        expect(isAttended('business_trip')).toBe(true);
        expect(isAttended('permit')).toBe(false);
        expect(isAttended('absent')).toBe(false);
        expect(isAttended(null)).toBe(false);
    });

    it('hints the pay effect and hides the amount without a wage', () => {
        expect(wageHint('present', 150000)).toBe('dibayar 1 hari (Rp150.000)');
        expect(wageHint('late', null)).toBe('dibayar 1 hari');
        expect(wageHint('absent', 150000)).toBe('tidak dibayar');
        expect(wageHint('permit', 150000)).toBe(
            'mengikuti aturan gaji untuk izin',
        );
        expect(wageHint('holiday', null)).toBe(
            'bukan hari kerja, tidak dihitung',
        );
    });

    it('filters a date for the mobile chips', () => {
        expect(matchesDayFilter('not_checked_in', 'missing')).toBe(true);
        expect(matchesDayFilter('none', 'missing')).toBe(true);
        expect(matchesDayFilter('present', 'missing')).toBe(false);
        expect(matchesDayFilter('late', 'late')).toBe(true);
        expect(matchesDayFilter('absent', 'all')).toBe(true);
    });
});

describe('dates', () => {
    it('lists every date of a month', () => {
        const dates = monthDates('2026-02-01', '2026-02-28');

        expect(dates).toHaveLength(28);
        expect(dates[0]).toBe('2026-02-01');
        expect(dates.at(-1)).toBe('2026-02-28');
    });

    it('centres the week strip and clamps it to the month', () => {
        expect(
            weekStripDates('2026-10-20', '2026-10-01', '2026-10-31'),
        ).toEqual([
            '2026-10-17',
            '2026-10-18',
            '2026-10-19',
            '2026-10-20',
            '2026-10-21',
            '2026-10-22',
            '2026-10-23',
        ]);
        expect(
            weekStripDates('2026-10-02', '2026-10-01', '2026-10-31')[0],
        ).toBe('2026-10-01');
        expect(
            weekStripDates('2026-10-31', '2026-10-01', '2026-10-31'),
        ).toEqual([
            '2026-10-25',
            '2026-10-26',
            '2026-10-27',
            '2026-10-28',
            '2026-10-29',
            '2026-10-30',
            '2026-10-31',
        ]);
    });

    it('opens on today inside the month, else the last counted day', () => {
        const period = {
            start: '2026-09-01',
            end: '2026-09-30',
            countedUntil: '2026-09-30',
        };

        expect(defaultDate('2026-09-14', period)).toBe('2026-09-14');
        expect(defaultDate('2026-10-20', period)).toBe('2026-09-30');
        expect(
            defaultDate('2026-10-20', {
                start: '2026-11-01',
                end: '2026-11-30',
                countedUntil: null,
            }),
        ).toBe('2026-11-30');
    });
});
