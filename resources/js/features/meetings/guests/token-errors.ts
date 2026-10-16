import type { RoomStatus } from '../video/use-video-room';
import { GuestApiError } from './api';

/**
 * Failure of POST /api/tamu/{token}/token → the screen it stands for
 * (docs/sesi/rapat-tamu-eksternal.md §3.4). `null` = not ours (the room
 * shows its generic "cannot join" screen).
 */
export function classifyGuestTokenError(error: unknown): RoomStatus | null {
    if (!(error instanceof GuestApiError)) {
        return null;
    }

    if (error.status === 403) {
        switch (error.code) {
            case 'dikeluarkan':
                return { kind: 'removed' };
            case 'ditolak':
                return {
                    kind: 'error',
                    message: 'Penyelenggara menolak permintaan Anda.',
                    canRetry: false,
                };
            case 'menunggu':
            case 'belum_meminta':
                return {
                    kind: 'error',
                    message:
                        'Anda belum diizinkan masuk. Minta izin masuk dulu dan tunggu penyelenggara.',
                    canRetry: false,
                };
            default:
                return {
                    kind: 'error',
                    message: error.message,
                    canRetry: false,
                };
        }
    }

    if (error.status === 410) {
        return { kind: 'canceled' };
    }

    if (error.status === 404) {
        return {
            kind: 'error',
            message:
                'Tautan tidak berlaku. Minta tautan baru kepada penyelenggara.',
            canRetry: false,
        };
    }

    if (error.status === 503) {
        return { kind: 'error', message: error.message, canRetry: false };
    }

    // Network drop, throttling or a server hiccup: worth another try.
    return { kind: 'error', message: error.message, canRetry: true };
}
