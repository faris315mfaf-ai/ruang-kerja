import { describe, expect, it } from 'vite-plus/test';
import type { CheckRejection } from '@/types/attendance';
import {
    isWindowRejection,
    windowRangeText,
    windowRejectionTitle,
    windowsLine,
    windowSuggestsCorrection,
} from './windows';

const rejection = (
    reason: CheckRejection['reason'],
    phase?: 'before' | 'after',
): CheckRejection => ({ reason, message: 'x', context: { phase } });

describe('windowRangeText', () => {
    it('formats bounded, half-open and empty ranges', () => {
        expect(windowRangeText({ from: '06:00', until: '12:00' })).toBe(
            '06.00–12.00',
        );
        expect(windowRangeText({ from: '15:00', until: null })).toBe(
            'mulai 15.00',
        );
        expect(windowRangeText({ from: null, until: '12:00' })).toBe(
            'sampai 12.00',
        );
        expect(windowRangeText({ from: null, until: null })).toBeNull();
        expect(windowRangeText(null)).toBeNull();
    });
});

describe('windowsLine', () => {
    it('summarises both hours', () => {
        expect(
            windowsLine({
                windowsApply: true,
                windows: {
                    checkIn: { from: '06:00', until: '12:00' },
                    checkOut: { from: '15:00', until: null },
                },
            }),
        ).toBe('Jam absen · masuk 06.00–12.00 · pulang mulai 15.00');
    });

    it('is hidden without hours or for overnight shifts', () => {
        expect(
            windowsLine({
                windowsApply: true,
                windows: { checkIn: null, checkOut: null },
            }),
        ).toBeNull();
        expect(
            windowsLine({
                windowsApply: false,
                windows: {
                    checkIn: { from: '06:00', until: '12:00' },
                    checkOut: null,
                },
            }),
        ).toBeNull();
    });
});

describe('window rejections', () => {
    it('recognises both reasons only', () => {
        expect(isWindowRejection('check_in_window')).toBe(true);
        expect(isWindowRejection('check_out_window')).toBe(true);
        expect(isWindowRejection('too_early')).toBe(false);
    });

    it('titles the failure by direction and phase', () => {
        expect(
            windowRejectionTitle(rejection('check_in_window', 'before')),
        ).toBe('Absen masuk belum dibuka');
        expect(
            windowRejectionTitle(rejection('check_in_window', 'after')),
        ).toBe('Absen masuk sudah ditutup');
        expect(
            windowRejectionTitle(rejection('check_out_window', 'after')),
        ).toBe('Absen pulang sudah ditutup');
        expect(windowRejectionTitle(rejection('check_out_window'))).toBe(
            'Absen pulang belum dibuka',
        );
    });

    it('suggests an attendance correction only once the window is closed', () => {
        expect(
            windowSuggestsCorrection(rejection('check_in_window', 'after')),
        ).toBe(true);
        expect(
            windowSuggestsCorrection(rejection('check_in_window', 'before')),
        ).toBe(false);
        expect(windowSuggestsCorrection(rejection('too_early'))).toBe(false);
    });
});
