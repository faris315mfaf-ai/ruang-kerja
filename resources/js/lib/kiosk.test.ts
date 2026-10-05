import { describe, expect, it } from 'vite-plus/test';
import {
    clockOffset,
    isKioskPayload,
    refreshDelay,
    remainingFraction,
    secondsLeft,
} from './kiosk';

const VALID =
    'ruangkerja://checkin?l=01m44qmx6p18rc95jjkeksg5bs&w=59000000&s=0123456789abcdef0123456789abcdef';

describe('isKioskPayload', () => {
    it('accepts a kiosk code', () => {
        expect(isKioskPayload(VALID)).toBe(true);
        expect(isKioskPayload(`  ${VALID}\n`)).toBe(true);
    });

    it('rejects other QR codes and malformed ones', () => {
        expect(isKioskPayload('https://contoh.test')).toBe(false);
        expect(isKioskPayload('ruangkerja://checkin?l=x&w=1&s=2')).toBe(false);
        expect(isKioskPayload(VALID.replace('&w=59000000', ''))).toBe(false);
        expect(isKioskPayload(`${VALID}${'a'.repeat(600)}`)).toBe(false);
    });
});

describe('kiosk countdown', () => {
    const from = '2026-10-05T00:52:00Z';
    const until = '2026-10-05T00:52:30Z';
    const at = (iso: string) => Date.parse(iso);

    it('counts the seconds left and the remaining share', () => {
        expect(secondsLeft(until, at('2026-10-05T00:52:12Z'))).toBe(18);
        expect(secondsLeft(until, at('2026-10-05T00:52:31Z'))).toBe(0);
        expect(
            remainingFraction(from, until, at('2026-10-05T00:52:12Z')),
        ).toBeCloseTo(0.6);
        expect(remainingFraction(from, until, at('2026-10-05T00:53:00Z'))).toBe(
            0,
        );
        expect(remainingFraction(until, from, at('2026-10-05T00:52:12Z'))).toBe(
            0,
        );
    });

    it('refreshes just after the window and never faster than a second', () => {
        expect(refreshDelay(until, at('2026-10-05T00:52:12Z'))).toBe(18_300);
        expect(refreshDelay(until, at('2026-10-05T00:52:40Z'))).toBe(1_000);
        expect(refreshDelay('x', 0)).toBe(5_000);
    });

    it('measures the device clock offset', () => {
        expect(
            clockOffset('2026-10-05T00:52:12.000Z', at('2026-10-05T00:52:10Z')),
        ).toBe(2_000);
        expect(clockOffset('bukan', 1)).toBe(0);
    });
});
