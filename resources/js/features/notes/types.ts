import type { RichDoc } from '@/features/tasks/editor/types';

/**
 * Catatan bersama (Fase 2, F2-2) props. Shapes follow docs/DATABASE.md §7
 * (`notes`, `note_versions`); `yjs_state` stays on the server (Hocuspocus),
 * the client gets the `content` snapshot. Fields marked "derived" are
 * computed by the backend.
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
};

/** notes row (content = latest snapshot of the Yjs document). */
export type Note = {
    id: string;
    workspace_id: string;
    parent_id: string | null;
    title: string;
    content: RichDoc | null;
    created_by: string;
    updated_by: string;
    created_at: string;
    updated_at: string;
};

/** note_versions row + derived snapshot for preview. */
export type NoteVersion = {
    id: string;
    note_id: string;
    created_by: string;
    created_at: string;
    /** Derived from yjs_state for the preview. */
    title: string;
    content: RichDoc | null;
    /** "Dipulihkan dari versi …" etc. */
    label: string | null;
};

export type NoteAccessRole = 'edit' | 'view';

/** Derived: who can open the note (workspace members + invited people). */
export type NoteShare = {
    note_id: string;
    access: 'workspace' | 'restricted';
    people: { user_id: string; role: NoteAccessRole }[];
};

export type NotesState = {
    viewerId: string;
    people: NotePerson[];
    workspaces: NoteWorkspace[];
    notes: Note[];
    versions: NoteVersion[];
    shares: NoteShare[];
    /** note id → people with the note open right now (presence). */
    activeEditors: Record<string, string[]>;
};
