import { HttpRequestError, requestJson, xsrfToken } from '@/lib/http';
import type { ChunkResponse, UploadTransport } from './chunked-upload';
import type { UploadSessionData } from './types';

/** Indonesian message of a failed JSON request (validation, 503 not configured, …). */
export function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpRequestError) {
        const body = error.body as {
            message?: string;
            errors?: Record<string, string[]>;
        } | null;
        const first = body?.errors
            ? Object.values(body.errors)[0]?.[0]
            : undefined;

        if (first) {
            return first;
        }

        if (error.status === 419) {
            return 'Sesi berakhir. Muat ulang halaman lalu coba lagi.';
        }

        if (body?.message && error.status !== 500) {
            return body.message;
        }
    }

    return fallback;
}

/** POST one chunk with XMLHttpRequest (fetch has no upload progress). */
function sendChunk(
    sessionId: string,
    offset: number,
    chunk: Blob,
    onProgress: (loaded: number) => void,
): Promise<ChunkResponse> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const form = new FormData();
        const token = xsrfToken();

        form.append('offset', String(offset));
        form.append('chunk', chunk, 'chunk.bin');

        xhr.open('POST', `/unggah/${encodeURIComponent(sessionId)}`);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

        if (token) {
            xhr.setRequestHeader('X-XSRF-TOKEN', token);
        }

        xhr.withCredentials = true;
        xhr.upload.onprogress = (event) => onProgress(event.loaded);
        xhr.onerror = () => reject(new TypeError('Network error'));
        xhr.ontimeout = () => reject(new TypeError('Timeout'));
        xhr.onload = () => {
            let data: unknown = null;

            try {
                data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
            } catch {
                data = null;
            }

            if (xhr.status === 200 || xhr.status === 409) {
                resolve({
                    status: xhr.status,
                    data: data as UploadSessionData,
                });

                return;
            }

            if (xhr.status >= 500 || xhr.status === 0 || xhr.status === 429) {
                reject(new TypeError(`Server error ${xhr.status}`)); // retried

                return;
            }

            reject(new HttpRequestError(xhr.status, data));
        };
        xhr.send(form);
    });
}

/**
 * Transport for a session opened at `startUrl` (POST /w/{KEY}/file/unggah or
 * /lampiran/{type}/{id}/unggah) with `body` (folder etc.).
 */
export function uploadTransport(
    file: File,
    startUrl: string,
    body: Record<string, unknown> = {},
): UploadTransport {
    return {
        start: () =>
            requestJson<UploadSessionData>(startUrl, {
                method: 'POST',
                body: {
                    name: file.name,
                    size: file.size,
                    mime_type: file.type,
                    ...body,
                },
            }),
        sendChunk,
        status: (id) =>
            requestJson<UploadSessionData>(`/unggah/${encodeURIComponent(id)}`),
        cancel: async (id) => {
            await requestJson(`/unggah/${encodeURIComponent(id)}`, {
                method: 'DELETE',
            });
        },
    };
}
