import { usePage } from '@inertiajs/react';
import { useSyncExternalStore } from 'react';

/**
 * Live unread counter. The server value (shared prop `inbox.unread`) is the
 * source of truth; realtime/polling updates are layered on top until the
 * next Inertia response brings a different server value.
 */
type Live = { value: number; base: number };

let live: Live | null = null;
const listeners = new Set<() => void>();

function emit(): void {
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

function snapshot(): Live | null {
    return live;
}

function resolve(server: number): number {
    return live !== null && live.base === server ? live.value : server;
}

/** Set an absolute count (polling feed / JSON responses). */
export function setUnreadCount(value: number, server: number): void {
    live = { value: Math.max(0, value), base: server };
    emit();
}

/** A new notification arrived in realtime. */
export function incrementUnread(server: number): void {
    setUnreadCount(resolve(server) + 1, server);
}

/** Test helper. */
export function resetUnreadStore(): void {
    live = null;
    emit();
}

export function useUnreadCount(): number {
    const { inbox } = usePage().props;
    const server = inbox?.unread ?? 0;
    const current = useSyncExternalStore(subscribe, snapshot, () => null);

    return current !== null && current.base === server ? current.value : server;
}
