import { describe, expect, it } from 'vitest';
import type { TodayCounts } from '@/types/dashboard';
import {
    awayBreakdown,
    busiestDay,
    compared,
    deltaText,
    deltaTone,
    formatMetric,
    share,
    todayCaption,
} from './lib';

const counts: TodayCounts = {
    scheduled: 14,
    present: 12,
    late: 2,
    away: 2,
    not_checked_in: 0,
    absent: 0,
    leave: 1,
    permit: 0,
    sick: 1,
    business_trip: 0,
};

describe('dashboard formatting', () => {
    it('formats metric values per unit', () => {
        expect(formatMetric(78.4, 'percent')).toBe('78%');
        expect(formatMetric(2.46, 'days')).toBe('2,5 hari');
        expect(formatMetric(21, 'minutes')).toBe('21 menit');
        expect(formatMetric(1250, 'count')).toBe('1.250');
        expect(formatMetric(null, 'percent')).toBe('–');
    });

    it('writes the delta against the previous period', () => {
        expect(deltaText(6, 'percent', 'minggu lalu')).toBe(
            '+6 poin dari minggu lalu',
        );
        expect(deltaText(-3, 'percent', 'minggu lalu')).toBe(
            '−3 poin dari minggu lalu',
        );
        expect(deltaText(-0.5, 'days', 'bulan lalu')).toBe(
            '−0,5 hari dari bulan lalu',
        );
        expect(deltaText(2, 'count', 'bulan lalu')).toBe('+2 dari bulan lalu');
        expect(deltaText(0, 'percent', 'minggu lalu')).toBe(
            'sama dengan minggu lalu',
        );
        expect(deltaText(null, 'percent', 'minggu lalu')).toBeNull();
    });

    it('colors improvements green and regressions red', () => {
        expect(deltaTone(6)).toBe('success');
        expect(deltaTone(-3)).toBe('danger');
        expect(deltaTone(3, 'lower')).toBe('danger');
        expect(deltaTone(-3, 'lower')).toBe('success');
        expect(deltaTone(0)).toBe('neutral');
        expect(
            compared(
                {
                    value: 78,
                    previous: 72,
                    delta: 6,
                    numerator: 0,
                    denominator: 0,
                },
                'percent',
                'minggu lalu',
            ),
        ).toEqual({
            text: '+6 poin dari minggu lalu',
            tone: 'success',
            direction: 'up',
        });
    });

    it('summarizes today attendance', () => {
        expect(todayCaption(counts)).toBe(
            '2 cuti/izin/sakit · 0 belum check-in',
        );
        expect(awayBreakdown(counts)).toBe('1 cuti · 1 sakit');
        expect(awayBreakdown({ ...counts, leave: 0, sick: 0 })).toBe(
            'tidak ada',
        );
    });

    it('computes shares and the busiest day safely', () => {
        expect(share(3, 12)).toBe(25);
        expect(share(3, 0)).toBe(0);
        expect(
            busiestDay([
                { day: 'Sen', count: 2 },
                { day: 'Rab', count: 3 },
                { day: 'Kam', count: 0 },
            ]),
        ).toEqual({ day: 'Rab', count: 3 });
        expect(busiestDay([{ count: 0 }])).toBeNull();
    });
});
