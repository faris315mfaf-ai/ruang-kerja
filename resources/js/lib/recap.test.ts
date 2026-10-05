import { describe, expect, it } from 'vite-plus/test';
import type { RecapDayCell, RecapRow } from '@/types/attendance';
import {
    calendarWeeks,
    cellLabel,
    isoWeekday,
    kindTone,
    lateSummary,
    legend,
    monthLabel,
    recentMonths,
    shiftMonth,
} from './recap';

function cell(
    date: string,
    overrides: Partial<RecapDayCell> = {},
): RecapDayCell {
    return {
        date,
        kind: 'present',
        isWorkday: true,
        holidayName: null,
        dayId: null,
        statusLabel: null,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        workMinutes: 0,
        overtimeMinutes: 0,
        isSuspicious: false,
        shiftName: null,
        checkIn: null,
        checkOut: null,
        ...overrides,
    };
}

describe('calendarWeeks', () => {
    it('starts on Monday with blanks before the 1st (September 2026 starts on Tuesday)', () => {
        const days = Array.from({ length: 30 }, (_, index) =>
            cell(`2026-09-${String(index + 1).padStart(2, '0')}`),
        );
        const weeks = calendarWeeks(days);

        expect(weeks).toHaveLength(5);
        expect(weeks[0][0]).toBeNull();
        expect(weeks[0][1]?.date).toBe('2026-09-01');
        expect(weeks[4].filter(Boolean)).toHaveLength(3);
        expect(weeks.every((week) => week.length === 7)).toBe(true);
    });

    it('returns no weeks for an empty month', () => {
        expect(calendarWeeks([])).toEqual([]);
    });
});

describe('labels and tones', () => {
    it('labels a late day with its minutes and sick days with the brand tone', () => {
        expect(
            cellLabel(cell('2026-09-02', { kind: 'late', lateMinutes: 11 })),
        ).toBe('+11m');
        expect(cellLabel(cell('2026-09-08', { kind: 'sick' }))).toBe('Sakit');
        expect(cellLabel(cell('2026-09-01'))).toBeNull();
        expect(kindTone('sick')).toBe('brand');
        expect(kindTone('leave')).toBe('info');
        expect(kindTone('off')).toBe('neutral');
        expect(isoWeekday('2026-10-04')).toBe(7);
    });

    it('builds the legend: on time excludes late days', () => {
        const row = {
            presentDays: 19,
            lateCount: 4,
            leaveDays: 2,
            permitDays: 0,
            businessTripDays: 0,
            sickDays: 1,
            absentDays: 0,
            offDays: 8,
        } as RecapRow;

        expect(
            legend(row).map((item) => `${item.label} ${item.count}`),
        ).toEqual([
            'Hadir 15',
            'Terlambat 4',
            'Cuti 2',
            'Sakit 1',
            'Alpha 0',
            'Libur/akhir pekan 8',
        ]);
        expect(lateSummary(4, 46)).toBe('4 · 46m');
        expect(lateSummary(0, 0)).toBe('0');
    });
});

describe('months', () => {
    it('moves across years and names months in Indonesian', () => {
        expect(shiftMonth('2026-01', -1)).toBe('2025-12');
        expect(shiftMonth('2026-12', 1)).toBe('2027-01');
        expect(monthLabel('2026-09')).toBe('September 2026');
        expect(recentMonths('2026-10', 3)).toEqual([
            '2026-10',
            '2026-09',
            '2026-08',
        ]);
    });
});
