import { describe, expect, it } from 'vitest';
import { GuestApiError } from './api';
import { classifyGuestTokenError } from './token-errors';

const err = (status: number, code: string | null, message = 'm') =>
    new GuestApiError(message, status, code);

describe('classifyGuestTokenError', () => {
    it('shows the removed screen for 403 dikeluarkan', () => {
        expect(classifyGuestTokenError(err(403, 'dikeluarkan'))).toEqual({
            kind: 'removed',
        });
    });

    it('does not offer a retry when denied or not admitted', () => {
        for (const code of ['ditolak', 'menunggu', 'belum_meminta']) {
            expect(classifyGuestTokenError(err(403, code))).toMatchObject({
                kind: 'error',
                canRetry: false,
            });
        }
    });

    it('ends the call screen for a closed or expired link', () => {
        expect(classifyGuestTokenError(err(410, 'ditutup'))).toEqual({
            kind: 'canceled',
        });
        expect(classifyGuestTokenError(err(410, 'kedaluwarsa'))).toEqual({
            kind: 'canceled',
        });
    });

    it('treats an unknown link as final', () => {
        expect(
            classifyGuestTokenError(err(404, 'tidak_dikenal')),
        ).toMatchObject({ kind: 'error', canRetry: false });
    });

    it('retries on network, throttling and server errors', () => {
        for (const status of [0, 429, 500, 502]) {
            expect(classifyGuestTokenError(err(status, null))).toMatchObject({
                kind: 'error',
                canRetry: true,
            });
        }
    });

    it('does not retry when the video server is not ready', () => {
        expect(
            classifyGuestTokenError(err(503, 'video_belum_siap')),
        ).toMatchObject({ kind: 'error', canRetry: false });
    });

    it('ignores errors that are not the guest API', () => {
        expect(classifyGuestTokenError(new Error('x'))).toBeNull();
    });
});
