import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type {
    PresenceAction,
    PresenceMember,
    PresenceState,
    TaskPresenceMap,
    TypingField,
    ViewingWhisper,
} from './board-presence';
import {
    EMPTY_PRESENCE,
    EMPTY_TASK_PRESENCE,
    HEARTBEAT_MS,
    TYPING_THROTTLE_MS,
    nextExpiry,
    presenceReducer,
    selectTaskPresence,
} from './board-presence';

/*
 * Echo side of the board presence (logic in board-presence.ts). One
 * `presence-workspace.{id}` subscription per workspace and browser tab,
 * shared by the board and an open task detail; left when the last user
 * unmounts. Without Echo/Reverb nothing is joined and nothing is shown.
 */

type Channel = {
    here(callback: (members: PresenceMember[]) => void): Channel;
    joining(callback: (member: PresenceMember) => void): Channel;
    leaving(callback: (member: PresenceMember) => void): Channel;
    listenForWhisper(
        event: string,
        callback: (payload: never, meta?: { user_id?: string }) => void,
    ): Channel;
    whisper(event: string, payload: object): Channel;
};

type Publisher = {
    /** Random per open detail: several details/tabs of one person are separate sessions. */
    tab: string;
    taskId: string;
    heartbeat: number | undefined;
    lastTyping: number;
};

type Store = {
    name: string;
    users: number;
    state: PresenceState;
    viewerId: string | null;
    snapshot: TaskPresenceMap;
    listeners: Set<() => void>;
    channel: Channel | null;
    subscribed: boolean;
    publishers: Set<Publisher>;
    /** Pending answer to a `sync` whisper. */
    syncTimer: number | undefined;
    expiry: number | undefined;
    stopConnection: (() => void) | undefined;
};

const WHISPER = 'viewing';
/**
 * Sent by a fresh subscriber: everyone with a task open answers with their
 * `viewing` whisper. Covers a second tab of someone already in the channel,
 * for whom the presence `joining` event does not fire.
 */
const SYNC = 'sync';
const stores = new Map<string, Store>();

function emit(store: Store): void {
    store.snapshot = selectTaskPresence(
        store.state,
        store.viewerId,
        store.snapshot,
    );
    store.listeners.forEach((listener) => listener());
}

function scheduleExpiry(store: Store): void {
    window.clearTimeout(store.expiry);
    store.expiry = undefined;
    const at = nextExpiry(store.state);

    if (at !== null) {
        store.expiry = window.setTimeout(
            () => dispatch(store, { type: 'tick', now: Date.now() }),
            Math.max(250, at - Date.now() + 50),
        );
    }
}

function dispatch(store: Store, action: PresenceAction): void {
    const next = presenceReducer(store.state, action);

    if (action.type === 'tick' || next !== store.state) {
        store.state = next;
        scheduleExpiry(store);
        emit(store);
    }
}

function send(
    store: Store,
    publisher: Publisher,
    taskId: string | null,
    typing: TypingField | null = null,
): void {
    if (!store.channel || !store.subscribed) {
        return;
    }

    try {
        store.channel.whisper(WHISPER, {
            user_id: store.viewerId ?? undefined,
            tab: publisher.tab,
            task_id: taskId,
            typing,
        });
    } catch {
        // Connection dropped: the next heartbeat or `here` republishes.
    }
}

function republishAll(store: Store): void {
    store.publishers.forEach((publisher) =>
        send(store, publisher, publisher.taskId),
    );
}

function subscribe(store: Store, workspaceId: string): void {
    if (!echoIsConfigured()) {
        return;
    }

    try {
        const instance = echo();
        const channel = instance.join(store.name) as unknown as Channel;
        store.channel = channel
            .here((members) => {
                store.subscribed = true;
                dispatch(store, { type: 'here', members, now: Date.now() });
                republishAll(store);

                try {
                    channel.whisper(SYNC, {});
                } catch {
                    // Heartbeats fill the board in within HEARTBEAT_MS.
                }
            })
            .joining((member) => dispatch(store, { type: 'joining', member }))
            .leaving((member) => dispatch(store, { type: 'leaving', member }))
            .listenForWhisper(SYNC, () => {
                if (store.publishers.size === 0 || store.syncTimer) {
                    return;
                }

                // Small jitter so a whole board does not answer at once.
                store.syncTimer = window.setTimeout(
                    () => {
                        store.syncTimer = undefined;
                        republishAll(store);
                    },
                    100 + Math.random() * 400,
                );
            })
            .listenForWhisper(WHISPER, (payload: ViewingWhisper, meta) =>
                dispatch(store, {
                    type: 'whisper',
                    userId:
                        typeof meta?.user_id === 'string' ? meta.user_id : null,
                    payload,
                    now: Date.now(),
                }),
            );

        // Offline or reconnecting: hide every indicator until `here` again.
        store.stopConnection = instance.connector.onConnectionChange(
            (status) => {
                if (status !== 'connected') {
                    store.subscribed = false;
                    dispatch(store, { type: 'reset' });
                }
            },
        );
    } catch {
        store.channel = null;
        stores.delete(workspaceId);
    }
}

