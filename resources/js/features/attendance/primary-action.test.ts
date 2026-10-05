import { describe, expect, it } from 'vite-plus/test';
import type { TodayAttendance } from '@/types/attendance';
import { primaryAction } from './primary-action';

const today = (overrides: Partial<TodayAttendance> = {}): TodayAttendance => ({
    action: 'check_in',
    day: null,
    locations: [],
    schedule: {
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
    },
    ...overrides,
});

describe('primaryAction', () => {
    it('offers check-in once the window is open', () => {
        expect(
            primaryAction(today(), new Date('2026-10-05T00:52:00Z')),
        ).toEqual({
            label: 'Ambil selfie & check-in',
            type: 'in',
            disabled: false,
        });
    });

    it('is disabled before the check-in window', () => {
        expect(
            primaryAction(today(), new Date('2026-10-04T22:00:00Z')),
        ).toEqual({
            label: 'Check-in dibuka pukul 06.00',
            type: null,
            disabled: true,
        });
    });

    it('offers check-out, then nothing', () => {
        expect(
            primaryAction(today({ action: 'check_out' }), new Date()).type,
        ).toBe('out');
        expect(
            primaryAction(today({ action: 'done' }), new Date()).disabled,
        ).toBe(true);
    });
});
