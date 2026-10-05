import { describe, expect, it } from 'vitest';
import {
    daysBetween,
    dueLabel,
    flagSummary,
    percent,
    pointsLabel,
    positionPercent,
    shortDay,
    updateAgeLabel,
    weekdayDay,
} from './lib';
import type { ProjectMetrics } from './types';

const metrics = (overrides: Partial<ProjectMetrics> = {}): ProjectMetrics => ({
    actual: 25,
    planned: 57,
    variance: -32,
    uses_estimates: false,
    flags: [],
    overdue: 0,
    scope: 12,
    done: 3,
    update_age_days: 9,
    days_left: 26,
    milestones_total: 4,
    milestones_done: 1,
    missed_milestones: [],
    milestones: [],
    ...overrides,
});

describe('portfolio lib', () => {
    it('formats office-calendar dates without timezone drift', () => {
        expect(shortDay('2026-10-09')).toBe('9 Okt');
        expect(weekdayDay('2026-10-09')).toBe('Jum, 9 Okt');
        expect(weekdayDay('2026-10-05')).toBe('Sen, 5 Okt');
        expect(shortDay(null)).toBe('–');
        expect(daysBetween('2026-10-05', '2026-10-27')).toBe(22);
        expect(daysBetween('2026-10-05', '2026-10-01')).toBe(-4);
    });

    it('labels due dates and update age', () => {
        expect(dueLabel(4)).toBe('4 hari lagi');
        expect(dueLabel(1)).toBe('besok');
        expect(dueLabel(0)).toBe('hari ini');
        expect(dueLabel(-2)).toBe('lewat 2 hari');
        expect(updateAgeLabel(1)).toBe('Kemarin');
        expect(updateAgeLabel(9)).toBe('9 hari lalu');
        expect(updateAgeLabel(0)).toBe('Hari ini');
        expect(updateAgeLabel(null)).toBe('Belum ada update');
    });

    it('rounds percentages and variance', () => {
        expect(percent(48.4)).toBe('48%');
        expect(percent(null)).toBe('–');
        expect(pointsLabel(-12.6)).toBe('−13 poin');
        expect(pointsLabel(4.2)).toBe('+4 poin');
        expect(pointsLabel(0.2)).toBe('0 poin');
    });

    it('summarizes system flags like the mockup', () => {
        expect(
            flagSummary(
                metrics({
                    flags: ['behind', 'missed_milestone', 'stale_update'],
                    missed_milestones: [
                        {
                            id: '1',
                            name: 'Shortlist',
                            target_date: '2026-09-30',
                        },
                    ],
                }),
            ),
        ).toBe('Tertinggal 32 poin · Milestone terlewat · Update 9 hari');
        expect(
            flagSummary(
                metrics({ flags: ['stale_update'], update_age_days: null }),
            ),
        ).toBe('Belum ada update');
        expect(flagSummary(metrics())).toBe('');
    });

    it('places dates on the roadmap', () => {
        // 1 Aug … 31 Dec = 153 days.
        expect(positionPercent('2026-08-01', '2026-08-01', '2026-12-31')).toBe(
            0,
        );
        expect(positionPercent('2027-02-01', '2026-08-01', '2026-12-31')).toBe(
            100,
        );
        expect(
            Math.round(
                positionPercent('2026-10-05', '2026-08-01', '2026-12-31'),
            ),
        ).toBe(42);
    });
});
