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
    windows: { checkIn: null, checkOut: null },
    windowsApply: true,
    checkInBlocked: null,
    checkOutBlockedReason: null,
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

    it('names the company hours when check-in is not open yet', () => {
        expect(
            primaryAction(
                today({
                    checkInBlocked: {
                        code: 'too_early',
                        message:
                            'Absen masuk dibuka pukul 06.00 dan ditutup pukul 12.00.',
                        opensAt: '2026-10-04T23:00:00Z',
                    },
                }),
                new Date('2026-10-05T00:52:00Z'),
            ),
        ).toEqual({
            label: 'Check-in dibuka pukul 06.00',
            type: null,
            disabled: true,
            notice: 'Absen masuk dibuka pukul 06.00 dan ditutup pukul 12.00.',
        });
    });

    it('closes check-in after the hours', () => {
        const action = primaryAction(
            today({
                checkInBlocked: {
                    code: 'window_closed',
                    message: 'Absen masuk ditutup pukul 12.00.',
                    opensAt: null,
                },
            }),
            new Date('2026-10-05T06:00:00Z'),
        );

        expect(action).toMatchObject({
            label: 'Check-in sudah ditutup',
            type: null,
            disabled: true,
            notice: 'Absen masuk ditutup pukul 12.00.',
        });
    });

    it('shows the server reason instead of a check-out outside the hours', () => {
        const action = primaryAction(
            today({
                action: 'check_out',
                checkOutBlockedReason: 'Absen pulang dibuka pukul 15.00.',
            }),
            new Date('2026-10-05T04:00:00Z'),
        );

        expect(action.type).toBeNull();
        expect(action.disabled).toBe(true);
        expect(action.notice).toBe('Absen pulang dibuka pukul 15.00.');
    });

    it('keeps the check-out open when nothing blocks it', () => {
        expect(
            primaryAction(today({ action: 'check_out' }), new Date()),
        ).toMatchObject({ type: 'out', disabled: false });
    });
});
