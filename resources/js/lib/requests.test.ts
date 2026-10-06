import { describe, expect, it } from 'vite-plus/test';

import {
    colleagueSummary,
    datesInMonth,
    formatDateRange,
    formatDays,
    formatHours,
    formatLongDateRange,
    formatRequestDuration,
    formatRequestPeriod,
    formatRequestTitle,
    formatRupiah,
    dayUnit,
    officeDay,
    stepProgress,
} from './requests';
import type { LeaveTypeInfo } from '@/types/requests';

const type = (category: LeaveTypeInfo['category']): LeaveTypeInfo => ({
    id: 't',
    code: 'CUT',
    name: 'Cuti tahunan',
    category,
    category_label: 'Cuti',
    description: null,
    annual_quota_days: 12,
    requires_attachment_after_days: null,
    allow_half_day: true,
    max_backdate_days: null,
    is_paid: true,
    counts_calendar_days: false,
    max_days_per_request: null,
    day_unit: category === 'leave' ? 'hari kerja' : 'hari',
    is_provisional_default: false,
});

describe('officeDay', () => {
    it('reads instants in Asia/Jakarta', () => {
        // 17:00 UTC on the 11th = 00:00 on the 12th in Jakarta.
        expect(officeDay('2026-10-11T17:00:00Z')?.iso).toBe('2026-10-12');
        expect(officeDay('2026-10-12')?.weekday).toBe(1);
    });
});

describe('formatDateRange', () => {
    it('collapses the same month and day', () => {
        expect(
            formatDateRange('2026-10-11T17:00:00Z', '2026-10-14T16:59:59Z'),
        ).toBe('12–14 Okt 2026');
        expect(formatDateRange('2026-07-03', '2026-07-03')).toBe('3 Jul 2026');
        expect(formatDateRange('2026-09-28', '2026-10-02')).toBe(
            '28 Sep – 2 Okt 2026',
        );
        expect(formatDateRange('2026-12-30', '2027-01-02')).toBe(
            '30 Des 2026 – 2 Jan 2027',
        );
    });

    it('adds weekday names for the long form', () => {
        expect(formatLongDateRange('2026-10-12', '2026-10-14')).toBe(
            'Senin–Rabu, 12–14 Okt 2026',
        );
    });
});

describe('durations', () => {
    it('formats days and hours in Indonesian', () => {
        expect(formatDays(0.5)).toBe('0,5');
        expect(formatHours(210)).toBe('3,5 jam');
        expect(formatHours(120)).toBe('2 jam');
        expect(
            formatRequestDuration({
                type: type('leave'),
                days: 3,
                minutes: null,
            }),
        ).toBe('3 hari kerja');
        expect(
            formatRequestDuration({
                type: type('sick'),
                days: 1,
                minutes: null,
            }),
        ).toBe('1 hari');
        expect(
            formatRequestDuration({
                type: type('correction'),
                days: null,
                minutes: null,
            }),
        ).toBe('—');
    });

    it('uses calendar days for calendar-day leave types (Cuti melahirkan)', () => {
        const maternity = { ...type('leave'), counts_calendar_days: true };

        expect(dayUnit(maternity)).toBe('hari kalender');
        expect(dayUnit(type('leave'))).toBe('hari kerja');
        expect(dayUnit(type('permit'))).toBe('hari');
        expect(
            formatRequestDuration({ type: maternity, days: 90, minutes: null }),
        ).toBe('90 hari kalender');
    });
});

describe('formatRequestTitle', () => {
    it('joins type name and duration, name only without duration', () => {
        expect(
            formatRequestTitle({ type: type('leave'), days: 2, minutes: null }),
        ).toBe('Cuti tahunan · 2 hari kerja');
        expect(
            formatRequestTitle({
                type: type('correction'),
                days: null,
                minutes: null,
            }),
        ).toBe('Cuti tahunan');
    });
});

describe('pengajuan barang', () => {
    const procurement = {
        type: { ...type('procurement'), name: 'Pengajuan barang' },
        days: null,
        minutes: null,
        payload: { item_name: 'Laptop kantor', quantity: 2, unit: 'unit' },
    };

    it('titles with the item and counts the quantity', () => {
        expect(formatRequestTitle(procurement)).toBe(
            'Pengajuan barang · Laptop kantor',
        );
        expect(formatRequestDuration(procurement)).toBe('2 unit');
        expect(formatRequestDuration({ ...procurement, payload: {} })).toBe(
            '—',
        );
    });

    it('formats whole rupiah', () => {
        expect(formatRupiah(30000000)).toBe('Rp30.000.000');
        expect(formatRupiah(0)).toBe('Rp0');
        expect(formatRupiah(null)).toBe('–');
    });
});

describe('formatRequestPeriod', () => {
    it('shows hours for overtime and times for corrections', () => {
        expect(
            formatRequestPeriod({
                type: type('overtime'),
                start_at: '2026-09-10T10:00:00Z',
                end_at: '2026-09-10T13:00:00Z',
                minutes: 180,
                payload: {},
            }),
        ).toBe('10 Sep · 17.00–20.00');

        expect(
            formatRequestPeriod({
                type: type('correction'),
                start_at: '2026-10-01T17:00:00Z',
                end_at: '2026-10-02T16:59:59Z',
                minutes: null,
                payload: { date: '2026-10-02', check_out: '17:10' },
            }),
        ).toBe('2 Okt 2026 · check-out 17.10');
    });
});

describe('helpers', () => {
    it('describes step progress, month days and colleagues', () => {
        expect(stepProgress({ step_position: 1, step_count: 2 })).toBe(
            '1 dari 2',
        );
        expect(stepProgress({ step_position: null, step_count: 2 })).toBeNull();
        expect([
            ...datesInMonth(
                ['2026-10-12', '2026-10-13', '2026-11-02'],
                2026,
                10,
            ),
        ]).toEqual([12, 13]);
        expect(
            colleagueSummary([{ name: 'Nadia Putri', dates: ['2026-10-13'] }]),
        ).toBe('Nadia Putri juga tidak masuk pada 13 Okt');
        expect(colleagueSummary([])).toBeNull();
    });
});
