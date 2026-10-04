import { useSyncExternalStore } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/** Minimum viewport widths (px). Below `tablet` is mobile. */
export const BREAKPOINTS = {
    tablet: 768,
    desktop: 1024,
} as const;

const TABLET_QUERY = `(min-width: ${BREAKPOINTS.tablet}px)`;
const DESKTOP_QUERY = `(min-width: ${BREAKPOINTS.desktop}px)`;

function canMatchMedia(): boolean {
    return (
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    );
}

function subscribe(onChange: () => void): () => void {
    if (!canMatchMedia()) {
        return () => {};
    }

    const lists = [
        window.matchMedia(TABLET_QUERY),
        window.matchMedia(DESKTOP_QUERY),
    ];

    for (const list of lists) {
        list.addEventListener('change', onChange);
    }

    return () => {
        for (const list of lists) {
            list.removeEventListener('change', onChange);
        }
    };
}

/** Current breakpoint on the client. Falls back to desktop without matchMedia. */
export function getBreakpoint(): Breakpoint {
    if (!canMatchMedia() || window.matchMedia(DESKTOP_QUERY).matches) {
        return 'desktop';
    }

    return window.matchMedia(TABLET_QUERY).matches ? 'tablet' : 'mobile';
}

function getServerSnapshot(): null {
    return null;
}

/**
 * Active layout breakpoint: mobile (< 768px), tablet (768–1023px) or
 * desktop (>= 1024px).
 *
 * Returns `null` during SSR and hydration: the viewport is unknown there, so
 * callers must render a neutral shell (skeleton) to avoid hydration mismatch.
 * The real breakpoint is applied right after hydration.
 */
export function useBreakpoint(): Breakpoint | null {
    return useSyncExternalStore(subscribe, getBreakpoint, getServerSnapshot);
}
