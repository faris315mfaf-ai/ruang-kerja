import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
import { fromBroadcast } from '@/features/notifications/utils';
import { requestJson } from '@/lib/http';
import { feed } from '@/routes/inbox';
import type {
    BroadcastedNotification,
    InboxNotification,
    NotificationFeed,
} from '@/types/notifications';

export type NotificationsChannelMode = 'idle' | 'realtime' | 'polling';

export const POLL_INTERVAL_MS = 30_000;

type Options = {
    userId: string | null | undefined;
    /** Called once per new notification (realtime or polling). */
    onNotification: (notification: InboxNotification) => void;
    /** Absolute unread count from the polling feed. */
    onUnreadCount?: (count: number) => void;
    pollInterval?: number;
};

/**
 * Subscribes to the signed-in user's private channel
 * (`private-App.Models.User.{id}`, BaseNotification broadcasts). When Echo
 * is not configured, cannot connect or drops the connection, it falls back
 * to polling `GET /inbox/feed` every 30 s while the tab is visible, and
 * switches back as soon as the socket is connected again.
 */
export function useNotificationsChannel({
    userId,
    onNotification,
    onUnreadCount,
    pollInterval = POLL_INTERVAL_MS,
}: Options): NotificationsChannelMode {
    const [mode, setMode] = useState<NotificationsChannelMode>('idle');
    const callbacks = useRef({ onNotification, onUnreadCount });

    useEffect(() => {
        callbacks.current = { onNotification, onUnreadCount };
    });

    // Realtime subscription.
    useEffect(() => {
        if (!userId) {
            setMode('idle');

            return;
        }

        const seen = seenIds();
        const channelName = `App.Models.User.${userId}`;
        let cleanup = () => {};

        try {
            if (!echoIsConfigured()) {
                throw new Error('Echo is not configured');
            }

            const instance = echo();

            instance
                .private(channelName)
                .notification((payload: BroadcastedNotification) => {
                    if (seen.add(payload.id)) {
                        callbacks.current.onNotification(
                            fromBroadcast(payload),
                        );
                    }
                });

            const status = instance.connector.connectionStatus();
            setMode(status === 'connected' ? 'realtime' : 'polling');

            const offStatus = instance.connector.onConnectionChange((next) =>
                setMode(next === 'connected' ? 'realtime' : 'polling'),
            );

            cleanup = () => {
                offStatus();
                instance.leave(channelName);
            };
        } catch {
            // No key / no WebSocket support / Reverb down: poll instead.
            setMode('polling');
        }

        return () => cleanup();
    }, [userId]);

    // Polling fallback.
    useEffect(() => {
        if (mode !== 'polling' || !userId) {
            return;
        }

        const seen = seenIds();
        const controller = new AbortController();
        let cursor: string | null = null;

        const poll = async () => {
            if (
                typeof document !== 'undefined' &&
                document.visibilityState === 'hidden'
            ) {
                return;
            }

            try {
                const data = await requestJson<NotificationFeed>(
                    feed.url(cursor ? { query: { after: cursor } } : undefined),
                    { signal: controller.signal },
                );

                // First response only sets the cursor (no toasts for old items).
                if (cursor !== null) {
                    [...data.notifications]
                        .reverse()
                        .filter((notification) => seen.add(notification.id))
                        .forEach((notification) =>
                            callbacks.current.onNotification(notification),
                        );
                }

                cursor = data.server_time;
                callbacks.current.onUnreadCount?.(data.unread);
            } catch {
                // Offline or signed out: try again on the next tick.
            }
        };

        void poll();
        const timer = window.setInterval(() => void poll(), pollInterval);
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                void poll();
            }
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            controller.abort();
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [mode, userId, pollInterval]);

    return mode;
}

/** Shared de-duplication across realtime and polling deliveries. */
const delivered = new Set<string>();

function seenIds() {
    return {
        add(id: string): boolean {
            if (delivered.has(id)) {
                return false;
            }

            delivered.add(id);

            if (delivered.size > 200) {
                const first = delivered.values().next().value;

                if (first !== undefined) {
                    delivered.delete(first);
                }
            }

            return true;
        },
    };
}

/** Test helper. */
export function resetDeliveredNotifications(): void {
    delivered.clear();
}
