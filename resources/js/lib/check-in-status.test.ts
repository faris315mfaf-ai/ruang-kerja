import { describe, expect, it } from 'vite-plus/test';
import type { AttendanceStatusSummary } from '@/types/attendance';
import { shellStatus } from './check-in-status';

const base: AttendanceStatusSummary = {
    action: 'check_in',
    status: null,
    statusLabel: null,
    checkInAt: null,
    checkOutAt: null,
    lateMinutes: 0,
    locationName: null,
    isRemote: false,
    shiftName: 'Reguler',
    start: '2026-10-05T01:00:00Z',
    startLabel: '08.00',
    end: '2026-10-05T10:00:00Z',
    endLabel: '17.00',
    distanceM: null,
    isHoliday: false,
};

describe('shellStatus', () => {
    it('shows the schedule before check-in', () => {
        expect(shellStatus(base)).toMatchObject({
            title: 'Belum check-in',
            detail: 'Jadwal masuk 08.00 · Reguler',
            button: { label: 'Check-in' },
        });
    });

    it('shows check-in time and place, offering check-out', () => {
        const status = shellStatus({
            ...base,
            action: 'check_out',
            status: 'present',
            checkInAt: '2026-10-05T00:41:00Z',
            locationName: 'Kantor Pusat',
        });

        expect(status).toMatchObject({
            title: 'Sudah check-in',
            detail: 'Masuk 07.41 · Kantor Pusat',
            tone: 'success',
            button: { label: 'Check-out' },
        });
    });

    it('flags lateness and hides the button when done', () => {
        expect(
            shellStatus({
                ...base,
                action: 'check_out',
                status: 'late',
                lateMinutes: 24,
                checkInAt: '2026-10-05T01:34:00Z',
            }).title,
        ).toBe('Terlambat 24m');
        expect(
            shellStatus({
                ...base,
                action: 'done',
                checkInAt: '2026-10-05T00:41:00Z',
                checkOutAt: '2026-10-05T10:05:00Z',
            }),
        ).toMatchObject({
            detail: '07.41 – 17.05',
            button: null,
        });
    });

    it('falls back without data', () => {
        expect(shellStatus(null).button?.label).toBe('Check-in');
    });
});
