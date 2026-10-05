import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';

/** `realtime` = WebSocket connected; `polling` = fall back to 30 s polling. */
export type ConnectionMode = 'realtime' | 'polling';

export const POLL_INTERVAL_MS = 30_000;

/**
 * Reverb connection state shared by the board, list and task detail. Any
 * state other than "connected" (connecting, unavailable, failed, Echo not
 * configured) counts as polling.
 */
export function useConnectionMode(): ConnectionMode {
    const [mode, setMode] = useState<ConnectionMode>(() => current());

    useEffect(() => {
        if (!echoIsConfigured()) {
            return;
        }

        try {
            const connector = echo().connector;
            setMode(
                connector.connectionStatus() === 'connected'
                    ? 'realtime'
                    : 'polling',
            );

            return connector.onConnectionChange((status) =>
                setMode(status === 'connected' ? 'realtime' : 'polling'),
            );
        } catch {
            setMode('polling');
        }
    }, []);

    return mode;
}

function current(): ConnectionMode {
    try {
        return echoIsConfigured() &&
            echo().connector.connectionStatus() === 'connected'
            ? 'realtime'
            : 'polling';
    } catch {
        return 'polling';
    }
}

/**
 * Runs `callback` every `interval` ms while `enabled` and the tab is
 * visible, and once when the tab becomes visible again.
 */
export function usePolling(
    enabled: boolean,
    callback: () => void,
    interval: number = POLL_INTERVAL_MS,
): void {
    const tick = useRef(callback);

    useEffect(() => {
        tick.current = callback;
    });

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const run = () => {
            if (document.visibilityState === 'visible') {
                tick.current();
            }
        };
        const timer = window.setInterval(run, interval);
        document.addEventListener('visibilitychange', run);

        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', run);
        };
    }, [enabled, interval]);
}
