import type { UrlMethodPair } from '@inertiajs/core';
import { router } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import InboxNotificationController from '@/actions/App/Http/Controllers/Notifications/InboxNotificationController';
import { onIncomingNotification } from '@/features/notifications/notification-bus';
import { matchesFilters } from '@/features/notifications/utils';
import { inbox as inboxRoute } from '@/routes';
import { open as openRoute } from '@/routes/inbox';
import type {
    InboxCounts,
    InboxFilters,
    InboxNotification,
} from '@/types/notifications';

type Override = Partial<Pick<InboxNotification, 'read_at' | 'archived_at'>> & {
    removed?: boolean;
};

export type InboxState = ReturnType<typeof useInbox>;

const RELOAD_ONLY = ['counts', 'inbox'];

/**
 * Shared data hook for the desktop and mobile Inbox: merges server pages,
 * live notifications and optimistic changes; exposes the mutations.
 */
export function useInbox({
    items,
    counts,
    filters,
}: {
    items: InboxNotification[];
    counts: InboxCounts;
    filters: InboxFilters;
}) {
    const [overrides, setOverrides] = useState<Record<string, Override>>({});
    const [live, setLive] = useState<InboxNotification[]>([]);
    const [changingFilters, setChangingFilters] = useState(false);
    const filterKey = `${filters.tab}|${filters.kind ?? ''}|${filters.archived}`;

    // New filters = new list.
    useEffect(() => {
        setLive([]);
        setOverrides({});
    }, [filterKey]);

    useEffect(
        () =>
            onIncomingNotification((notification) => {
                if (matchesFilters(notification, filters)) {
                    setLive((previous) =>
                        previous.some((item) => item.id === notification.id)
                            ? previous
                            : [notification, ...previous],
                    );
                }

                router.reload({ only: ['counts'] });
            }),
        [filters],
    );

    const list = useMemo(() => {
        const seen = new Set<string>();
        const result: InboxNotification[] = [];

        for (const item of [...live, ...items]) {
            if (seen.has(item.id)) {
                continue;
            }

            seen.add(item.id);
            const override = overrides[item.id];

            if (override?.removed) {
                continue;
            }

            result.push(override ? { ...item, ...override } : item);
        }

        return result;
    }, [live, items, overrides]);

    const mutate = useCallback(
        (
            notification: InboxNotification,
            route: UrlMethodPair,
            patch: Override,
        ) => {
            const previous = overrides[notification.id];

            setOverrides((current) => ({
                ...current,
                [notification.id]: { ...current[notification.id], ...patch },
            }));

            router.visit(route, {
                preserveScroll: true,
                preserveState: true,
                only: RELOAD_ONLY,
                onError: () => {
                    setOverrides((current) => ({
                        ...current,
                        [notification.id]: previous ?? {},
                    }));
                    toast.error('Gagal memperbarui notifikasi. Coba lagi.');
                },
            });
        },
        [overrides],
    );

    const now = () => new Date().toISOString();

    const markRead = useCallback(
        (notification: InboxNotification) => {
            if (!notification.read_at) {
                mutate(
                    notification,
                    InboxNotificationController.read(notification.id),
                    {
                        read_at: now(),
                    },
                );
            }
        },
        [mutate],
    );

    const markUnread = useCallback(
        (notification: InboxNotification) =>
            mutate(
                notification,
                InboxNotificationController.unread(notification.id),
                {
                    read_at: null,
                },
            ),
        [mutate],
    );

    const toggleRead = useCallback(
        (notification: InboxNotification) =>
            notification.read_at
                ? markUnread(notification)
                : markRead(notification),
        [markRead, markUnread],
    );

    const archive = useCallback(
        (notification: InboxNotification) => {
            mutate(
                notification,
                InboxNotificationController.archive(notification.id),
                {
                    archived_at: now(),
                    read_at: notification.read_at ?? now(),
                    removed: !filters.archived,
                },
            );
            toast.success('Notifikasi diarsipkan.', {
                action: {
                    label: 'Urungkan',
                    onClick: () =>
                        mutate(
                            notification,
                            InboxNotificationController.unarchive(
                                notification.id,
                            ),
                            {
                                archived_at: null,
                                removed: false,
                            },
                        ),
                },
            });
        },
        [mutate, filters.archived],
    );

    const unarchive = useCallback(
        (notification: InboxNotification) =>
            mutate(
                notification,
                InboxNotificationController.unarchive(notification.id),
                {
                    archived_at: null,
                    removed: filters.archived,
                },
            ),
        [mutate, filters.archived],
    );

    const markAllRead = useCallback(() => {
        const stamp = now();

        setOverrides((current) => {
            const next = { ...current };

            for (const item of list) {
                if (!item.read_at && !item.archived_at) {
                    next[item.id] = { ...next[item.id], read_at: stamp };
                }
            }

            return next;
        });

        router.visit(InboxNotificationController.readAll(), {
            preserveScroll: true,
            preserveState: true,
            only: RELOAD_ONLY,
        });
    }, [list]);

    /** Marks read on the server and follows the notification's link. */
    const open = useCallback((notification: InboxNotification) => {
        router.visit(openRoute.url(notification.id));
    }, []);

    const setFilters = useCallback(
        (next: Partial<InboxFilters>) => {
            const merged = { ...filters, ...next };
            const query: Record<string, string> = {};

            if (merged.tab !== 'all') {
                query.tab = merged.tab;
            }

            if (merged.kind) {
                query.kind = merged.kind;
            }

            if (merged.archived) {
                query.archived = '1';
            }

            router.visit(inboxRoute.url({ query }), {
                preserveState: true,
                replace: true,
                reset: ['items'],
                onStart: () => setChangingFilters(true),
                onFinish: () => setChangingFilters(false),
            });
        },
        [filters],
    );

    return {
        list,
        counts,
        filters,
        changingFilters,
        markRead,
        markUnread,
        toggleRead,
        archive,
        unarchive,
        markAllRead,
        open,
        setFilters,
    };
}
