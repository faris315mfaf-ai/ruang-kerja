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
    settleUnsavedChanges,
    takeUnsavedFor,
    type UnsavedHandoff,
} from './unsaved-store';
import {
    clearUnsent,
    readUnsent,
    recoverUnsent,
    stashUnsent,
} from './unsent-stash';
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
    // debounced saves fired): open with them unless they hit a conflict.
    // The takeover below waits for their background save to settle, adopts
    // its `updated_at` and re-arms the auto-save.
    const [adoptedAtOpen] = useState(() => {
        const stuck = readUnsavedFor(props.current.id);

        return stuck !== null && stuck.phase !== 'conflict' ? stuck : null;
    });
    const [current, setCurrent] = useState<NoteDetail>(
        adoptedAtOpen && adoptedAtOpen.body !== undefined
            ? { ...props.current, content: adoptedAtOpen.body }
            : props.current,
    );
    const [title, setTitleState] = useState(
        adoptedAtOpen ? adoptedAtOpen.title : props.current.title,
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
    const [conflict, setConflictState] = useState(false);
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
    /** Last body the server confirmed (to skip re-sending it after a handoff). */
    const lastSaved = useRef<RichDoc | null | undefined>(undefined);
    const base = useRef(current.updated_at ?? '');
    /** Conflict without the render-closure lag (flushNow reads it after awaits). */
    const conflictRef = useRef(false);
    /**
     * Every write that bumps `updated_at` (rename, body save, the takeover
     * of stuck changes) runs one after another: each reads `base` only when
     * it starts, so a rename and a body save never race into a false 409.
     */
    const queue = useRef<Promise<void>>(Promise.resolve());
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

    const setConflict = (value: boolean) => {
        conflictRef.current = value;
        setConflictState(value);
    };

    /** Run after every earlier write settled; never breaks the chain. */
    const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
        const run = queue.current.then(job);
        queue.current = run.then(
            () => undefined,
            () => undefined,
        );

        return run;
    };

    /** Changes that would be lost when the page goes away right now. */
    const stuckChanges = (): UnsavedHandoff | null => {
        const snapshot = latest.current;
        const pendingTitle =
            titleTimer.current !== undefined &&
            snapshot.title !== snapshot.noteTitle
                ? snapshot.title
                : null;
        // A save in flight may still fail after the page is gone — hand
        // its body over too, so the pill can retry it (skipped when it
        // lands: see `settle`).
        const fromInFlight =
            pending.current === undefined ? inFlight.current : undefined;
        const body =
            pending.current !== undefined ? pending.current : inFlight.current;

        if (pendingTitle === null && body === undefined) {
            return null;
        }

        return {
            noteId: snapshot.noteId,
            title: snapshot.title,
            pendingTitle,
            body,
            baseUpdatedAt: base.current,
            // The background save must lock against the `updated_at` the
            // running writes produce, not the one known now.
            settle: queue.current.then(() => ({
                baseUpdatedAt: base.current,
                bodySaved:
                    fromInFlight !== undefined &&
                    lastSaved.current === fromInFlight,
            })),
        };
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

    // Real unload (close/reload): no cleanup runs there. Stash the changes
    // in localStorage (recovered on the next open) and fire one keepalive
    // save that outlives the document. A page frozen in the back/forward
    // cache (`persisted`) sends nothing — its base would go stale and every
    // later save would conflict; it resumes its own auto-save on return.
    useEffect(() => {
        const onPageHide = (event: PageTransitionEvent) => {
            const stuck = stuckChanges();

            if (!stuck) {
                return;
            }

            stashUnsent(stuck);

            if (!event.persisted) {
                saveUnsentKeepalive(stuck);
            }
        };
        const onPageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                clearUnsent(latest.current.noteId);
            }
        };

        window.addEventListener('pagehide', onPageHide);
        window.addEventListener('pageshow', onPageShow);

        return () => {
            window.removeEventListener('pagehide', onPageHide);
            window.removeEventListener('pageshow', onPageShow);
        };
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

    /**
     * Save the pending body (queued behind running writes). Resolves when
     * every write so far settled — also when nothing was pending, so callers
     * can wait for a save already in flight.
     */
    const flushContent = (): Promise<void> => {
        const doc = pending.current;

        if (doc === undefined) {
            return queue.current;
        }

        pending.current = undefined;
        inFlight.current = doc;
        setSaving(true);

        return enqueue(async () => {
            try {
                if (conflictRef.current) {
                    // Someone else saved: keep the body unsent (reload).
                    pending.current = pending.current ?? doc;

                    return;
                }

                const { note } = await notesApi.saveContent(
                    latest.current.noteId,
                    doc,
                    base.current,
                );
                base.current = note.updated_at ?? base.current;
                lastSaved.current = doc;
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
                    toast.error(
                        `Catatan belum tersimpan. ${errorMessage(error)}`,
                    );
                }
            } finally {
                if (inFlight.current === doc) {
                    inFlight.current = undefined;
                }

                setSaving(false);
            }
        });
    };

    const scheduleSave = () => {
        setSaving(true);
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(
            () => void flushContent(),
            SAVE_DELAY,
        );
    };

    /** Local mode only: the live document saves itself on the collab server. */
    const setContent = (doc: RichDoc | null) => {
        if (mode !== 'offline' || conflictRef.current) {
            return;
        }

        pending.current = doc;
        scheduleSave();
    };

    /** Rename now (queued behind running writes). Resolves false on failure. */
    const renameNow = (next: string): Promise<boolean> =>
        enqueue(async () => {
            try {
                const { note } = await notesApi.rename(
                    latest.current.noteId,
                    next,
                );
                setCurrent((state) => ({
                    ...state,
                    title: note.title,
                    updated_at: note.updated_at,
                }));
                base.current = note.updated_at ?? base.current;
                setSavedAt(Date.now());

                return true;
            } catch (error) {
                setTitleState(latest.current.noteTitle);
                toast.error(errorMessage(error));

                return false;
            }
        });

    /**
     * "Selesai mencatat": save now instead of waiting for the debounce —
     * the pending title, the pending body (save fallback, also one already
     * in flight) and, live, until the collab server confirmed every change
     * (max. 4 seconds). Resolves false when something may not be saved.
     */
    const flushNow = async (): Promise<boolean> => {
        let ok = true;
        const pendingTitle = titleTimer.current !== undefined;
        window.clearTimeout(titleTimer.current);
        titleTimer.current = undefined;
        const snapshot = latest.current;

        if (pendingTitle && snapshot.title !== snapshot.noteTitle) {
            ok = await renameNow(snapshot.title);
        }

        window.clearTimeout(saveTimer.current);
        await flushContent();
        ok = ok && pending.current === undefined && !conflictRef.current;

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
            void renameNow(next);
        }, TITLE_DELAY);
    };

    /** Re-arm the auto-save for changes this page takes over. */
    const rearm = (
        body: RichDoc | null | undefined,
        pendingTitle: string | null,
    ) => {
        // Typed meanwhile: the newer body wins.
        if (body !== undefined && pending.current === undefined) {
            pending.current = body;
            scheduleSave();
        }

        if (pendingTitle !== null) {
            setTitle(pendingTitle);
        }
    };

    // Take over stuck changes of this note. A background save still
    // running is awaited first (no double save, no stale-base 409) and its
    // resulting `updated_at` adopted. Without an in-memory entry, changes
    // stashed in localStorage (tab closed, keepalive too large) are
    // recovered when the server still has the version they were based on.
    useEffect(() => {
        const noteId = props.current.id;
        let alive = true;

        const takeOver = async () => {
            await settleUnsavedChanges(noteId);

            if (!alive) {
                return;
            }

            const stuck = takeUnsavedFor(noteId);

            if (stuck) {
                if (stuck.phase === 'conflict') {
                    // Opened with the stuck body: keep it on screen, but
                    // never save it over the other person's version.
                    if (adoptedAtOpen) {
                        setConflict(true);
                    }

                    return;
                }

                if (stuck.baseUpdatedAt !== '') {
                    base.current = stuck.baseUpdatedAt;
                }

                if (stuck.phase !== 'saved') {
                    rearm(stuck.body, stuck.pendingTitle);
                }

                return;
            }

            const recovered = recoverUnsent(readUnsent(noteId), {
                title: props.current.title,
                updated_at: props.current.updated_at,
            });
            clearUnsent(noteId);

            if (!recovered) {
                return;
            }

            if (recovered.body !== undefined && pending.current === undefined) {
                const body = recovered.body;
                setCurrent((state) => ({ ...state, content: body }));
                setEditorKey((key) => key + 1);
            }

            rearm(recovered.body, recovered.pendingTitle);
            toast.info('Perubahan yang belum tersimpan dipulihkan.');
        };

        void enqueue(takeOver);

        return () => {
            alive = false;
        };
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
