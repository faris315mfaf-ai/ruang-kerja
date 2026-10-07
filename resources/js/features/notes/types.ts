import type { RichDoc } from '@/features/tasks/editor/types';

/**
 * Catatan bersama (F2-2) props, in the shapes of
 * App\Domain\Notes\Queries\NoteLibrary. The live document is a Yjs doc on
 * the collab server; `yjs_state` never reaches the browser, `content` is the
 * sanitized snapshot.
 */

export type NotePerson = {
    id: string;
    name: string;
    avatar: string | null;
    title: string;
};

export type NoteWorkspace = {
    id: string;
    key: string;
    name: string;
    color: string;
    type: string;
    /** The viewer may write new notes/folders here. */
    can_create: boolean;
};

export type NoteKind = 'note' | 'folder';

export type NoteAccess = 'workspace' | 'restricted';

/** Template a note was started from ("Notulensi cepat"); null = ordinary. */
export type NotePreset = 'minutes';

/** Tree row (no content). */
export type Note = {
    id: string;
    workspace_id: string;
    parent_id: string | null;
    kind: NoteKind;
    preset: NotePreset | null;
    title: string;
    access: NoteAccess;
    created_by: string | null;
    updated_by: string | null;
    position: string;
    created_at: string | null;
    updated_at: string | null;
};

/** The open note with its snapshot and the viewer's rights. */
export type NoteDetail = Note & {
    workspace_key: string | null;
    workspace_type: string | null;
    content: RichDoc | null;
    can_edit: boolean;
    can_share: boolean;
    can_delete: boolean;
};

/** note_versions row (newest first). */
export type NoteVersion = {
    id: string;
    note_id: string;
    created_by: string | null;
    created_at: string | null;
    title: string;
    content: RichDoc | null;
    /** "Dipulihkan dari versi …" etc. */
    label: string | null;
};

export type NoteAccessRole = 'edit' | 'view';

export type NoteShare = {
    note_id: string;
    access: NoteAccess;
    people: { user_id: string; role: NoteAccessRole }[];
};

/** /catatan */
export type NotesIndexProps = {
    viewer_id: string;
    people: NotePerson[];
    workspaces: NoteWorkspace[];
    notes: Note[];
    query: string;
    /** Ids matching `query` (server full-text search), null without a query. */
    matches: string[] | null;
};

/** /catatan/{note} */
export type NoteShowProps = {
    viewer_id: string;
    people: NotePerson[];
    workspaces: NoteWorkspace[];
    /** Notes of the same workspace (tree). */
    notes: Note[];
    current: NoteDetail;
    /** Present when the viewer may change the sharing. */
    share: NoteShare | null;
    /** A collab server is configured (otherwise: save without collaboration). */
    collab: boolean;
};

/** /w/{key}/catatan */
export type WorkspaceNotesProps = {
    viewer_id: string;
    people: NotePerson[];
    notes: Note[];
    can_create: boolean;
};

/** Someone else with the note open (Yjs awareness). */
export type NotePeer = {
    clientId: number;
    id: string;
    name: string;
    tone: number;
};

/** GET /catatan/notulensi */
export type RecentMinutes = {
    id: string;
    title: string;
    workspace_name: string | null;
    updated_at: string | null;
};
