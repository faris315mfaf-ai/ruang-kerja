import { useSyncExternalStore } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

let status: SaveStatus = 'idle';
const listeners = new Set<() => void>();

export function setSaveStatus(next: SaveStatus): void {
    status = next;
    listeners.forEach((listener) => listener());
}

/** Shared so the mobile app bar can show "Tersimpan otomatis". */
export function useSaveStatus(): SaveStatus {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);

            return () => listeners.delete(listener);
        },
        () => status,
        () => 'idle',
    );
}