function acquire(workspaceId: string): Store {
    let store = stores.get(workspaceId);

    if (!store) {
        store = {
            name: `workspace.${workspaceId}`,
            users: 0,
            state: EMPTY_PRESENCE,
            viewerId: null,
            snapshot: EMPTY_TASK_PRESENCE,
            listeners: new Set(),
            channel: null,
            subscribed: false,
            publishers: new Set(),
            syncTimer: undefined,
            expiry: undefined,
            stopConnection: undefined,
        };
        stores.set(workspaceId, store);
        subscribe(store, workspaceId);
    }

    store.users++;

    return store;
}

function release(workspaceId: string, store: Store): void {
    store.users--;

    if (store.users > 0 || stores.get(workspaceId) !== store) {
        return;
    }

    stores.delete(workspaceId);
    window.clearTimeout(store.expiry);
    window.clearTimeout(store.syncTimer);
    store.stopConnection?.();

    try {
        // Not echo().leave(): that would also drop private-workspace.{id}.
        if (store.channel && echoIsConfigured()) {
            echo().leaveChannel(`presence-${store.name}`);
        }
    } catch {
        // Already disconnected.
    }
}

/**
 * Presence per task of the workspace for the board (other people only).
 * Pass `enabled: false` for personal workspaces (only the owner can join).
 */
export function useWorkspacePresence(
    workspaceId: string | null | undefined,
    viewerId: string | null | undefined,
    enabled = true,
): TaskPresenceMap {
    const id = enabled && workspaceId ? workspaceId : null;

    useEffect(() => {
        if (!id) {
            return;
        }

        const store = acquire(id);

        return () => release(id, store);
    }, [id]);

    const subscribeTo = useCallback(
        (listener: () => void) => {
            const store = id ? stores.get(id) : undefined;

            if (!store) {
                return () => {};
            }

            store.listeners.add(listener);

            return () => {
                store.listeners.delete(listener);
            };
        },
        [id],
    );

    return useSyncExternalStore(
        subscribeTo,
        () => {
            const store = id ? stores.get(id) : undefined;

            if (!store) {
                return EMPTY_TASK_PRESENCE;
            }

            if (store.viewerId !== (viewerId ?? null)) {
                store.viewerId = viewerId ?? null;
                store.snapshot = selectTaskPresence(
                    store.state,
                    store.viewerId,
                );
            }

            return store.snapshot;
        },
        () => EMPTY_TASK_PRESENCE,
    );
}

/**
 * Announces "I have this task open" on the workspace presence channel while
 * mounted (task sheet, full-screen detail), with a heartbeat so boards drop
 * the entry if this tab disappears without saying goodbye.
 */
export function usePublishTaskViewing(
    workspaceId: string | null | undefined,
    taskId: string | null | undefined,
    viewerId: string | null | undefined,
    enabled = true,
): void {
    useEffect(() => {
        if (!enabled || !workspaceId || !taskId || !echoIsConfigured()) {
            return;
        }

        const store = acquire(workspaceId);
        store.viewerId ??= viewerId ?? null;
        const publisher: Publisher = {
            tab: Math.random().toString(36).slice(2, 12),
            taskId,
            heartbeat: undefined,
            lastTyping: 0,
        };
        store.publishers.add(publisher);
        send(store, publisher, taskId);
        publisher.heartbeat = window.setInterval(
            () => send(store, publisher, taskId),
            HEARTBEAT_MS,
        );
        // Closing the tab: say goodbye now instead of waiting for STALE_MS
        // (the presence `leaving` only fires for a person's last tab).
        const goodbye = () => send(store, publisher, null);
        window.addEventListener('pagehide', goodbye);

        return () => {
            window.removeEventListener('pagehide', goodbye);
            window.clearInterval(publisher.heartbeat);
            store.publishers.delete(publisher);
            send(store, publisher, null);
            release(workspaceId, store);
        };
    }, [enabled, workspaceId, taskId, viewerId]);
}

/**
 * Typing in the description or a comment of an open task: boards show
 * "sedang diedit oleh …". Best effort and throttled; does nothing unless the
 * task is published by usePublishTaskViewing (e.g. not in Inbox previews).
 */
export function signalTaskTyping(taskId: string, field: TypingField): void {
    const now = Date.now();

    stores.forEach((store) => {
        store.publishers.forEach((publisher) => {
            if (
                publisher.taskId === taskId &&
                now - publisher.lastTyping >= TYPING_THROTTLE_MS
            ) {
                publisher.lastTyping = now;
                send(store, publisher, taskId, field);
            }
        });
    });
}
