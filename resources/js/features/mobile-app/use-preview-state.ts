import { useCallback, useState } from 'react';
import { parsePreviewState } from './logic';
import type { PreviewState } from './types';

function currentSearch(): string {
    return typeof window === 'undefined' ? '' : window.location.search;
}

function writeQuery(key: string, value: string | null) {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);

    if (value === null) {
        url.searchParams.delete(key);
    } else {
        url.searchParams.set(key, value);
    }

    // Keep Inertia's history state; only the query changes (no visit).
    window.history.replaceState(window.history.state, '', url);
}

/**
 * Preview state of a prototype screen: `?keadaan=kosong|galat` so reviewers
 * can link straight to the empty/error versions. Read on the client only.
 */
export function usePreviewState(): [
    PreviewState,
    (next: PreviewState) => void,
] {
    const [state, setState] = useState<PreviewState>(() =>
        parsePreviewState(currentSearch()),
    );

    const update = useCallback((next: PreviewState) => {
        setState(next);
        writeQuery('keadaan', next === 'normal' ? null : next);
    }, []);

    return [state, update];
}

/** A simulation scenario kept in the query (`?skenario=`), e.g. "lokasi-palsu". */
export function useScenario<T extends string>(
    allowed: readonly T[],
    fallback: T,
): [T, (next: T) => void] {
    const [scenario, setScenario] = useState<T>(() => {
        const value = new URLSearchParams(currentSearch()).get('skenario');

        return allowed.includes(value as T) ? (value as T) : fallback;
    });

    const update = useCallback(
        (next: T) => {
            setScenario(next);
            writeQuery('skenario', next === fallback ? null : next);
        },
        [fallback],
    );

    return [scenario, update];
}
