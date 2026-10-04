import { describe, expect, it } from 'vite-plus/test';

import {
    addDays,
    diffDays,
    dueGroup,
    dueState,
    dueTone,
    endOfWeek,
    formatDayRange,
    formatDue,
    formatMonthYear,
    formatShortDate,
    isoWeekday,
    officeToday,
    startOfWeek,
} from './due-date';

// Mockup "today": Monday 5 October 2026.
const TODAY = '2026-10-05';

describe('date arithmetic', () => {
    it('adds and diffs whole days across months', () => {
        expect(addDays('2026-09-30', 2)).toBe('2026-10-02');
        expect(addDays(TODAY, -6)).toBe('2026-09-29');
        expect(diffDays(TODAY, '2026-10-08')).toBe(3);
        expect(diffDays(TODAY, '2026-10-03')).toBe(-2);
    });

    it('uses Monday-first ISO weeks', () => {
        expect(isoWeekday(TODAY)).toBe(1);
        expect(isoWeekday('2026-10-11')).toBe(7);
        expect(startOfWeek('2026-10-08')).toBe(TODAY);
        expect(endOfWeek(TODAY)).toBe('2026-10-11');
    });

    it('computes today in the office timezone', () => {
        // 18:30 UTC on 4 Oct is already 5 Oct 01:30 in Jakarta.
        expect(officeToday(new Date('2026-10-04T18:30:00Z'))).toBe(TODAY);
    });
});

describe('formatting', () => {
    it('formats short dates and ranges in Indonesian', () => {
        expect(formatShortDate('2026-10-08')).toBe('Kam, 8 Okt');
        expect(formatDayRange('2026-10-06', '2026-10-11')).toBe('6–11 Okt');
        expect(formatDayRange('2026-09-28', '2026-10-04')).toBe(
            '28 Sep–4 Okt',
        );
        expect(formatMonthYear(TODAY)).toBe('Oktober 2026');
    });

    it('labels due dates like the mockups', () => {
        expect(formatDue('2026-10-03', TODAY)).toBe('Lewat 2 hari');
        expect(formatDue(TODAY, TODAY)).toBe('Hari ini');
        expect(formatDue('2026-10-06', TODAY)).toBe('Besok');
        expect(formatDue('2026-10-09', TODAY)).toBe('Jum, 9 Okt');
        expect(formatDue('2026-10-16', TODAY)).toBe('16 Okt');
        expect(formatDue('2027-01-04', TODAY)).toBe('4 Jan 2027');
    });
});

describe('due state, tone and group', () => {
    it('classifies due dates', () => {
        expect(dueState('2026-10-04', TODAY)).toBe('overdue');
        expect(dueState(TODAY, TODAY)).toBe('today');
        expect(dueState('2026-10-06', TODAY)).toBe('tomorrow');
        expect(dueState('2026-10-11', TODAY)).toBe('week');
        expect(dueState('2026-10-12', TODAY)).toBe('later');
    });

    it('colors only open tasks that are due soon or late', () => {
        expect(dueTone('2026-10-04', TODAY, false)).toBe('danger');
        expect(dueTone('2026-10-06', TODAY, false)).toBe('warning');
        expect(dueTone('2026-10-09', TODAY, false)).toBe('muted');
        expect(dueTone('2026-10-04', TODAY, true)).toBe('muted');
        expect(dueTone(null, TODAY, false)).toBe('muted');
    });

    it('groups tasks for "Tugas saya"', () => {
        expect(dueGroup('2026-10-04', TODAY)).toBe('overdue');
        expect(dueGroup(TODAY, TODAY)).toBe('today');
        expect(dueGroup('2026-10-06', TODAY)).toBe('week');
        expect(dueGroup('2026-10-11', TODAY)).toBe('week');
        expect(dueGroup('2026-10-12', TODAY)).toBe('later');
        expect(dueGroup(null, TODAY)).toBe('none');
    });
});
