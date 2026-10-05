import { describe, expect, it } from 'vite-plus/test';
import {
    GEOLOCATION_MESSAGES,
    GEOLOCATION_TIMEOUT_MS,
    geolocationErrorState,
} from './use-geolocation';

describe('geolocation errors', () => {
    it('maps PositionError codes', () => {
        expect(geolocationErrorState(1)).toBe('denied');
        expect(geolocationErrorState(2)).toBe('unavailable');
        expect(geolocationErrorState(3)).toBe('timeout');
    });

    it('times out after 15 seconds with an actionable message', () => {
        expect(GEOLOCATION_TIMEOUT_MS).toBe(15_000);
        expect(GEOLOCATION_MESSAGES.timeout).toContain('15 detik');
    });
});
