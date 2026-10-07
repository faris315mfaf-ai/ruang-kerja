import { useCallback, useEffect, useRef, useState } from 'react';
import { usePolling } from '@/features/tasks/realtime/connection';

export type PasswordResetStatus =
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'expired';

/** The waiting page asks every 5 seconds (only while the tab is visible). */
export const STATUS_POLL_MS = 5_000;

const STATUSES: readonly PasswordResetStatus[] = [
    'pending',
    'approved',
    'rejected',
    'expired',
];

function isStatus(value: unknown): value is PasswordResetStatus {
    return STATUSES.includes(value as PasswordResetStatus);
}

type Options = {
    /** Status rendered by the server with the page. */
    initial: PasswordResetStatus;
    /** GET endpoint answering `{status}` (password-reset.status). */
    url: string;
    /** HR approved: continue to the new-password form. */
    onApproved: () => void;
    /** Rejected or expired: reload the page props (reason, final state). */
    onFinal: (status: 'rejected' | 'expired') => void;
    interval?: number;
    fetcher?: typeof fetch;
};

/**
 * Polls the "Lupa kata sandi" status while it is `pending`. Stops on any final
 * state, pauses while the tab is hidden (checks once when it is shown again),
 * never overlaps requests and ignores transient errors (offline, 429): the
 * next tick simply tries again.
 */
export function usePasswordResetStatus({
    initial,
    url,
    onApproved,
    onFinal,
    interval = STATUS_POLL_MS,
    fetcher,
}: Options): PasswordResetStatus {
    const [status, setStatus] = useState<PasswordResetStatus>(initial);
    const inFlight = useRef(false);
    const mounted = useRef(true);
    const callbacks = useRef({ onApproved, onFinal });

    useEffect(() => {
        callbacks.current = { onApproved, onFinal };
    });

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        setStatus(initial);
    }, [initial]);

    const check = useCallback(async () => {
        if (inFlight.current) {
            return;
        }

        inFlight.current = true;

        try {
            const response = await (fetcher ?? fetch)(url, {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                return;
            }

            const body: unknown = await response.json();
            const next =
                typeof body === 'object' && body !== null && 'status' in body
                    ? body.status
                    : null;

            if (!mounted.current || !isStatus(next) || next === 'pending') {
                return;
            }

            setStatus(next);

            if (next === 'approved') {
                callbacks.current.onApproved();
            } else {
                callbacks.current.onFinal(next);
            }
        } catch {
            // Offline or interrupted: try again on the next tick.
        } finally {
            inFlight.current = false;
        }
    }, [fetcher, url]);

    usePolling(status === 'pending', () => void check(), interval);

    return status;
}
