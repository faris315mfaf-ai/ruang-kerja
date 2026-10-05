import { beforeEach, describe, expect, it } from 'vite-plus/test';
import { deviceId } from './device';

describe('deviceId', () => {
    beforeEach(() => window.localStorage.clear());

    it('is created once and then reused', () => {
        const first = deviceId();

        expect(first.length).toBeGreaterThan(8);
        expect(deviceId()).toBe(first);
        expect(window.localStorage.getItem('rk-device-id')).toBe(first);
    });
});
