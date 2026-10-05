/**
 * Small JSON client for non-Inertia endpoints (polling feed, autosave,
 * search). Sends Laravel's XSRF token from the cookie, like use-appearance.
 */

export class HttpRequestError extends Error {
    constructor(
        public readonly status: number,
        public readonly body: unknown,
    ) {
        super(`Request failed with status ${status}`);
    }
}

function xsrfToken(): string | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const match = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1] ?? '') : null;
}

type Options = {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
};

export async function requestJson<T>(
    url: string,
    options: Options = {},
): Promise<T> {
    const token = xsrfToken();
    const response = await fetch(url, {
        method: options.method ?? 'GET',
        credentials: 'same-origin',
        signal: options.signal,
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(options.body !== undefined
                ? { 'Content-Type': 'application/json' }
                : {}),
            ...(token ? { 'X-XSRF-TOKEN': token } : {}),
        },
        body:
            options.body !== undefined
                ? JSON.stringify(options.body)
                : undefined,
    });

    const text = await response.text();
    const data: unknown = text ? JSON.parse(text) : null;

    if (!response.ok) {
        throw new HttpRequestError(response.status, data);
    }

    return data as T;
}
