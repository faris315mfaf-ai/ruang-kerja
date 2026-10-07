import { request } from '../video/api';
import type {
    DraftFollowUp,
    NotulenLinks,
    NotulenSummary,
    TranscriptSegments,
} from './types';

/**
 * URL of "Jadikan tugas" for one suggestion (contract §1:
 * /rapat/{meeting}/notulen-otomatis/tindak-lanjut/{suggestion}/tugas), built
 * from the page link so the occurrence query stays.
 */
export function suggestionTaskUrl(links: NotulenLinks, id: string): string {
    const [path, query] = links.page.split('?');

    return `${path}/tindak-lanjut/${encodeURIComponent(id)}/tugas${query ? `?${query}` : ''}`;
}

/** Endpoints of docs/fitur/notulen-otomatis-kontrak.md (links from props). */
export const notulenApi = {
    status: (links: NotulenLinks) =>
        request<NotulenSummary>('get', links.status),

    transcript: (links: NotulenLinks) =>
        request<TranscriptSegments>('get', links.transcript),

    consent: (links: NotulenLinks, optedOut: boolean) =>
        request<{ opted_out: boolean; attributes: Record<string, string> }>(
            'put',
            links.consent,
            { opted_out: optedOut },
        ),

    insert: (links: NotulenLinks) =>
        request<{
            minutes_href: string;
            inserted_at: string;
            action_item_ids: string[];
        }>('post', links.insert),

    discard: (links: NotulenLinks) =>
        request<NotulenSummary>('delete', links.discard),

    resummarize: (links: NotulenLinks) =>
        request<NotulenSummary>('post', links.resummarize),

    makeTask: (links: NotulenLinks, id: string, workspaceId: string | null) =>
        request<{
            suggestion: DraftFollowUp;
            task: { id: string; key: string; href: string };
        }>(
            'post',
            suggestionTaskUrl(links, id),
            workspaceId ? { workspace_id: workspaceId } : undefined,
        ),
};
