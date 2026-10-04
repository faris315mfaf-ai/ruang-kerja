import { useSyncExternalStore } from 'react';

/** Software keyboard usually shrinks the visual viewport by > 150px. */
const KEYBOARD_THRESHOLD = 150;

function subscribe(callback: () => void): () => void {
    const viewport =
        typeof window === 'undefined' ? null : window.visualViewport;

    viewport?.addEventListener('resize', callback);

    return () => viewport?.removeEventListener('resize', callback);
}

function getSnapshot(): boolean {
    const viewport = window.visualViewport;

    if (!viewport) {
        return false;
    }

    return window.innerHeight - viewport.height > KEYBOARD_THRESHOLD;
}

/** True while the on-screen keyboard is open (hides the tab bar). */
export function useKeyboardOpen(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
