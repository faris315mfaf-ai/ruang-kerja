import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { HttpRequestError, requestJson } from '@/lib/http';
import { clockOffset, refreshDelay } from '@/lib/kiosk';
import kioskRoutes from '@/routes/kiosk';
import type { KioskState } from '@/types/attendance';

const RETRY_MS = 5_000;

/**
 * Keeps the kiosk QR current: fetches the next code right after each 30-second
 * window and retries every 5 s while offline. A 401/403 (kiosk deactivated or
 * re-paired) reloads the page so the server can show the right screen.
 */
export function useKioskCode(locationId: string, initial: KioskState) {
    const [state, setState] = useState<KioskState>(initial);
    const [offset, setOffset] = useState(() =>
        clockOffset(initial.serverTime, Date.now()),
    );
    const [offline, setOffline] = useState(false);
    const [now, setNow] = useState(() => Date.now() + offset);
    const timer = useRef<number | null>(null);

    useEffect(() => {
        let active = true;

        const schedule = (delay: number, next: () => void) => {
            if (timer.current !== null) {
                window.clearTimeout(timer.current);
            }

            timer.current = window.setTimeout(next, delay);
        };

        const load = async () => {
            try {
                const next = await requestJson<KioskState>(
                    kioskRoutes.code.url(locationId),
                );
                const nextOffset = clockOffset(next.serverTime, Date.now());

                if (!active) {
                    return;
                }

                setState(next);
                setOffset(nextOffset);
                setOffline(false);
                schedule(
                    refreshDelay(next.code.validUntil, Date.now() + nextOffset),
                    () => void load(),
                );
            } catch (error) {
                if (!active) {
                    return;
                }

                if (
                    error instanceof HttpRequestError &&
                    (error.status === 401 || error.status === 403)
                ) {
                    router.reload();

                    return;
                }

                setOffline(true);
                schedule(RETRY_MS, () => void load());
            }
        };

        schedule(
            refreshDelay(initial.code.validUntil, Date.now() + offset),
            () => void load(),
        );

        return () => {
            active = false;

            if (timer.current !== null) {
                window.clearTimeout(timer.current);
            }
        };
        // Runs once per page: later codes come from load() itself.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationId]);

    useEffect(() => {
        const tick = window.setInterval(() => setNow(Date.now() + offset), 250);

        return () => window.clearInterval(tick);
    }, [offset]);

    const stale = Date.parse(state.code.validUntil) < now;

    return { state, now, offline: offline || stale };
}
