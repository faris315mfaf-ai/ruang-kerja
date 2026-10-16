import { describe, expect, it } from 'vite-plus/test';
import { rejectionFromError, toRejection } from './use-check-flow';
import {
    pointsKindFor,
    pointsRejection,
    pointsServerError,
    submitProblems,
    workPoints,
} from './work-points';

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

describe('toRejection (window refusals)', () => {
    it('keeps the window phase and bounds for check-in and check-out', () => {
        const checkIn = toRejection(
            422,
            JSON.stringify({
                message:
                    'Absen masuk dibuka pukul 06.00 dan ditutup pukul 12.00.',
                reason: 'check_in_window',
                context: {
                    phase: 'before',
                    from: '06:00',
                    until: '12:00',
                    opens_at: '2026-10-05T23:00:00Z',
                },
            }),
        );

        expect(checkIn.reason).toBe('check_in_window');
        expect(checkIn.context).toMatchObject({
            phase: 'before',
            until: '12:00',
        });

        const checkOut = toRejection(
            422,
            JSON.stringify({
                message:
                    'Absen pulang dibuka pukul 15.00 dan ditutup pukul 23.59.',
                reason: 'check_out_window',
                context: { phase: 'after', from: '15:00', until: '23:59' },
            }),
        );

        expect(checkOut.reason).toBe('check_out_window');
        expect(checkOut.context.phase).toBe('after');
    });

    it('lists the first message per field of a 422', () => {
        const rejection = toRejection(
            422,
            JSON.stringify({
                errors: {
                    work_report: [
                        'Laporan kerja wajib diisi sebelum absen pulang.',
                    ],
                    'work_report.1': ['Tiap poin maksimal 300 karakter.'],
                },
            }),
        );

        expect(rejection.errors).toEqual({
            work_report: 'Laporan kerja wajib diisi sebelum absen pulang.',
            'work_report.1': 'Tiap poin maksimal 300 karakter.',
        });
    });
});

describe('pointsKindFor', () => {
    it('is the rencana kerja at check-in and the laporan kerja at check-out', () => {
        expect(pointsKindFor('in')).toBe('plan');
        expect(pointsKindFor('out')).toBe('report');
    });
});

describe('pointsRejection', () => {
    it('requires at least one rencana kerja point for a check-in', () => {
        expect(pointsRejection('in', [''])).toContain('rencana kerja');
        expect(pointsRejection('in', ['   ', ''])).toContain('rencana kerja');
        expect(pointsRejection('in', ['', 'Laporan mingguan'])).toBeNull();
    });

    it('requires at least one laporan kerja point for a check-out', () => {
        expect(pointsRejection('out', [''])).toContain('laporan kerja');
        expect(pointsRejection('out', [' ', ''])).toContain('absen pulang');
        expect(pointsRejection('out', ['Selesai revisi'])).toBeNull();
    });
});

describe('submitProblems', () => {
    it('blocks an empty laporan kerja before sending the check-out', () => {
        expect(
            submitProblems({
                type: 'out',
                points: [''],
                isRemote: false,
                note: '',
            }),
        ).toEqual({
            points: expect.stringContaining('laporan kerja'),
            note: null,
        });
    });

    it('also asks for the location note when working remotely', () => {
        const problems = submitProblems({
            type: 'out',
            points: ['Selesai'],
            isRemote: true,
            note: '  ',
        });

        expect(problems.points).toBeNull();
        expect(problems.note).toContain('check-out di luar kantor');
        expect(
            submitProblems({
                type: 'in',
                points: ['Selesai'],
                isRemote: true,
                note: 'Rumah',
            }),
        ).toEqual({ points: null, note: null });
    });
});

describe('workPoints', () => {
    it('trims and drops blank rows', () => {
        expect(workPoints(['  ', 'Satu', '', ' Dua '])).toEqual([
            'Satu',
            'Dua',
        ]);
    });

    it('sends at most 8 points', () => {
        const many = Array.from({ length: 10 }, (_, i) => `Poin ${i + 1}`);

        expect(workPoints(many)).toHaveLength(8);
    });
});

describe('pointsServerError', () => {
    const rejection = toRejection(
        422,
        JSON.stringify({
            errors: { 'work_report.2': ['Tiap poin maksimal 300 karakter.'] },
        }),
    );

    it('shows a work_report error inline for a check-out only', () => {
        expect(pointsServerError(rejection, 'out')).toBe(
            'Tiap poin maksimal 300 karakter.',
        );
        expect(pointsServerError(rejection, 'in')).toBeNull();
    });

    it('ignores other refusals', () => {
        expect(pointsServerError(toRejection(null), 'out')).toBeNull();
        expect(
            pointsServerError(
                toRejection(
                    422,
                    JSON.stringify({ errors: { selfie: ['Ambil selfie.'] } }),
                ),
                'out',
            ),
        ).toBeNull();
    });
});
