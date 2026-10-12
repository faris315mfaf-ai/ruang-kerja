import { useSyncExternalStore } from 'react';
import { ApiError } from '@/features/tasks/lib/api';
import type { RichDoc } from '@/features/tasks/editor/types';
import { notesApi } from './api';
import { clearUnsent, stashUnsent } from './unsent-stash';

/** How long "Tersimpan ✓" stays on the pill before it disappears (ms). */
export const SAVED_SHOWN_MS = 2000;

/** Pill states: an attempt is running, it landed, or why it failed. */
export type UnsavedPhase = 'saving' | 'saved' | 'offline' | 'conflict';

/** Changes stuck when the editor page is left before its saves fired. */
export type UnsavedNote = {
    noteId: string;
    /** Latest known title (the pill label and the rename target). */
    title: string;
    /** Title stuck in the rename debounce (null = none). */
    pendingTitle: string | null;
    /** Body stuck in the save fallback (undefined = none, null = cleared). */
    body: RichDoc | null | undefined;
    /** `updated_at` the save fallback locks against. */
    baseUpdatedAt: string;
};

/**
 * The editor page's own writes that were still running when it handed the
 * changes over: resolves (never rejects) once they settled, with the
 * `updated_at` to lock against next and whether the handed-over body was
 * already saved by them.
 */
export type SettledWrites = { baseUpdatedAt: string; bodySaved: boolean };

export type UnsavedHandoff = UnsavedNote & {
    /** Running page writes to wait for before saving (stale-base 409 guard). */
    settle?: Promise<SettledWrites>;
};

export type UnsavedState = UnsavedNote & { phase: UnsavedPhase };

/**
 * "Catatan belum tersimpan" (keputusan pemilik 9 Okt 2026): leaving the
 * note editor while the debounced saves have not fired must not lose them.
 * The editor page hands the stuck changes over to this module store on
 * unmount — it survives Inertia navigation, the save continues in the
 * background and the floating pill (unsaved-pill.tsx, mounted in the app
 * shell) reports the outcome. When the note page opens again, it reclaims
 * (`takeUnsavedFor`) and its own auto-save takes over.
 *
 * One entry per note: leaving a second note while the first is still stuck
 * keeps both. Failed (offline) entries are also copied to localStorage
 * (unsent-stash.ts) so closing the tab does not lose them.
 */
const states = new Map<string, UnsavedState>();
const settles = new Map<string, Promise<SettledWrites>>();
const running = new Map<string, Promise<boolean>>();
const savedTimers = new Map<string, number>();
/**
 * Stamp per note, bumped on every change of that entry; a save result of an
 * entry that was replaced, adopted or dismissed meanwhile is dropped.
 */
const stamps = new Map<string, number>();
let stampCounter = 0;
let snapshot: UnsavedState[] = [];
const listeners = new Set<() => void>();

function emit(): void {
    snapshot = [...states.values()];
    listeners.forEach((listener) => listener());
}

function clearSavedTimer(noteId: string): void {
    window.clearTimeout(savedTimers.get(noteId));
    savedTimers.delete(noteId);
}

function publish(noteId: string, next: UnsavedState | null): void {
    stamps.set(noteId, ++stampCounter);

    if (next === null) {
        states.delete(noteId);
    } else {
        // Re-insert: the most recent entry is last (the pill shows it).
        states.delete(noteId);
        states.set(noteId, next);
    }

    emit();
}

/**
 * The editor page leaves (back/navigate) with unsaved changes: take them
 * over and keep saving in the background — auto-save does not stop because
 * the page was left.
 */
export function handoffUnsavedChanges(handoff: UnsavedHandoff): void {
    const { settle, ...note } = handoff;
    clearSavedTimer(note.noteId);

    if (settle) {
        settles.set(note.noteId, settle);
    }

    publish(note.noteId, { ...note, phase: 'saving' });
    startFlush(note.noteId);
}

/**
 * "Simpan"/"Coba lagi" on the pill (one note, or every stuck note).
 * Resolves false when something is still unsaved.
 */
export function flushUnsavedChanges(noteId?: string): Promise<boolean> {
    const ids = noteId !== undefined ? [noteId] : [...states.keys()];

    return Promise.all(ids.map(flushOne)).then((results) =>
        results.every(Boolean),
    );
}

function flushOne(noteId: string): Promise<boolean> {
    const current = running.get(noteId);

    if (current) {
        return current;
    }

    const stuck = states.get(noteId);

    if (!stuck || stuck.phase === 'saved' || stuck.phase === 'conflict') {
        return Promise.resolve(stuck === undefined || stuck.phase === 'saved');
    }

    startFlush(noteId);

    return running.get(noteId) ?? Promise.resolve(false);
}

