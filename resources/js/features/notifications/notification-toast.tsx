import { router } from '@inertiajs/react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { NotificationIcon } from '@/features/notifications/notification-icon';
import { NotificationTitle } from '@/features/notifications/notification-title';
import { cn, focusRing } from '@/lib/utils';
import { open } from '@/routes/inbox';
import type { InboxNotification } from '@/types/notifications';

type Props = {
    notification: InboxNotification;
    onDismiss: () => void;
};

/** Translucent pill button on the inverse toast (Komponen "Urungkan"). */
const pill = cn(
    'inline-flex h-9 items-center rounded-[10px] px-3 text-[15px] font-bold transition-colors duration-120 ease-brand',
    focusRing,
);

/**
 * Toast for an incoming realtime notification: the inverse chip of the
 * design (Komponen toast: radius 18, `shadow-inverse`) with the tinted
 * notification tile, title, one line of body and "Buka" / "Lihat Inbox".
 */
export function NotificationToast({ notification, onDismiss }: Props) {
    const openLabel =
        typeof notification.meta.open_label === 'string'
            ? notification.meta.open_label
            : 'Buka';

    return (
        <div
            role="status"
            className="flex w-[380px] max-w-[calc(100vw-32px)] items-start gap-3.5 rounded-[18px] bg-inverse px-[18px] py-4 text-on-inverse shadow-inverse"
        >
            <NotificationIcon
                icon={notification.icon}
                tone={notification.tone}
                size="sm"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="line-clamp-2 text-[16px] leading-[22px] font-semibold">
                    <NotificationTitle notification={notification} />
                </p>
                {notification.body && (
                    <p className="line-clamp-2 text-meta text-on-inverse/75">
                        {notification.body}
                    </p>
                )}
                <div className="flex gap-2 pt-1.5">
                    <button
                        type="button"
                        className={cn(
                            pill,
                            'bg-on-inverse/12 hover:bg-on-inverse/20',
                        )}
                        onClick={() => {
                            onDismiss();
                            router.visit(open.url(notification.id));
                        }}
                    >
                        {openLabel}
                    </button>
                    <button
                        type="button"
                        className={cn(
                            pill,
                            'text-on-inverse/75 hover:bg-on-inverse/12 hover:text-on-inverse',
                        )}
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
                className={cn(
                    '-m-1.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] text-on-inverse/60 transition-colors duration-120 ease-brand hover:bg-on-inverse/12 hover:text-on-inverse',
                    focusRing,
                )}
            >
                <X className="size-[18px]" aria-hidden />
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
