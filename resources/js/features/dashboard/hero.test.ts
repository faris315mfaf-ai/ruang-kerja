import { describe, expect, it } from 'vitest';
import type { AttendanceStatusSummary } from '@/types/attendance';
import { greeting } from './lib';
import { heroText, workedText } from './my-attendance-card';

const base: AttendanceStatusSummary = {
    action: 'check_in',
    status: null,
    statusLabel: null,
    checkInAt: null,
    checkOutAt: null,
    lateMinutes: 0,
    locationName: 'Kantor Pusat',
    isRemote: false,
    shiftName: 'Reguler',
    start: null,
    startLabel: '08.00',
    end: null,
    endLabel: '17.00',
    distanceM: null,
    isHoliday: false,
};

describe('greeting', () => {
    it('follows the office clock (Asia/Jakarta)', () => {
        expect(greeting(new Date('2026-10-05T00:30:00Z'))).toBe('Selamat pagi');
        expect(greeting(new Date('2026-10-05T05:00:00Z'))).toBe(
            'Selamat siang',
        );
        expect(greeting(new Date('2026-10-05T09:00:00Z'))).toBe('Selamat sore');
        expect(greeting(new Date('2026-10-05T13:00:00Z'))).toBe(
            'Selamat malam',
        );
    });
});

describe('attendance hero', () => {
    it('shows the schedule before check-in', () => {
        expect(heroText(base)).toEqual({
            chip: 'Belum check-in',
            big: 'Jadwal 08.00–17.00',
            sub: 'Shift Reguler · Kantor Pusat',
        });
    });

    it('shows the check-in time and lateness while at work', () => {
        const text = heroText({
            ...base,
            action: 'check_out',
            status: 'late',
            lateMinutes: 12,
            checkInAt: '2026-10-05T01:12:00Z',
        });

        expect(text.chip).toBe('Sudah check-in · terlambat 12 menit');
        expect(text.big).toBe('Masuk 08.12');
        expect(text.sub).toBe('Kantor Pusat · pulang terjadwal 17.00');
    });

    it('shows the worked duration when the day is done', () => {
        const text = heroText({
            ...base,
            action: 'done',
            status: 'present',
            checkInAt: '2026-10-05T00:52:00Z',
            checkOutAt: '2026-10-05T10:04:00Z',
        });

        expect(text.big).toBe('07.52 – 17.04');
        expect(text.sub).toBe('9 jam 12 menit · Kantor Pusat');
    });

    it('computes worked time only for a valid range', () => {
        expect(workedText('2026-10-05T01:00:00Z', '2026-10-05T01:45:00Z')).toBe(
            '45 menit',
        );
        expect(workedText(null, '2026-10-05T01:45:00Z')).toBeNull();
        expect(
            workedText('2026-10-05T02:00:00Z', '2026-10-05T01:00:00Z'),
        ).toBeNull();
    });
});
