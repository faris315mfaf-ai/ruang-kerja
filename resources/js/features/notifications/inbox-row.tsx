import type { ReactNode } from 'react';
import { ActionBadge, ContextText } from '@/features/notifications/inbox-parts';
import { NotificationIcon } from '@/features/notifications/notification-icon';
import { NotificationTitle } from '@/features/notifications/notification-title';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { InboxNotification } from '@/types/notifications';

type Props = {
    notification: InboxNotification;
    selected?: boolean;
    variant: 'desktop' | 'mobile';
    onClick: () => void;
};

function joinParts(parts: (ReactNode | null)[]): ReactNode[] {
    return parts
        .filter((part): part is ReactNode => part !== null)
        .flatMap((part, index) => (index === 0 ? [part] : [' · ', part]));
}

/** "PLQ-15 · lewat 1 hari · “isi pesan”" (subject title when there is no body). */
function summaryParts(notification: InboxNotification): (ReactNode | null)[] {
    const { subject, body } = notification;
    const quoted = notification.meta.quote === true;

    return [
        subject?.code ? (
            <span key="code" className="font-mono font-semibold">
                {subject.code}
            </span>
        ) : null,
        notification.meta.context ? (
            <ContextText key="context" notification={notification} />
        ) : null,
        body ? (quoted ? `“${body}”` : body) : (subject?.title ?? null),
    ];
}

/** Gradient unread dot (DInbox / MInbox). */
function UnreadDot({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                'shrink-0 rounded-full bg-primary bg-grad-merek',
                className,
            )}
        >
            <span className="sr-only">Belum dibaca</span>
        </span>
    );
}

/**
 * One Inbox row: 44px tinted tile, title (bold while unread), one summary
 * line, time and the gradient unread dot. Desktop = DInbox list row
 * (selected: teal inset ring), mobile = MInbox row (time in the meta line).
 */
export function InboxRow({
    notification,
    selected = false,
    variant,
    onClick,
}: Props) {
    const unread = notification.read_at === null;
    const mobile = variant === 'mobile';
    const time = (
        <time
            key="time"
            dateTime={notification.created_at ?? undefined}
            className="tnum"
        >
            {formatTime(notification.created_at)}
        </time>
    );

    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={selected ? 'true' : undefined}
            data-notification-id={notification.id}
            className={cn(
                'flex w-full items-start text-left text-text transition-colors duration-120 ease-brand focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                mobile
                    ? 'min-h-[76px] gap-3 bg-surface p-4 active:bg-surface-2'
                    : 'gap-3.5 px-[22px] py-[18px]',
                !mobile &&
                    (selected
                        ? 'bg-link-soft/60 ring-2 ring-primary ring-inset'
                        : 'hover:bg-surface-2/60'),
            )}
        >
            <NotificationIcon
                icon={notification.icon}
                tone={notification.tone}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                    className={cn(
                        'line-clamp-2 leading-[23px]',
                        mobile ? 'text-[17px]' : 'text-[16px]',
                        unread ? 'font-bold' : 'font-medium',
                    )}
                >
                    <NotificationTitle notification={notification} />
                </span>
                <span className="truncate text-[15px] leading-[22px] text-text-muted">
                    {joinParts(
                        mobile
                            ? [time, ...summaryParts(notification)]
                            : summaryParts(notification),
                    )}
                </span>
                {notification.action_required && (
                    <span className="pt-1">
                        <ActionBadge />
                    </span>
                )}
            </span>
            {mobile ? (
                unread && <UnreadDot className="mt-1.5 size-[11px]" />
            ) : (
                <span className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-meta text-text-muted">{time}</span>
                    {unread && <UnreadDot className="size-2.5" />}
                </span>
            )}
        </button>
    );
}
