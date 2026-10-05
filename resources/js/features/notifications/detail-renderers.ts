import type { ComponentType } from 'react';
import type { InboxNotification } from '@/types/notifications';

export type NotificationDetailProps = { notification: InboxNotification };

/**
 * Extension point for the desktop Inbox detail pane. A module registers a
 * richer preview for its notification types, e.g. in features/tasks:
 *
 *     registerNotificationDetail('task.', TaskNotificationPreview);
 *     registerNotificationDetail('mention', TaskNotificationPreview);
 *
 * Keys match the full type or a prefix ending in "."; the longest key wins.
 * Without a renderer the pane shows the generic payload (title, body, subject).
 */
const renderers = new Map<string, ComponentType<NotificationDetailProps>>();

export function registerNotificationDetail(
    typeOrPrefix: string,
    component: ComponentType<NotificationDetailProps>,
): void {
    renderers.set(typeOrPrefix, component);
}

export function notificationDetailRenderer(
    type: string,
): ComponentType<NotificationDetailProps> | null {
    let best: {
        key: string;
        component: ComponentType<NotificationDetailProps>;
    } | null = null;

    for (const [key, component] of renderers) {
        const matches = key.endsWith('.') ? type.startsWith(key) : type === key;

        if (matches && (!best || key.length > best.key.length)) {
            best = { key, component };
        }
    }

    return best?.component ?? null;
}
