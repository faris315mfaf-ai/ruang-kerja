import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import type { RichDoc } from '@/features/tasks/editor/types';
import { canEdit, savedLabel } from './lib';
import { restoreVersion, shareFor, updateNote } from './store';
import type { NotePerson, NotesState, NoteVersion } from './types';

/** Simulated autosave delay (Hocuspocus debounces about as long). */
const SAVE_DELAY = 800;

/**
 * Everything the note screen needs on both layouts: the note, autosave
 * status, co-editors, version history (preview + restore) and sharing.
 */
export function useNoteSession(state: NotesState, noteId: string) {
    const note = state.notes.find((item) => item.id === noteId) ?? null;
    const workspace = state.workspaces.find(
        (item) => item.id === note?.workspace_id,
    );
    const share = shareFor(noteId);
    const editable = canEdit(share, state.viewerId);
    const versions = state.versions.filter(
        (version) => version.note_id === noteId,
    );
    const latestVersionId = [...versions].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
    )[0]?.id;
    const collaborators: NotePerson[] = (state.activeEditors[noteId] ?? [])
        .filter((id) => id !== state.viewerId)
        .map((id) => state.people.find((person) => person.id === id))
        .filter((person): person is NotePerson => person !== undefined);

    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<number | null>(
        () => Date.now() - 2000,
    );
    const [now, setNow] = useState(() => Date.now());
    const [editorKey, setEditorKey] = useState(0);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [previewId, setPreviewId] = useState<string | null>(null);
    const [confirming, setConfirming] = useState<NoteVersion | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const saveTimer = useRef<number | undefined>(undefined);
    const restore = useFakeMutation();

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);

        return () => {
            window.clearInterval(timer);
            window.clearTimeout(saveTimer.current);
        };
    }, []);

    const markSaving = () => {
        setSaving(true);
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
            setSaving(false);
            setSavedAt(Date.now());
            setNow(Date.now());
        }, SAVE_DELAY);
    };

    const setContent = (content: RichDoc | null) => {
        updateNote(noteId, { content });
        markSaving();
    };

    const setTitle = (title: string) => {
        updateNote(noteId, { title });
        markSaving();
    };

    const editorRef = useRef<Editor | null>(null);
    const onReady = useCallback((instance: Editor | null) => {
        editorRef.current = instance;
        setEditor(instance);
    }, []);
    /** Title → body (Enter in the title). */
    const focusBody = useCallback(() => {
        const current = editorRef.current;

        if (current && !current.isDestroyed) {
            current.commands.focus('start');
        }
    }, []);

    const preview =
        versions.find((version) => version.id === previewId) ?? null;

    const confirmRestore = async () => {
        if (!confirming) {
            return;
        }

        const version = confirming;
        const ok = await restore.run(() => restoreVersion(noteId, version.id));

        if (ok) {
            toast.success(
                'Versi dipulihkan. Semua penyunting melihat isi ini.',
            );
            setConfirming(null);
            setPreviewId(null);
            setEditorKey((key) => key + 1);
            setSavedAt(Date.now());
        }
    };

    return {
        note,
        workspace,
        share,
        editable,
        versions,
        latestVersionId,
        collaborators,
        status: savedLabel(savedAt, now, saving),
        saving,
        setContent,
        setTitle,
        editor,
        editorKey,
        onReady,
        focusBody,
        history: {
            open: historyOpen,
            setOpen: setHistoryOpen,
            preview,
            select: (version: NoteVersion) => setPreviewId(version.id),
            clearPreview: () => setPreviewId(null),
            confirming,
            askRestore: (version: NoteVersion) => setConfirming(version),
            cancelRestore: () => setConfirming(null),
            confirmRestore,
            processing: restore.processing,
        },
        shareOpen,
        setShareOpen,
    };
}

export type NoteSession = ReturnType<typeof useNoteSession>;
