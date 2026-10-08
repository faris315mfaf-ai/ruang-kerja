import { describe, expect, it } from 'vite-plus/test';
import {
    planPoints,
    planRejection,
    rejectionFromError,
    toRejection,
} from './use-check-flow';

describe('toRejection', () => {
    it('passes through business rejections from the server', () => {
        const body = JSON.stringify({
            message:
                'Anda berada 340 m dari Kantor Pusat (batas 100 m). Ajukan dinas luar jika sedang bertugas di luar.',
            reason: 'outside_geofence',
            context: { distance_m: 340, radius_m: 100 },
        });

        expect(toRejection(422, body)).toEqual({
            reason: 'outside_geofence',
            message:
                'Anda berada 340 m dari Kantor Pusat (batas 100 m). Ajukan dinas luar jika sedang bertugas di luar.',
            context: { distance_m: 340, radius_m: 100 },
        });
    });

    it('shows the first validation error', () => {
        const body = JSON.stringify({
            message: 'x',
            errors: { selfie: ['Ambil selfie terlebih dulu.'] },
        });

        expect(toRejection(422, body)).toMatchObject({
            reason: 'validation',
            message: 'Ambil selfie terlebih dulu.',
        });
    });

    it('explains network, throttling and expired sessions', () => {
        expect(toRejection(null).reason).toBe('network');
        expect(toRejection(429).message).toContain('Tunggu satu menit');
        expect(toRejection(419).message).toContain('Muat ulang halaman');
        expect(toRejection(500, 'not json').reason).toBe('server');
    });
});

describe('rejectionFromError', () => {
    it('reads HTTP response errors and network errors', () => {
        expect(
            rejectionFromError({ response: { status: 429, data: '' } }).reason,
        ).toBe('rate_limited');
        expect(rejectionFromError(new Error('Network error')).reason).toBe(
            'network',
        );
        expect(rejectionFromError('boom').reason).toBe('server');
    });
});

describe('planRejection', () => {
    it('requires at least one point for a check-in', () => {
        expect(planRejection('in', [''])).toContain('rencana kerja');
        expect(planRejection('in', ['   ', ''])).toContain('rencana kerja');
        expect(planRejection('in', ['', 'Laporan mingguan'])).toBeNull();
    });

    it('never blocks a check-out', () => {
        expect(planRejection('out', [''])).toBeNull();
    });
});

describe('planPoints', () => {
    it('trims and drops blank rows', () => {
        expect(planPoints(['  ', 'Satu', '', ' Dua '])).toEqual([
            'Satu',
            'Dua',
        ]);
    });
});
