import { describe, expect, it } from 'vite-plus/test';
import type { AttendanceDayData, TodayAttendance } from '@/types/attendance';
import { dayTiles, scheduleLine, statusPill } from './check-in-card';

const schedule: TodayAttendance['schedule'] = {
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
};

const day = (
    overrides: Partial<AttendanceDayData> = {},
): AttendanceDayData => ({
    id: 'd1',
    workDate: '2026-10-05',
    status: 'present',
    statusLabel: 'Hadir',
    shiftName: 'Reguler',
    hours: '08.00–17.00',
    scheduledStart: schedule.start,
    scheduledEnd: schedule.end,
    checkInAt: '2026-10-05T00:41:00Z',
    checkOutAt: null,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    workMinutes: 0,
    isSuspicious: false,
    requestPortion: null,
    checkIn: null,
    checkOut: null,
    ...overrides,
});

const today = (overrides: Partial<TodayAttendance> = {}): TodayAttendance => ({
    action: 'check_in',
    day: null,
    locations: [
        {
            id: 'l1',
            name: 'Kantor Pusat',
            address: null,
            latitude: -6.2,
            longitude: 106.8,
            radiusM: 100,
        },
    ],
    schedule,
    windows: { checkIn: null, checkOut: null },
    windowsApply: true,
    checkInBlocked: null,
    checkOutBlockedReason: null,
    ...overrides,
});

describe('scheduleLine', () => {
    it('names the shift hours and the only office (DAbsensi subtitle)', () => {
        expect(scheduleLine(today())).toBe(
            'Shift Reguler 08.00–17.00 · Kantor Pusat',
        );
    });

    it('reads the holiday name', () => {
        expect(
            scheduleLine(
                today({
                    schedule: {
                        ...schedule,
                        isHoliday: true,
                        holidayName: 'Maulid Nabi',
                    },
                }),
            ),
        ).toBe('Libur · Maulid Nabi');
    });
});

describe('statusPill', () => {
    it('follows the day action', () => {
        expect(statusPill(today()).label).toBe('Belum check-in');
        expect(statusPill(today({ action: 'check_out', day: day() }))).toEqual({
            label: 'Sudah check-in',
            tone: 'info',
        });
        expect(statusPill(today({ action: 'done', day: day() }))).toEqual({
            label: 'Selesai hari ini',
            tone: 'success',
        });
    });
});

describe('dayTiles', () => {
    it('shows the schedule before checking in', () => {
        const tiles = dayTiles(today(), new Date('2026-10-05T00:30:00Z'));

        expect(tiles.map((tile) => [tile.value, tile.note])).toEqual([
            ['08.00', 'Terjadwal'],
            ['17.00', 'Terjadwal'],
            ['–', 'Belum mulai'],
        ]);
    });

    it('counts the running duration after checking in late', () => {
        const tiles = dayTiles(
            today({
                action: 'check_out',
                day: day({
                    status: 'late',
                    checkInAt: '2026-10-05T01:21:00Z',
                    lateMinutes: 11,
                }),
            }),
            new Date('2026-10-05T06:26:00Z'),
        );

        expect(tiles[0]).toMatchObject({
            value: '08.21',
            note: 'Terlambat 11 mnt',
            tone: 'warning',
        });
        expect(tiles[2]).toMatchObject({ value: '5 j 05 m', note: 'Berjalan' });
    });
});
