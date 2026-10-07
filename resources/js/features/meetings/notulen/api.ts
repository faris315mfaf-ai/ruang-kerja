import { http } from '@inertiajs/react';
import { ApiError } from '@/features/tasks/lib/api';
import type { DraftAction, NotulenSummary, TranscriptSegments } from './types';

type Method = 'get' | 'put' | 'post' | 'delete';

const FALLBACK: Record<number, string> = {
    403: 'Anda tidak berhak melakukan ini.',
    404: 'Data notulen otomatis tidak ditemukan.',
    409: 'Draf sudah berubah. Muat ulang halaman.',
    419: 'Sesi berakhir. Muat ulang halaman lalu coba lagi.',
    429: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
};

function errorFrom(error: unknown): ApiError {
    const response =
        typeof error === 'object' && error !== null && 'response' in error
            ? (error as { response?: { status?: number; data?: unknown } })
                  .response
            : undefined;

    if (!response || typeof response.status !== 'number') {
        return new ApiError(
            'Koneksi terputus. Periksa jaringan Anda lalu coba lagi.',
            0,
        );
    }

    const body = (
        typeof response.data === 'object' && response.data !== null
            ? response.data
            : {}
    ) as { message?: string; errors?: Record<string, string[]> };
    const first = body.errors ? Object.values(body.errors)[0]?.[0] : undefined;

    return new ApiError(
        first ??
            body.message ??
            FALLBACK[response.status] ??
            'Terjadi kesalahan. Coba lagi sebentar lagi.',
        response.status,
        body.errors ?? {},
    );
}

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

        return (
            typeof response.data === 'string'
                ? JSON.parse(response.data)
                : response.data
        ) as T;
    } catch (error) {
        throw errorFrom(error);
    }
}

/** routes/notulen.php — URLs come from NotulenSummary.links. */
export const notulenApi = {
    status: (summary: NotulenSummary) =>
        request<NotulenSummary>('get', summary.links.status),

    transcript: (summary: NotulenSummary) =>
        request<TranscriptSegments>('get', summary.links.transcript),

    setAutoMinutes: (summary: NotulenSummary, enabled: boolean) =>
        request<NotulenSummary>('put', summary.links.settings, {
            auto_minutes: enabled,
        }),

    setOptOut: (summary: NotulenSummary, optedOut: boolean) =>
        request<{ opted_out: boolean; attributes: Record<string, string> }>(
            'put',
            summary.links.consent,
            { opted_out: optedOut },
        ),

    insert: (summary: NotulenSummary) =>
        request<{
            minutes_href: string;
            inserted_at: string;
            action_item_ids: string[];
        }>('post', summary.links.insert),

    discard: (summary: NotulenSummary) =>
        request<NotulenSummary>('delete', summary.links.discard),

    resummarize: (summary: NotulenSummary) =>
        request<NotulenSummary>('post', summary.links.resummarize),

    task: (
        summary: NotulenSummary,
        suggestionId: string,
        workspaceId?: string | null,
    ) =>
        request<{
            suggestion: DraftAction;
            task: { id: string; key: string; href: string } | null;
        }>(
            'post',
            summary.links.task.replace(
                '{id}',
                encodeURIComponent(suggestionId),
            ),
            workspaceId ? { workspace_id: workspaceId } : {},
        ),
};
