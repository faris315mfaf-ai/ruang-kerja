import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void): () => void {
    const query = window.matchMedia(QUERY);
    query.addEventListener('change', callback);

    return () => query.removeEventListener('change', callback);
}

/** True when the user asked the OS to reduce motion (live, SSR-safe). */
export function useReducedMotion(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(QUERY).matches,
        () => false,
    );
}
