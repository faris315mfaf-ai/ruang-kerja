import { useSyncExternalStore } from 'react';

const THRESHOLD = 4;

function subscribe(callback: () => void): () => void {
    window.addEventListener('scroll', callback, { passive: true });

    return () => window.removeEventListener('scroll', callback);
}

/** True once the page has scrolled (glass app bar appears). */
export function useScrolled(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => window.scrollY > THRESHOLD,
        () => false,
    );
}
