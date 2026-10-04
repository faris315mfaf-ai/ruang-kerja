import { usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { useNotificationsChannel } from '@/hooks/use-notifications-channel';
import { emitIncomingNotification } from '@/features/notifications/notification-bus';
import { showNotificationToast } from '@/features/notifications/notification-toast';
import {
    incrementUnread,
    setUnreadCount,
} from '@/features/notifications/unread-store';

/**
 * Mounted once in AppLayout: keeps the bell counter live, shows a toast for
 * each new notification and tells open screens (Inbox) about it.
 */
export function NotificationListener() {
    const { auth, inbox } = usePage().props;
    const unread = inbox?.unread ?? 0;
    const server = useRef(unread);

    useEffect(() => {
        server.current = unread;
    }, [unread]);

    useNotificationsChannel({
        userId: auth.user?.id,
        onNotification: (notification) => {
            incrementUnread(server.current);
            emitIncomingNotification(notification);
            showNotificationToast(notification);
        },
        onUnreadCount: (count) => setUnreadCount(count, server.current),
    });

    return null;
}
