import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { NOW } from './fixtures';
import { officeInstant, parseClock } from './lib';

/**
 * Preview-only page states, read from the query string so every state has a
 * shareable URL: `?keadaan=kosong|galat|memuat` (+ page-specific ones such as
 * `terputus`) and `?jam=10.42` to move the sample clock.
 */
export type PreviewState =
    | 'normal'
    | 'kosong'
    | 'galat'
    | 'memuat'
    | 'terputus';

const STATES: PreviewState[] = [
    'normal',
    'kosong',
    'galat',
    'memuat',
    'terputus',
];

export function readPreviewQuery(url: string): {
    state: PreviewState;
    clock: string | null;
    path: string;
    query: string;
} {
    const [path, query = ''] = url.split('?');
    const params = new URLSearchParams(query);
    const raw = params.get('keadaan') as PreviewState | null;
    const jam = params.get('jam');

    return {
        state: raw && STATES.includes(raw) ? raw : 'normal',
        clock: jam && parseClock(jam) !== null ? jam.replace('.', ':') : null,
        path,
        query,
    };
}

export function usePreviewState() {
    const { url } = usePage();

    return readPreviewQuery(url);
}

/**
 * Sample clock: starts at Monday 5 Oct 2026 10.25 (or `?jam=`) and then runs
 * in real time, so countdowns tick while the page is open.
 */
export function useDemoClock(): number {
    const { clock } = usePreviewState();
    const start = clock
        ? Date.parse(officeInstant(NOW.slice(0, 10), clock))
        : Date.parse(NOW);
    const [mountedAt] = useState(() => Date.now());
    const [tick, setTick] = useState(mountedAt);

    useEffect(() => {
        const id = window.setInterval(() => setTick(Date.now()), 15_000);

        return () => window.clearInterval(id);
    }, []);

    return start + (tick - mountedAt);
}
