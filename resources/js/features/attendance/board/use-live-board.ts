import { router, usePage } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
import { attendanceChannelNames } from '@/lib/attendance';

export type LiveMode = 'realtime' | 'polling';

export const BOARD_POLL_MS = 60_000;

/** Props refreshed by realtime events and polling. */
export const BOARD_PROPS = ['board', 'suspicious', 'missingCheckOut'];

type Channels = { company: boolean; divisions: string[] };

/**
 * Live "Absensi hari ini": listens to `attendance.recorded` on
 * `company.{companyId}.attendance` (HR/Direksi; company id from the shared
 * `auth.user` prop) or `division.{id}.attendance` (Kadiv) and
 * reloads the board props (debounced). Falls back to polling every 60 s while
 * the socket is not connected and the tab is visible.
 */
export function useLiveBoard(channels: Channels): LiveMode {
    const [mode, setMode] = useState<LiveMode>('polling');
    const pending = useRef<number | null>(null);
    const { auth } = usePage().props;
    const names = attendanceChannelNames(
        channels,
        auth.user?.company?.id ?? auth.user?.company_id,
    );
    const key = names.join('|');

    useEffect(() => {
        const reload = () => {
            if (pending.current !== null) {
                return;
            }

            pending.current = window.setTimeout(() => {
                pending.current = null;
                router.reload({ only: BOARD_PROPS });
            }, 1_500);
        };

        if (key === '') {
            return;
        }

        let cleanup = () => {};

        try {
            if (!echoIsConfigured()) {
                throw new Error('Echo is not configured');
            }

            const instance = echo();
            const list = key.split('|');

            list.forEach((name) =>
                instance.private(name).listen('.attendance.recorded', reload),
            );
            setMode(
                instance.connector.connectionStatus() === 'connected'
                    ? 'realtime'
                    : 'polling',
            );
            const offStatus = instance.connector.onConnectionChange((next) =>
                setMode(next === 'connected' ? 'realtime' : 'polling'),
            );

            cleanup = () => {
                offStatus();
                list.forEach((name) => instance.leave(name));
            };
        } catch {
            setMode('polling');
        }

        return () => {
            cleanup();

            if (pending.current !== null) {
                window.clearTimeout(pending.current);
                pending.current = null;
            }
        };
    }, [key]);

    useEffect(() => {
        if (mode !== 'polling') {
            return;
        }

        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                router.reload({ only: BOARD_PROPS });
            }
        }, BOARD_POLL_MS);

        return () => window.clearInterval(timer);
    }, [mode]);

    return mode;
}
