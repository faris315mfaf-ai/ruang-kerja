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
