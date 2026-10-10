import { requestJson } from '@/features/tasks/lib/api';
import type { RichDoc } from '@/features/tasks/editor/types';
import notes from '@/routes/notes';
import noteVersions from '@/routes/notes/versions';
import type {
    NoteAccess,
    NoteAccessRole,
    NoteDetail,
    NoteShare,
    NoteVersion,
} from './types';

/** JSON endpoints of routes/notes.php (throw ApiError with an Indonesian message). */
export const notesApi = {
    token: (noteId: string) =>
        requestJson<{
            token: string;
            url: string;
            can_edit: boolean;
            expires_in: number;
        }>(notes.token(noteId)),
    rename: (noteId: string, title: string) =>
        requestJson<{ note: NoteDetail }>(notes.update(noteId), { title }),
    move: (noteId: string, parentId: string | null) =>
        requestJson<{ note: NoteDetail }>(notes.update(noteId), {
            parent_id: parentId,
        }),
    /** Save fallback without collaboration (409 = someone saved in between). */
    saveContent: (noteId: string, body: RichDoc | null, updatedAt: string) =>
        requestJson<{ note: NoteDetail }>(notes.content(noteId), {
            body,
            updated_at: updatedAt,
        }),
    share: (
        noteId: string,
        access: NoteAccess,
        people: { user_id: string; role: NoteAccessRole }[],
    ) =>
        requestJson<{ share: NoteShare }>(notes.share(noteId), {
            access,
            people,
        }),
    restore: (noteId: string, versionId: string) =>
        requestJson<{ note: NoteDetail; versions: NoteVersion[] }>(
            noteVersions.restore({ note: noteId, version: versionId }),
        ),
};

/** XSRF token from the cookie Laravel sets (for `keepalive` requests). */
function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Last-resort save while the page really unloads (`pagehide`, keputusan
 * pemilik 9 Okt 2026): `fetch` with `keepalive` — the request outlives the
 * document; `sendBeacon` cannot carry the CSRF header (same pattern as
 * features/meetings/video/api.ts). Fire-and-forget: the body save goes
 * first because the rename bumps the `updated_at` it locks against.
 */
export function saveUnsentKeepalive(note: {
    noteId: string;
    body: RichDoc | null | undefined;
    pendingTitle: string | null;
    baseUpdatedAt: string;
}): void {
    const send = (route: { url: string }, data: Record<string, unknown>) => {
        void fetch(route.url, {
            method: 'PATCH',
            keepalive: true,
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': xsrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify(data),
        }).catch(() => undefined);
    };

    if (note.body !== undefined) {
        send(notes.content(note.noteId), {
            body: note.body,
            updated_at: note.baseUpdatedAt,
        });
    }

    if (note.pendingTitle !== null) {
        send(notes.update(note.noteId), { title: note.pendingTitle });
    }
}
