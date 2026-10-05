import type { InboxNotification } from '@/types/notifications';

type Listener = (notification: InboxNotification) => void;

const listeners = new Set<Listener>();

/** Fan-out for fresh notifications (realtime or polling) to open screens. */
export function onIncomingNotification(listener: Listener): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

export function emitIncomingNotification(
    notification: InboxNotification,
): void {
    listeners.forEach((listener) => listener(notification));
}
