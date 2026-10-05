import { useEffect, useState } from 'react';

function offsetFrom(serverTime: string | null | undefined): number {
    const server = serverTime ? Date.parse(serverTime) : Number.NaN;

    return Number.isNaN(server) ? 0 : server - Date.now();
}

/**
 * A clock aligned to the server time sent with the page (measured once per
 * page load), so the big clock and the "minutes before start" hint do not
 * depend on a wrong device clock.
 */
export function useServerClock(
    serverTime: string | null | undefined,
    intervalMs = 1000,
): Date {
    const [offset] = useState(() => offsetFrom(serverTime));
    const [now, setNow] = useState(() => new Date(Date.now() + offset));

    useEffect(() => {
        const timer = window.setInterval(
            () => setNow(new Date(Date.now() + offset)),
            intervalMs,
        );

        return () => window.clearInterval(timer);
    }, [offset, intervalMs]);

    return now;
}
