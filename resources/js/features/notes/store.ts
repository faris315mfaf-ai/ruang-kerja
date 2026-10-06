import { useSyncExternalStore } from 'react';
import { prototypeNow } from '@/features/chat/lib';
import type { RichDoc } from '@/features/tasks/editor/types';
import { initialNotesState } from './fixtures';
import type { NoteAccessRole, NoteShare, NotesState } from './types';

/**
 * Client-only store of the Catatan preview; survives Inertia visits (a full
 * reload restores the samples). In production the document is a Yjs doc on
 * Hocuspocus and the list comes from Laravel props.
 */
let state: NotesState = initialNotesState();
const listeners = new Set<() => void>();
let sequence = 0;

function emit(next: NotesState): void {
    state = next;
    listeners.forEach((listener) => listener());
}

export function useNotesState(): NotesState {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);

            return () => listeners.delete(listener);
        },
        () => state,
        () => state,
    );
}

export function getNotesState(): NotesState {
    return state;
}

function nextId(prefix: string): string {
    sequence += 1;

    return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

export function updateNote(
    id: string,
    changes: { title?: string; content?: RichDoc | null },
): void {
    emit({
        ...state,
        notes: state.notes.map((note) =>
            note.id === id
                ? {
                      ...note,
                      ...changes,
                      updated_by: state.viewerId,
                      updated_at: prototypeNow().toISOString(),
                  }
                : note,
        ),
    });
}

/** Saves the current text as a version (on leaving the note, Hocuspocus does this every few minutes). */
export function snapshotVersion(id: string, label: string | null = null): void {
    const note = state.notes.find((item) => item.id === id);

    if (!note) {
        return;
    }

    emit({
        ...state,
        versions: [
            ...state.versions,
            {
                id: nextId('v'),
                note_id: id,
                created_by: state.viewerId,
                created_at: prototypeNow().toISOString(),
                title: note.title,
                content: note.content,
                label,
            },
        ],
    });
}

export function restoreVersion(noteId: string, versionId: string): void {
    const version = state.versions.find((item) => item.id === versionId);

    if (!version) {
        return;
    }

    updateNote(noteId, { title: version.title, content: version.content });
    snapshotVersion(noteId, 'Dipulihkan dari versi sebelumnya');
}

export function createNote(input: {
    title: string;
    workspaceId: string;
    parentId: string | null;
}): string {
    const id = nextId('n');
    const now = prototypeNow().toISOString();

    emit({
        ...state,
        notes: [
            ...state.notes,
            {
                id,
                workspace_id: input.workspaceId,
                parent_id: input.parentId,
                title: input.title.trim() || 'Tanpa judul',
                content: null,
                created_by: state.viewerId,
                updated_by: state.viewerId,
                created_at: now,
                updated_at: now,
            },
        ],
    });

    return id;
}

export function saveShare(share: NoteShare): void {
    emit({
        ...state,
        shares: [
            ...state.shares.filter((item) => item.note_id !== share.note_id),
            share,
        ],
    });
}

/** Default share when none is stored: workspace access, viewer edits. */
export function shareFor(noteId: string): NoteShare {
    return (
        state.shares.find((item) => item.note_id === noteId) ?? {
            note_id: noteId,
            access: 'workspace',
            people: [
                { user_id: state.viewerId, role: 'edit' as NoteAccessRole },
            ],
        }
    );
}

export function resetNotesState(): void {
    state = initialNotesState();
    listeners.forEach((listener) => listener());
}
