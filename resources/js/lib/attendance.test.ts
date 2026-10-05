import { describe, expect, it } from 'vite-plus/test';
import type { DaySchedule } from '@/types/attendance';
import {
    checkInTiming,
    formatDuration,
    minutesBetween,
    shortDay,
    statusLabel,
    statusTone,
    weekdaysLabel,
    workModeLabel,
} from './attendance';

const schedule = (overrides: Partial<DaySchedule> = {}): DaySchedule => ({
    workDate: '2026-10-05',
    isWorkday: true,
    isHoliday: false,
    holidayName: null,
    isOverride: false,
    shiftName: 'Reguler',
    hours: '08.00–17.00',
    start: '2026-10-05T01:00:00Z',
    end: '2026-10-05T10:00:00Z',
    checkInOpensAt: '2026-10-04T23:00:00Z',
    lateThreshold: '2026-10-05T01:10:00Z',
    workMode: 'office',
    workModeLabel: 'Kantor',
    allowsRemote: false,
    ...overrides,
});

describe('statusLabel', () => {
    it('uses the PRD labels', () => {
        expect(statusLabel('present')).toBe('Hadir');
        expect(statusLabel('absent')).toBe('Alpha');
        expect(statusLabel('needs_correction')).toBe('Perlu koreksi');
        expect(statusLabel('business_trip')).toBe('Dinas');
    });

    it('adds minutes for late and early leave', () => {
        expect(statusLabel('late', 12)).toBe('Terlambat 12m');
        expect(statusLabel('late', 12, true)).toBe('Telat 12m');
        expect(statusLabel('early_leave', 30)).toBe('Pulang cepat 30m');
        expect(statusLabel('late', 0)).toBe('Terlambat');
    });
});

describe('statusTone', () => {
    it('maps statuses to semantic tones', () => {
        expect(statusTone('present')).toBe('success');
        expect(statusTone('late')).toBe('warning');
        expect(statusTone('absent')).toBe('danger');
        expect(statusTone('wfh')).toBe('info');
        expect(statusTone('holiday')).toBe('neutral');
    });
});

describe('formatDuration', () => {
    it('formats minutes in Indonesian', () => {
        expect(formatDuration(45)).toBe('45 menit');
        expect(formatDuration(60)).toBe('1 jam');
        expect(formatDuration(493)).toBe('8 jam 13 menit');
        expect(formatDuration(-5)).toBe('0 menit');
    });
});

describe('minutesBetween', () => {
    it('truncates to whole minutes', () => {
        expect(
            minutesBetween(
                new Date('2026-10-05T01:00:00Z'),
                new Date('2026-10-05T01:12:59Z'),
            ),
        ).toBe(12);
    });
});

describe('checkInTiming', () => {
    it('counts down to the start', () => {
        expect(
            checkInTiming(schedule(), new Date('2026-10-05T00:52:00Z')),
        ).toEqual({
            text: '8 menit sebelum jam masuk',
            tone: 'success',
            tooEarly: false,
        });
    });

    it('says when check-in opens', () => {
        const timing = checkInTiming(
            schedule(),
            new Date('2026-10-04T22:30:00Z'),
        );

        expect(timing.tooEarly).toBe(true);
        expect(timing.text).toBe('Check-in dibuka pukul 06.00');
    });

    it('reports the tolerance and lateness', () => {
        expect(
            checkInTiming(schedule(), new Date('2026-10-05T01:05:00Z')).text,
        ).toBe('Masih dalam toleransi sampai 08.10');
        expect(
            checkInTiming(schedule(), new Date('2026-10-05T01:34:00Z')),
        ).toEqual({
            text: 'Lewat 24 menit dari batas toleransi 08.10',
            tone: 'warning',
            tooEarly: false,
        });
    });

    it('handles holidays and unscheduled days', () => {
        expect(
            checkInTiming(
                schedule({
                    isWorkday: false,
                    isHoliday: true,
                    holidayName: 'Maulid Nabi',
                }),
                new Date(),
            ).text,
        ).toBe('Hari libur: Maulid Nabi. Check-in tetap bisa dicatat.');
        expect(
            checkInTiming(
                schedule({ isWorkday: false, start: null }),
                new Date(),
            ).text,
        ).toBe('Tidak ada jadwal hari ini. Check-in tetap bisa dicatat.');
    });
});

describe('weekdaysLabel', () => {
    it('compresses ranges and lists other days', () => {
        expect(weekdaysLabel([1, 2, 3, 4, 5])).toBe('Sen–Jum');
        expect(weekdaysLabel([5, 4, 3, 2, 1, 6])).toBe('Sen–Sab');
        expect(weekdaysLabel([1, 3, 5])).toBe('Sen, Rab, Jum');
        expect(weekdaysLabel([1, 2])).toBe('Sen, Sel');
        expect(weekdaysLabel([1, 2, 3, 4, 5, 6, 7])).toBe('Setiap hari');
        expect(weekdaysLabel([])).toBe('–');
    });
});

describe('shortDay and workModeLabel', () => {
    it('formats compact labels', () => {
        expect(shortDay('2026-09-28')).toBe('Sen 28');
        expect(shortDay('2026-10-02')).toBe('Jum 2');
        expect(workModeLabel('field')).toBe('Lapangan');
    });
});
