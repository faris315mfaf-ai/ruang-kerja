import { useSyncExternalStore } from 'react';
import { ApiError } from '@/features/tasks/lib/api';
import type { RichDoc } from '@/features/tasks/editor/types';
import { notesApi } from './api';

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

export type UnsavedState = UnsavedNote & { phase: UnsavedPhase };

/**
 * "Catatan belum tersimpan" (keputusan pemilik 9 Okt 2026): leaving the
 * note editor while the debounced saves have not fired must not lose them.
 * The editor page hands the stuck changes over to this module store on
 * unmount — it survives Inertia navigation, the save continues in the
 * background and the floating pill (unsaved-pill.tsx, mounted in the app
 * shell) reports the outcome. When the note page opens again, it reclaims
 * (`takeUnsavedFor`) and its own auto-save takes over.
 */
let state: UnsavedState | null = null;
let flushing = false;
let inflight: Promise<boolean> | null = null;
let savedTimer: number | undefined;
/**
 * Bumped on every store change; a save result of an entry that was
 * replaced, adopted or dismissed meanwhile is dropped.
 */
let seq = 0;
const listeners = new Set<() => void>();

function emit(): void {
    listeners.forEach((listener) => listener());
}

function publish(next: UnsavedState | null): void {
    seq++;
    state = next;
    emit();
}

/**
 * The editor page leaves (back/navigate) with unsaved changes: take them
 * over and keep saving in the background — auto-save does not stop because
 * the page was left.
 */
export function handoffUnsavedChanges(note: UnsavedNote): void {
    window.clearTimeout(savedTimer);
    savedTimer = undefined;
    publish({ ...note, phase: 'saving' });
    startFlush();
}

/** "Simpan"/"Coba lagi" on the pill. Resolves false when still unsaved. */
export function flushUnsavedChanges(): Promise<boolean> {
    if (flushing) {
        return inflight ?? Promise.resolve(false);
    }

    const stuck = state;

    if (!stuck || stuck.phase === 'saved' || stuck.phase === 'conflict') {
        return Promise.resolve(stuck?.phase === 'saved');
    }

    startFlush();

    return inflight ?? Promise.resolve(false);
}

function startFlush(): void {
    const stuck = state;

    if (!stuck || flushing) {
        return;
    }

    flushing = true;
    // Show the attempt on the pill (button disabled, spinner).
    state = { ...stuck, phase: 'saving' };
    emit();
    const token = seq;
    inflight = runFlush(stuck, token);
    void inflight; // never rejects: failures are published, not thrown
}

async function runFlush(stuck: UnsavedState, token: number): Promise<boolean> {
    let base = stuck.baseUpdatedAt;
    let savedTitle = false;

    try {
        // Title first, then the body: the rename bumps the `updated_at`
        // the body save locks against (same order as flushNow()).
        if (stuck.pendingTitle !== null) {
            const { note } = await notesApi.rename(
                stuck.noteId,
                stuck.pendingTitle,
            );
            base = note.updated_at ?? base;
            savedTitle = true;
        }

        if (stuck.body !== undefined) {
            await notesApi.saveContent(stuck.noteId, stuck.body, base);
        }

        if (token !== seq) {
            return true;
        }

        publish({ ...stuck, phase: 'saved' });
        window.clearTimeout(savedTimer);
        savedTimer = window.setTimeout(() => {
            savedTimer = undefined;
            publish(null);
        }, SAVED_SHOWN_MS);

        return true;
    } catch (error) {
        if (token !== seq) {
            return false;
        }

        publish({
            ...stuck,
            // The rename may have landed; then only the body stays stuck,
            // retried against the bumped base.
            pendingTitle: savedTitle ? null : stuck.pendingTitle,
            baseUpdatedAt: base,
            phase:
                error instanceof ApiError && error.status === 409
                    ? 'conflict'
                    : 'offline',
        });

        return false;
    } finally {
        flushing = false;
        inflight = null;

        // A handoff that arrived while this request was running left a new
        // unflushed entry behind ("saving") — flush it now.
        if (state !== null && state.phase === 'saving') {
            startFlush();
        }
    }
}

/**
 * The note page opens again and reclaims its stuck changes (the editor
 * adopts them and re-arms its own auto-save). Clears the pill.
 */
export function takeUnsavedFor(noteId: string): UnsavedState | null {
    const stuck = state;

    if (!stuck || stuck.noteId !== noteId) {
        return null;
    }

    dismissUnsaved();

    return stuck;
}

/** Read without claiming (initial state of a reopening note page). */
export function readUnsavedFor(noteId: string): UnsavedState | null {
    const stuck = state;

    return stuck && stuck.noteId === noteId ? stuck : null;
}

/** Wait for the running background save (the pill body taps back to the note). */
export async function settleUnsavedChanges(): Promise<void> {
    if (inflight !== null) {
        await inflight;
    }
}

/** Drop the stuck changes without saving. */
export function dismissUnsaved(): void {
    window.clearTimeout(savedTimer);
    savedTimer = undefined;
    publish(null);
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

/** Stuck changes for the pill, null when there are none. */
export function useUnsavedNote(): UnsavedState | null {
    return useSyncExternalStore(
        subscribe,
        () => state,
        () => null,
    );
}
