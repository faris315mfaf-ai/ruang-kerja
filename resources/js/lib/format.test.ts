import { describe, expect, it } from 'vite-plus/test';

import {
    OFFICE_TIMEZONE,
    formatDate,
    formatDateTime,
    formatNumber,
    formatPercent,
    formatRelative,
    formatTime,
    toDate,
} from './format';

describe('OFFICE_TIMEZONE', () => {
    it('is Asia/Jakarta', () => {
        expect(OFFICE_TIMEZONE).toBe('Asia/Jakarta');
    });
});

describe('toDate', () => {
    it('parses Laravel ISO strings with microseconds', () => {
        expect(toDate('2026-10-04T17:05:00.000000Z')?.toISOString()).toBe(
            '2026-10-04T17:05:00.000Z',
        );
    });

    it('returns null for empty or invalid input', () => {
        expect(toDate(null)).toBeNull();
        expect(toDate(undefined)).toBeNull();
        expect(toDate('')).toBeNull();
        expect(toDate('bukan tanggal')).toBeNull();
    });
});

describe('formatDate', () => {
    it('formats in Indonesian with short weekday and month', () => {
        expect(formatDate('2026-10-03T02:00:00Z')).toBe('Sab, 3 Okt 2026');
    });

    it('converts UTC to Jakarta across midnight', () => {
        // 17:05 UTC on Sunday is 00:05 WIB on Monday.
        expect(formatDate('2026-10-04T17:05:00Z')).toBe('Sen, 5 Okt 2026');
        expect(formatDate('2026-10-04T16:59:00Z')).toBe('Min, 4 Okt 2026');
    });

    it('accepts Date, string and epoch milliseconds', () => {
        const iso = '2026-10-04T17:05:00Z';
        const date = new Date(iso);

        expect(formatDate(date)).toBe('Sen, 5 Okt 2026');
        expect(formatDate(date.getTime())).toBe('Sen, 5 Okt 2026');
        expect(formatDate(iso)).toBe('Sen, 5 Okt 2026');
    });

    it('keeps date-only strings on the same calendar day', () => {
        expect(formatDate('2026-10-05')).toBe('Sen, 5 Okt 2026');
    });

    it('uses Indonesian month abbreviations', () => {
        expect(formatDate('2026-05-12T03:00:00Z')).toBe('Sel, 12 Mei 2026');
        expect(formatDate('2026-08-17T03:00:00Z')).toBe('Sen, 17 Agu 2026');
        expect(formatDate('2026-12-25T03:00:00Z')).toBe('Jum, 25 Des 2026');
    });

    it('returns a placeholder for empty values', () => {
        expect(formatDate(null)).toBe('–');
        expect(formatDate('invalid')).toBe('–');
    });
});

describe('formatTime', () => {
    it('uses a 24-hour clock with a dot separator', () => {
        expect(formatTime('2026-10-05T01:05:00Z')).toBe('08.05');
        expect(formatTime('2026-10-05T10:30:00Z')).toBe('17.30');
    });

    it('converts UTC to Jakarta across midnight', () => {
        expect(formatTime('2026-10-04T17:05:00Z')).toBe('00.05');
        expect(formatTime(Date.UTC(2026, 9, 4, 16, 59))).toBe('23.59');
    });

    it('returns a placeholder for empty values', () => {
        expect(formatTime(undefined)).toBe('–');
    });
});

describe('formatDateTime', () => {
    it('combines date and time', () => {
        expect(formatDateTime('2026-10-04T17:05:00Z')).toBe(
            'Sen, 5 Okt 2026 00.05',
        );
    });
});

describe('formatRelative', () => {
    // Monday 5 Oct 2026, 10:00 WIB.
    const now = new Date('2026-10-05T03:00:00Z');
    const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
    const minutesAhead = (m: number) => new Date(now.getTime() + m * 60_000);

    it('says "baru saja" under a minute in either direction', () => {
        expect(formatRelative(now, now)).toBe('baru saja');
        expect(formatRelative(new Date(now.getTime() - 30_000), now)).toBe(
            'baru saja',
        );
        expect(formatRelative(new Date(now.getTime() + 30_000), now)).toBe(
            'baru saja',
        );
    });

    it('formats minutes and hours in the past', () => {
        expect(formatRelative(minutesAgo(5), now)).toBe('5 menit lalu');
        expect(formatRelative(minutesAgo(59), now)).toBe('59 menit lalu');
        expect(formatRelative(minutesAgo(120), now)).toBe('2 jam lalu');
        expect(formatRelative(minutesAgo(23 * 60 + 59), now)).toBe(
            '23 jam lalu',
        );
    });

    it('formats minutes and hours in the future', () => {
        expect(formatRelative(minutesAhead(5), now)).toBe('dalam 5 menit');
        expect(formatRelative(minutesAhead(120), now)).toBe('dalam 2 jam');
    });

    it('uses "kemarin" and "besok" for adjacent calendar days', () => {
        expect(formatRelative('2026-10-04T02:00:00Z', now)).toBe('kemarin');
        expect(formatRelative('2026-10-06T04:00:00Z', now)).toBe('besok');
    });

    it('counts calendar days in Jakarta, not UTC', () => {
        // now = Tue 6 Oct 00:30 WIB; value = Sun 4 Oct 23:00 WIB (25.5 h ago).
        const lateNow = new Date('2026-10-05T17:30:00Z');

        expect(formatRelative('2026-10-04T16:00:00Z', lateNow)).toBe(
            '2 hari lalu',
        );
    });

    it('formats days, weeks, months and years', () => {
        expect(formatRelative('2026-10-02T03:00:00Z', now)).toBe('3 hari lalu');
        expect(formatRelative('2026-10-08T03:00:00Z', now)).toBe(
            'dalam 3 hari',
        );
        expect(formatRelative('2026-09-21T03:00:00Z', now)).toBe(
            '2 minggu lalu',
        );
        expect(formatRelative('2026-07-05T03:00:00Z', now)).toBe(
            '3 bulan lalu',
        );
        expect(formatRelative('2024-10-05T03:00:00Z', now)).toBe(
            '2 tahun lalu',
        );
    });

    it('accepts strings and numbers for both arguments', () => {
        expect(
            formatRelative(minutesAgo(5).toISOString(), now.toISOString()),
        ).toBe('5 menit lalu');
        expect(formatRelative(minutesAgo(5).getTime(), now.getTime())).toBe(
            '5 menit lalu',
        );
    });

    it('returns a placeholder for empty values', () => {
        expect(formatRelative(null, now)).toBe('–');
    });
});

describe('formatNumber', () => {
    it('uses dots for thousands and commas for decimals', () => {
        expect(formatNumber(1250)).toBe('1.250');
        expect(formatNumber(1250000)).toBe('1.250.000');
        expect(formatNumber(1250.5)).toBe('1.250,5');
        expect(formatNumber(0)).toBe('0');
    });

    it('returns a placeholder for empty or non-finite values', () => {
        expect(formatNumber(null)).toBe('–');
        expect(formatNumber(Number.NaN)).toBe('–');
    });
});

describe('formatPercent', () => {
    it('formats percent units with an Indonesian decimal comma', () => {
        expect(formatPercent(92)).toBe('92%');
        expect(formatPercent(92.5)).toBe('92,5%');
        expect(formatPercent(92.56)).toBe('92,6%');
        expect(formatPercent(92.56, 0)).toBe('93%');
        expect(formatPercent(0)).toBe('0%');
    });

    it('returns a placeholder for empty values', () => {
        expect(formatPercent(undefined)).toBe('–');
    });
});
