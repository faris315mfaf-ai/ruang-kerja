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

function getInset(): number {
    const viewport = window.visualViewport;

    if (!viewport) {
        return 0;
    }

    return Math.max(
        0,
        Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
    );
}

/**
 * Height (px) hidden by the on-screen keyboard, for bars that must sit right
 * above it (sticky comment box, docs/PLATFORM.md §4).
 */
export function useKeyboardInset(): number {
    return useSyncExternalStore(
        (callback) => {
            const viewport =
                typeof window === 'undefined' ? null : window.visualViewport;
            viewport?.addEventListener('resize', callback);
            viewport?.addEventListener('scroll', callback);

            return () => {
                viewport?.removeEventListener('resize', callback);
                viewport?.removeEventListener('scroll', callback);
            };
        },
        getInset,
        () => 0,
    );
}
