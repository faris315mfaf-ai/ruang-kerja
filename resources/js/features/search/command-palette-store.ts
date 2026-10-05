import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

function emit(): void {
    listeners.forEach((listener) => listener());
}

export function setCommandPaletteOpen(next: boolean): void {
    if (open !== next) {
        open = next;
        emit();
    }
}

export function toggleCommandPalette(): void {
    setCommandPaletteOpen(!open);
}

export function useCommandPaletteOpen(): boolean {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);

            return () => listeners.delete(listener);
        },
        () => open,
        () => false,
    );
}
