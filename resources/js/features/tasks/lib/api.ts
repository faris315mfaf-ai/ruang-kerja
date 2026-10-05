import { http } from '@inertiajs/react';
import type { RouteDefinition } from '@/wayfinder';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly errors: Record<string, string[]> = {},
    ) {
        super(message);
    }
}

function parse(body: string): unknown {
    if (body === '') {
        return null;
    }

    try {
        return JSON.parse(body) as unknown;
    } catch {
        return null;
    }
}

/** HttpResponseError from @inertiajs/core (checked structurally). */
function responseOf(error: unknown): { status: number; data: string } | null {
    if (typeof error !== 'object' || error === null || !('response' in error)) {
        return null;
    }

    const response = (error as { response: unknown }).response;

    if (
        typeof response === 'object' &&
        response !== null &&
        'status' in response &&
        typeof response.status === 'number'
    ) {
        const data = 'data' in response ? response.data : '';

        return {
            status: response.status,
            data: typeof data === 'string' ? data : JSON.stringify(data),
        };
    }

    return null;
}

const FALLBACK: Record<number, string> = {
    403: 'Anda tidak punya akses untuk mengubah tugas ini.',
    404: 'Tugas atau workspace tidak ditemukan.',
    419: 'Sesi berakhir. Muat ulang halaman lalu coba lagi.',
};

/**
 * JSON request through Inertia's HTTP client (CSRF via XSRF cookie). Used for
 * optimistic board moves and the quick-create options; throws ApiError with
 * an Indonesian message on failure.
 */
export async function requestJson<T>(
    route: RouteDefinition<Method>,
    data?: Record<string, unknown>,
): Promise<T> {
    try {
        const response = await http.getClient().request({
            method: route.method,
            url: route.url,
            data,
            headers: { Accept: 'application/json' },
        });

        return parse(response.data) as T;
    } catch (error) {
        const response = responseOf(error);

        if (response) {
            const body = parse(response.data) as {
                message?: string;
                errors?: Record<string, string[]>;
            } | null;
            const status = response.status;
            const firstError = body?.errors
                ? Object.values(body.errors)[0]?.[0]
                : undefined;

            throw new ApiError(
                firstError ??
                    FALLBACK[status] ??
                    'Terjadi kesalahan. Coba lagi sebentar lagi.',
                status,
                body?.errors ?? {},
            );
        }

        throw new ApiError(
            'Koneksi terputus. Periksa jaringan Anda lalu coba lagi.',
            0,
        );
    }
}