function startFlush(noteId: string): void {
    const stuck = states.get(noteId);

    if (!stuck || running.has(noteId)) {
        return;
    }

    // Show the attempt on the pill (button disabled, spinner).
    const attempt: UnsavedState = { ...stuck, phase: 'saving' };
    states.set(noteId, attempt);
    emit();
    const token = stamps.get(noteId) ?? 0;
    const flush = runFlush(attempt, token);
    running.set(noteId, flush);
    void flush; // never rejects: failures are published, not thrown
}

async function runFlush(stuck: UnsavedState, token: number): Promise<boolean> {
    const noteId = stuck.noteId;
    let base = stuck.baseUpdatedAt;
    let body = stuck.body;
    let pendingTitle = stuck.pendingTitle;

    try {
        // The page's own save/rename may still be running: wait, then lock
        // against the `updated_at` they produced (else: false 409).
        const settle = settles.get(noteId);

        if (settle) {
            settles.delete(noteId);
            const settled = await settle;
            base = settled.baseUpdatedAt || base;

            if (settled.bodySaved) {
                body = undefined;
            }
        }

        // Title first, then the body: the rename bumps the `updated_at`
        // the body save locks against.
        if (pendingTitle !== null) {
            const { note } = await notesApi.rename(noteId, pendingTitle);
            base = note.updated_at ?? base;
            pendingTitle = null;
        }

        if (body !== undefined) {
            const { note } = await notesApi.saveContent(noteId, body, base);
            base = note.updated_at ?? base;
        }

        if (stamps.get(noteId) !== token) {
            return true;
        }

        clearUnsent(noteId);
        publish(noteId, {
            ...stuck,
            pendingTitle: null,
            baseUpdatedAt: base,
            phase: 'saved',
        });
        clearSavedTimer(noteId);
        savedTimers.set(
            noteId,
            window.setTimeout(() => {
                savedTimers.delete(noteId);
                publish(noteId, null);
            }, SAVED_SHOWN_MS),
        );

        return true;
    } catch (error) {
        if (stamps.get(noteId) !== token) {
            return false;
        }

        const failed: UnsavedState = {
            ...stuck,
            // The rename may have landed; then only the body stays stuck,
            // retried against the bumped base.
            pendingTitle,
            body,
            baseUpdatedAt: base,
            phase:
                error instanceof ApiError && error.status === 409
                    ? 'conflict'
                    : 'offline',
        };

        if (failed.phase === 'offline') {
            stashUnsent(failed);
        }

        publish(noteId, failed);

        return false;
    } finally {
        running.delete(noteId);

        // A handoff that arrived while this request was running left a new
        // unflushed entry behind ("saving") — flush it now.
        if (states.get(noteId)?.phase === 'saving') {
            startFlush(noteId);
        }
    }
}

/**
 * The note page opens again and reclaims its stuck changes (the editor
 * adopts them and re-arms its own auto-save). Clears the pill.
 */
export function takeUnsavedFor(noteId: string): UnsavedState | null {
    const stuck = states.get(noteId) ?? null;

    if (!stuck) {
        return null;
    }

    dismissUnsaved(noteId);

    return stuck;
}

/** Read without claiming (initial state of a reopening note page). */
export function readUnsavedFor(noteId: string): UnsavedState | null {
    return states.get(noteId) ?? null;
}

/** Wait for the running background save(s) (the pill body taps back to the note). */
export async function settleUnsavedChanges(noteId?: string): Promise<void> {
    if (noteId !== undefined) {
        const flush = running.get(noteId);

        if (flush) {
            await flush;
        }

        return;
    }

    await Promise.all(running.values());
}

/** Drop the stuck changes without saving (one note, or all). */
export function dismissUnsaved(noteId?: string): void {
    const ids = noteId !== undefined ? [noteId] : [...states.keys()];

    for (const id of ids) {
        clearSavedTimer(id);
        settles.delete(id);
        clearUnsent(id);
        publish(id, null);
    }

    if (noteId === undefined) {
        emit();
    }
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

const EMPTY: UnsavedState[] = [];

/** Every stuck note, the most recently handed over last. */
export function useUnsavedNotes(): UnsavedState[] {
    return useSyncExternalStore(
        subscribe,
        () => snapshot,
        () => EMPTY,
    );
}

/** Most recent stuck note, null when there are none. */
export function useUnsavedNote(): UnsavedState | null {
    return useUnsavedNotes().at(-1) ?? null;
}
