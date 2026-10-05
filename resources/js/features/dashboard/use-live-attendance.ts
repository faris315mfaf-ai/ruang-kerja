import { echo, echoIsConfigured } from '@laravel/echo-react';
import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

const POLL_MS = 60_000;

/**
 * Keeps "Kehadiran hari ini" live: listens for `.attendance.recorded` on the
 * given private channels (company / division, authorized by
 * AttendanceDayPolicy) and reloads only the listed props. Without a socket it
 * polls every minute while the tab is visible.
 */
export function useLiveAttendance(channels: string[], only: string[]): boolean {
    const [live, setLive] = useState(false);
    const key = channels.join('|');
    const props = useRef(only);

    useEffect(() => {
        props.current = only;
    });

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const reload = () => {
            if (timer) {
                clearTimeout(timer);
            }

            // Several check-ins at 07.59 → one reload.
            timer = setTimeout(
                () =>
                    router.reload({
                        only: props.current,
                    }),
                800,
            );
        };

        let cleanup = () => {};

        try {
            if (!echoIsConfigured() || key === '') {
                throw new Error('No realtime');
            }

            const instance = echo();
            const names = key.split('|');

            for (const name of names) {
                instance.private(name).listen('.attendance.recorded', reload);
            }

            setLive(instance.connector.connectionStatus() === 'connected');
            const off = instance.connector.onConnectionChange((status) =>
                setLive(status === 'connected'),
            );

            cleanup = () => {
                off();
                names.forEach((name) => instance.leave(name));
            };
        } catch {
            setLive(false);
            const interval = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    router.reload({ only: props.current });
                }
            }, POLL_MS);
            cleanup = () => clearInterval(interval);
        }

        return () => {
            if (timer) {
                clearTimeout(timer);
            }

            cleanup();
        };
    }, [key]);

    return live;
}
