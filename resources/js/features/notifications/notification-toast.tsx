import { router } from '@inertiajs/react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { NotificationIcon } from '@/features/notifications/notification-icon';
import { NotificationTitle } from '@/features/notifications/notification-title';
import { open } from '@/routes/inbox';
import type { InboxNotification } from '@/types/notifications';

type Props = {
    notification: InboxNotification;
    onDismiss: () => void;
};

/** Glass toast for an incoming notification (DESIGN.md §6: glass, bottom right). */
export function NotificationToast({ notification, onDismiss }: Props) {
    const openLabel =
        typeof notification.meta.open_label === 'string'
            ? notification.meta.open_label
            : 'Buka';

    return (
        <div
            role="status"
            className="glass flex w-[356px] max-w-[calc(100vw-32px)] items-start gap-3 rounded-lg p-3 shadow-card"
        >
            <NotificationIcon
                icon={notification.icon}
                tone={notification.tone}
            />
            <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13px] leading-5">
                    <NotificationTitle notification={notification} />
                </p>
                {notification.body && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">
                        {notification.body}
                    </p>
                )}
                <div className="mt-2 flex gap-2">
                    <button
                        type="button"
                        className="h-7 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors duration-120 ease-brand hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        onClick={() => {
                            onDismiss();
                            router.visit(open.url(notification.id));
                        }}
                    >
                        {openLabel}
                    </button>
                    <button
                        type="button"
                        className="h-7 rounded-md px-2.5 text-xs font-medium text-text-muted transition-colors duration-120 ease-brand hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        onClick={() => {
                            onDismiss();
                            router.visit('/inbox');
                        }}
                    >
                        Lihat Inbox
                    </button>
                </div>
            </div>
            <button
                type="button"
                aria-label="Tutup notifikasi"
                onClick={onDismiss}
                className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-md text-text-subtle transition-colors duration-120 ease-brand hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
                <X className="size-4" aria-hidden />
            </button>
        </div>
    );
}

export function showNotificationToast(notification: InboxNotification): void {
    toast.custom(
        (id) => (
            <NotificationToast
                notification={notification}
                onDismiss={() => toast.dismiss(id)}
            />
        ),
        { id: `notification-${notification.id}`, duration: 6000 },
    );
}
