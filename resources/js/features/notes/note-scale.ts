import { useSyncExternalStore } from 'react';

/**
 * Text size of the note editor (keputusan pemilik 6 Okt 2026): 90–160% in
 * steps of 10, remembered per device (localStorage). Only the note body
 * scales (CSS var --note-scale, base size per device in app.css). Storage
 * may be unavailable (private mode, blocked site data): the size then lives
 * for this page only.
 */
export const SCALE_KEY = 'rk.notes.scale.v1';
export const SCALE_MIN = 90;
export const SCALE_MAX = 160;
export const SCALE_STEP = 10;
export const SCALE_DEFAULT = 100;

/** Rounds to a step inside the range; anything unreadable is 100%. */
export function clampScale(value: unknown): number {
    const number = typeof value === 'string' ? Number(value) : value;

    if (typeof number !== 'number' || !Number.isFinite(number)) {
        return SCALE_DEFAULT;
    }

    const stepped = Math.round(number / SCALE_STEP) * SCALE_STEP;

    return Math.min(SCALE_MAX, Math.max(SCALE_MIN, stepped));
}

function readStored(): number {
    try {
        const raw = window.localStorage.getItem(SCALE_KEY);

        return raw === null ? SCALE_DEFAULT : clampScale(raw);
    } catch {
        return SCALE_DEFAULT;
    }
}

let current: number | null = null;
const listeners = new Set<() => void>();

function notify(): void {
    listeners.forEach((listener) => listener());
}

export function getNoteScale(): number {
    if (current === null) {
        current = typeof window === 'undefined' ? SCALE_DEFAULT : readStored();
    }

    return current;
}

export function setNoteScale(value: number): number {
    const next = clampScale(value);
    current = next;

    try {
        if (next === SCALE_DEFAULT) {
            window.localStorage.removeItem(SCALE_KEY);
        } else {
            window.localStorage.setItem(SCALE_KEY, String(next));
        }
    } catch {
        // Not remembered on this device; still applied on this page.
    }

    notify();

    return next;
}

export function stepNoteScale(direction: 1 | -1): number {
    return setNoteScale(getNoteScale() + direction * SCALE_STEP);
}

/** Test hook: forget the cached value (re-read from storage). */
export function resetNoteScaleCache(): void {
    current = null;
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    const onStorage = (event: StorageEvent) => {
        if (event.key === SCALE_KEY) {
            current = null;
            listener();
        }
    };
    window.addEventListener('storage', onStorage);

    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
    };
}

export function useNoteScale(): number {
    return useSyncExternalStore(subscribe, getNoteScale, () => SCALE_DEFAULT);
}
