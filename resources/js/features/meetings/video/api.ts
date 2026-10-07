import { http } from '@inertiajs/react';
import { ApiError } from '@/features/tasks/lib/api';
import videoRoutes from '@/routes/meetings/video';
import type { VideoToken } from './types';

type Method = 'post' | 'delete';

const FALLBACK: Record<number, string> = {
    403: 'Anda tidak bisa bergabung ke ruang rapat ini.',
    404: 'Ruang rapat tidak ditemukan.',
    419: 'Sesi berakhir. Muat ulang halaman lalu coba lagi.',
    429: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
    502: 'Server rapat tidak menjawab. Coba lagi.',
    503: 'Video RuangKerja belum disiapkan di server ini. Hubungi admin.',
};

function parse(data: unknown): Record<string, unknown> | null {
    if (typeof data === 'object' && data !== null) {
        return data as Record<string, unknown>;
    }

    if (typeof data !== 'string' || data === '') {
        return null;
    }

    try {
        return JSON.parse(data) as Record<string, unknown>;
    } catch {
        return null;
    }
}

/**
 * JSON request with the server's own message on failure (the policy says
 * *why*: "Ruang rapat dibuka pukul 09.45."). CSRF via the XSRF cookie.
 */
async function request<T>(
    method: Method,
    url: string,
    data?: Record<string, unknown>,
): Promise<T> {
    try {
        const response = await http.getClient().request({
            method,
            url,
            data,
            headers: { Accept: 'application/json' },
        });

        return parse(response.data) as T;
    } catch (error) {
        const response =
            typeof error === 'object' && error !== null && 'response' in error
                ? (error as { response?: { status?: unknown; data?: unknown } })
                      .response
                : undefined;

        if (response && typeof response.status === 'number') {
            const body = parse(response.data);
            const errors = (body?.errors ?? {}) as Record<string, string[]>;
            const message =
                Object.values(errors)[0]?.[0] ??
                (typeof body?.message === 'string' && body.message !== ''
                    ? body.message
                    : undefined) ??
                FALLBACK[response.status] ??
                'Terjadi kesalahan. Coba lagi sebentar lagi.';

            throw new ApiError(message, response.status, errors);
        }

        throw new ApiError(
            'Koneksi terputus. Periksa jaringan Anda lalu coba lagi.',
            0,
        );
    }
}

/** routes/meetings.php › video.* (MeetingVideoController). */
export const videoApi = {
    token: (meetingId: string, date: string) =>
        request<VideoToken>('post', videoRoutes.token(meetingId).url, {
            tanggal: date,
        }),

    mute: (
        meetingId: string,
        date: string,
        identity: string,
        trackSid: string,
    ) =>
        request<{ ok: boolean }>(
            'post',
            videoRoutes.mute({ meeting: meetingId, identity }).url,
            { tanggal: date, track_sid: trackSid },
        ),

    remove: (meetingId: string, date: string, identity: string) =>
        request<{ ok: boolean }>(
            'delete',
            videoRoutes.remove({ meeting: meetingId, identity }).url,
            { tanggal: date },
        ),
};
