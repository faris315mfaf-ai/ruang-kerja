import { router } from '@inertiajs/react';
import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/features/tasks/lib/api';
import type { RichDoc } from '@/features/tasks/editor/types';
import { notesApi, saveUnsentKeepalive } from './api';
import { connectedLabel, savedLabel } from './lib';
import type { LiveDocument } from './note-editor';
import {
    handoffUnsavedChanges,
    readUnsavedFor,
    takeUnsavedFor,
    type UnsavedNote,
} from './unsaved-store';
import type {
    NoteDetail,
    NotePerson,
    NoteShare,
    NoteShowProps,
    NoteVersion,
} from './types';
import { useCollab } from './use-collab';

/** Save fallback: wait this long after the last keystroke. */
const SAVE_DELAY = 1000;
const TITLE_DELAY = 700;

function errorMessage(error: unknown): string {
    return error instanceof ApiError
        ? error.message
        : 'Terjadi kesalahan. Coba lagi sebentar lagi.';
}

/**
 * Everything the note screen needs on both layouts: the live collab session
 * (or the save fallback), title, save status, co-editors, version history
 * (preview + restore), sharing, moving and deleting.
 */
export function useNoteSession(
    props: NoteShowProps,
    versionsProp: NoteVersion[] | undefined,
) {
    // Stuck changes from a previous visit (the page was left before the
    // debounced saves fired): open with them, "saved"/"conflict" landed on
    // the server already. The mount effect below re-arms the auto-save.
    const adopted = readUnsavedFor(props.current.id);
    const adoptable =
        adopted !== null &&
        (adopted.phase === 'saving' || adopted.phase === 'offline');
    const [current, setCurrent] = useState<NoteDetail>(
        adoptable && adopted.body !== undefined
            ? { ...props.current, content: adopted.body }
            : props.current,
    );
    const [title, setTitleState] = useState(
        adoptable ? adopted.title : props.current.title,
    );
    const [share, setShare] = useState<NoteShare | null>(props.share);
    const me = props.people.find((person) => person.id === props.viewer_id) ?? {
        id: props.viewer_id,
        name: 'Saya',
        avatar: null,
        title: '',
    };
    const collab = useCollab({
        noteId: current.id,
        enabled: props.collab,
        me: { id: me.id, name: me.name },
    });
    const live: LiveDocument | null =
        collab.mode === 'live' && collab.doc && collab.provider
            ? { doc: collab.doc, provider: collab.provider }
            : null;
    const mode = collab.mode;
    const editable = current.can_edit && mode !== 'connecting';

    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [conflict, setConflict] = useState(false);
    const [editorKey, setEditorKey] = useState(0);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [restoredVersions, setRestoredVersions] = useState<
        NoteVersion[] | null
    >(null);
    const [previewId, setPreviewId] = useState<string | null>(null);
    const [confirming, setConfirming] = useState<NoteVersion | null>(null);
    const [restoring, setRestoring] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [moveOpen, setMoveOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const saveTimer = useRef<number | undefined>(undefined);
    const titleTimer = useRef<number | undefined>(undefined);
    const pending = useRef<RichDoc | null | undefined>(undefined);
    /** Body of the save currently in flight (kept for the unload handoff). */
    const inFlight = useRef<RichDoc | null | undefined>(undefined);
    const base = useRef(current.updated_at ?? '');
    // Latest id/title for the unload handoff (the unmount cleanup and the
    // pagehide listener must not read a stale first-render closure).
    const latest = useRef({
        noteId: current.id,
        title,
        noteTitle: current.title,
    });

    useEffect(() => {
        latest.current = {
            noteId: current.id,
            title,
            noteTitle: current.title,
        };
    });

    /** Changes that would be lost when the page goes away right now. */
    const stuckChanges = (): UnsavedNote | null => {
        const snapshot = latest.current;
        const pendingTitle =
            titleTimer.current !== undefined &&
            snapshot.title !== snapshot.noteTitle
                ? snapshot.title
                : null;
        // A save in flight may still fail after the page is gone — hand
        // its body over too, so the pill can retry it.
        const body =
            pending.current !== undefined ? pending.current : inFlight.current;

        return pendingTitle !== null || body !== undefined
            ? {
                  noteId: snapshot.noteId,
                  title: snapshot.title,
                  pendingTitle,
                  body,
                  baseUpdatedAt: base.current,
              }
            : null;
    };

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);

        return () => {
            window.clearInterval(timer);
            window.clearTimeout(saveTimer.current);
            window.clearTimeout(titleTimer.current);
            // Leaving with unflushed changes (keputusan pemilik 9 Okt
            // 2026): hand them to the unsaved pill — the save continues in
            // the background instead of being dropped.
            const stuck = stuckChanges();
            pending.current = undefined;
            titleTimer.current = undefined;

            if (stuck) {
                handoffUnsavedChanges(stuck);
            }
        };
        // The refs it reads are always current.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Real unload (close/reload): no cleanup runs there, so fire the last
    // save as a keepalive fetch that outlives the document.
    useEffect(() => {
        const onPageHide = () => {
            const stuck = stuckChanges();

            if (stuck) {
                saveUnsentKeepalive(stuck);
            }
        };

        window.addEventListener('pagehide', onPageHide);

        return () => window.removeEventListener('pagehide', onPageHide);
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Live: "Menyimpan…" while the provider has changes the server has not confirmed.
    useEffect(() => {
        const provider = collab.provider;

        if (!provider) {
            return;
        }

        const onUnsynced = ({ number }: { number: number }) => {
            setSaving(number > 0);

            if (number === 0) {
                setSavedAt(Date.now());
            }
        };
        provider.on('unsyncedChanges', onUnsynced);

        return () => {
            provider.off('unsyncedChanges', onUnsynced);
        };
    }, [collab.provider]);

    const flushContent = useCallback(async () => {
        const doc = pending.current;

        if (doc === undefined) {
            return;
        }

        pending.current = undefined;
        inFlight.current = doc;
        setSaving(true);

        try {
            const { note } = await notesApi.saveContent(
                current.id,
                doc,
                base.current,
            );
            base.current = note.updated_at ?? base.current;
            setCurrent((state) => ({
                ...state,
                content: note.content,
                updated_at: note.updated_at,
            }));
            setSavedAt(Date.now());
        } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
                setConflict(true);
            } else {
                pending.current = pending.current ?? doc;
                toast.error(`Catatan belum tersimpan. ${errorMessage(error)}`);
            }
        } finally {
            inFlight.current = undefined;
            setSaving(false);
        }
    }, [current.id]);

    /** Local mode only: the live document saves itself on the collab server. */
    const setContent = (doc: RichDoc | null) => {
        if (mode !== 'offline' || conflict) {
            return;
        }

        pending.current = doc;
        setSaving(true);
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(
            () => void flushContent(),
            SAVE_DELAY,
        );
    };

    /**
     * "Selesai mencatat": save now instead of waiting for the debounce —
     * the pending title, the pending body (save fallback) and, live, until
     * the collab server confirmed every change (max. 4 seconds). Resolves
     * false when something may not be saved.
     */
    const flushNow = async (): Promise<boolean> => {
        let ok = true;
        const pendingTitle = titleTimer.current !== undefined;
        window.clearTimeout(titleTimer.current);
        titleTimer.current = undefined;

        if (pendingTitle && title !== current.title) {
            try {
                const { note } = await notesApi.rename(current.id, title);
                setCurrent((state) => ({
                    ...state,
                    title: note.title,
                    updated_at: note.updated_at,
                }));
                base.current = note.updated_at ?? base.current;
            } catch {
                ok = false;
            }
        }

        if (pending.current !== undefined) {
            window.clearTimeout(saveTimer.current);
            await flushContent();
            ok = ok && pending.current === undefined && !conflict;
        }

        const provider = collab.provider;

        if (mode === 'live' && provider) {
            const deadline = Date.now() + 4000;

            while (provider.hasUnsyncedChanges && Date.now() < deadline) {
                await new Promise((resolve) => window.setTimeout(resolve, 150));
            }

            ok = ok && !provider.hasUnsyncedChanges;
        }

        return ok;
    };

    const setTitle = (next: string) => {
        setTitleState(next);
        window.clearTimeout(titleTimer.current);
        titleTimer.current = window.setTimeout(() => {
            titleTimer.current = undefined;
            notesApi
                .rename(current.id, next)
                .then(({ note }) => {
                    setCurrent((state) => ({
                        ...state,
                        title: note.title,
                        updated_at: note.updated_at,
                    }));
                    base.current = note.updated_at ?? base.current;
                    setSavedAt(Date.now());
                })
                .catch((error: unknown) => {
                    setTitleState(current.title);
                    toast.error(errorMessage(error));
                });
        }, TITLE_DELAY);
    };

    // Reclaimed stuck changes: the state above opens with them, and the
    // auto-save re-arms so the page owns the retry again. "Saved"/"conflict"
    // landed on the server — nothing to re-save.
    useEffect(() => {
        const stuck = takeUnsavedFor(props.current.id);

        if (!stuck || stuck.phase === 'saved' || stuck.phase === 'conflict') {
            return;
        }

        if (stuck.body !== undefined) {
            pending.current = stuck.body;
            setSaving(true);
            saveTimer.current = window.setTimeout(
                () => void flushContent(),
                SAVE_DELAY,
            );
        }

        if (stuck.pendingTitle !== null) {
            setTitle(stuck.pendingTitle);
        }
        // Runs once per opened note.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const editorRef = useRef<Editor | null>(null);
    const onReady = useCallback((instance: Editor | null) => {
        editorRef.current = instance;
        setEditor(instance);
    }, []);
    /** Title → body (Enter in the title). */
    const focusBody = useCallback(() => {
        const instance = editorRef.current;

        if (instance && !instance.isDestroyed) {
            instance.commands.focus('start');
        }
    }, []);

    const versions = restoredVersions ?? versionsProp ?? null;
    const preview =
        versions?.find((version) => version.id === previewId) ?? null;

    const openHistory = (open: boolean) => {
        setHistoryOpen(open);

        if (open && versions === null && !historyLoading) {
            setHistoryLoading(true);
            router.reload({
                only: ['versions'],
                onFinish: () => setHistoryLoading(false),
                onError: () => toast.error('Riwayat versi gagal dimuat.'),
            });
        }
    };

    const confirmRestore = async (): Promise<boolean> => {
        if (!confirming) {
            return false;
        }

        setRestoring(true);

        try {
            const response = await notesApi.restore(current.id, confirming.id);
            setCurrent((state) => ({ ...state, ...response.note }));
            setTitleState(response.note.title);
            base.current = response.note.updated_at ?? base.current;
            setRestoredVersions(response.versions);
            setConfirming(null);
            setPreviewId(null);
            // Live: the collab server replaced the document for everyone.
            if (mode !== 'live') {
                setEditorKey((key) => key + 1);
            }
            setSavedAt(Date.now());
            toast.success(
                'Versi dipulihkan. Semua penyunting melihat isi ini.',
            );

            return true;
        } catch (error) {
            toast.error(errorMessage(error));

            return false;
        } finally {
            setRestoring(false);
        }
    };

    const peers = collab.peers;
    const status =
        mode === 'connecting'
            ? 'Menyambung…'
            : conflict
              ? 'Belum tersimpan'
              : savedLabel(savedAt, now, saving);
    const presence =
        mode === 'live'
            ? collab.connected
                ? connectedLabel(peers.length)
                : 'Menyambung ulang…'
            : null;
    const collaborators: (NotePerson & { tone: number })[] = peers.map(
        (peer) => ({
            ...(props.people.find((person) => person.id === peer.id) ?? {
                id: peer.id,
                name: peer.name,
                avatar: null,
                title: '',
            }),
            tone: peer.tone,
        }),
    );

    return {
        props,
        me,
        note: current,
        title,
        setTitle,
        share,
        setShare,
        editable,
        mode,
        live,
        conflict,
        reload: () => router.reload(),
        collaborators,
        presence,
        status,
        saving,
        /** WebSocket of the live session currently open (for the status icon). */
        connected: collab.connected,
        setContent,
        flushNow,
        editor,
        editorKey,
        onReady,
        focusBody,
        history: {
            open: historyOpen,
            setOpen: openHistory,
            loading: historyLoading || (historyOpen && versions === null),
            versions: versions ?? [],
            preview,
            select: (version: NoteVersion) => setPreviewId(version.id),
            clearPreview: () => setPreviewId(null),
            confirming,
            askRestore: (version: NoteVersion) => setConfirming(version),
            cancelRestore: () => setConfirming(null),
            confirmRestore,
            processing: restoring,
        },
        shareOpen,
        setShareOpen,
        moveOpen,
        setMoveOpen,
        deleteOpen,
        setDeleteOpen,
        setCurrent,
    };
}

export type NoteSession = ReturnType<typeof useNoteSession>;
