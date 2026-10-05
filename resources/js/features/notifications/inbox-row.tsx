import type { ReactNode } from 'react';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { NotificationIcon } from '@/features/notifications/notification-icon';
import { NotificationTitle } from '@/features/notifications/notification-title';
import { ActionBadge, ContextText } from '@/features/notifications/inbox-parts';
import type { InboxNotification } from '@/types/notifications';

type Props = {
    notification: InboxNotification;
    selected?: boolean;
    variant: 'desktop' | 'mobile';
    onClick: () => void;
};

function Quote({ notification }: { notification: InboxNotification }) {
    if (!notification.body) {
        return null;
    }

    const quoted = notification.meta.quote === true;

    return <>{quoted ? `“${notification.body}”` : notification.body}</>;
}

function joinParts(parts: (ReactNode | null)[]): ReactNode[] {
    return parts
        .filter((part): part is ReactNode => part !== null)
        .flatMap((part, index) => (index === 0 ? [part] : [' · ', part]));
}

/** One Inbox row: tinted icon, title, body/subject lines, time, unread dot. */
export function InboxRow({
    notification,
    selected = false,
    variant,
    onClick,
}: Props) {
    const unread = notification.read_at === null;
    const mobile = variant === 'mobile';
    const subject = notification.subject;

    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={selected ? 'true' : undefined}
            data-notification-id={notification.id}
            className={cn(
                'flex w-full items-start gap-3 text-left transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                mobile
                    ? 'min-h-14 px-4 py-3.5'
                    : 'rounded-md border-l-2 px-3 py-3 hover:bg-surface-2',
                !mobile &&
                    (selected
                        ? 'border-primary bg-surface-2'
                        : 'border-transparent'),
            )}
        >
            <NotificationIcon
                icon={notification.icon}
                tone={notification.tone}
                className={mobile ? 'size-11 [&>svg]:size-5' : undefined}
            />
            <span className="min-w-0 flex-1">
                <span
                    className={cn(
                        'block',
                        mobile
                            ? 'line-clamp-1 text-[15px] leading-6'
                            : 'line-clamp-2 text-[13px] leading-5',
                    )}
                >
                    <NotificationTitle
                        notification={notification}
                        className={unread ? 'text-text' : undefined}
                    />
                </span>
                {mobile ? (
                    <span className="line-clamp-1 text-sm text-text-muted">
                        {joinParts([
                            subject?.code ? (
                                <span key="code" className="font-mono">
                                    {subject.code}
                                </span>
                            ) : null,
                            notification.meta.context ? (
                                <ContextText
                                    key="context"
                                    notification={notification}
                                />
                            ) : null,
                            notification.body ? (
                                <Quote key="body" notification={notification} />
                            ) : (
                                (subject?.title ?? null)
                            ),
                        ])}
                    </span>
                ) : (
                    <>
                        {notification.body && (
                            <span className="mt-0.5 block truncate text-[13px] text-text-muted">
                                <Quote notification={notification} />
                            </span>
                        )}
                        {(subject?.code ||
                            subject?.title ||
                            notification.meta.context) && (
                            <span className="mt-0.5 block truncate text-xs text-text-muted">
                                {subject?.code && (
                                    <span className="font-mono">
                                        {subject.code}
                                    </span>
                                )}
                                {subject?.code && subject.title && ' · '}
                                {subject?.title}
                                {notification.meta.context && (
                                    <>
                                        {(subject?.code || subject?.title) &&
                                            ' · '}
                                        <ContextText
                                            notification={notification}
                                        />
                                    </>
                                )}
                            </span>
                        )}
                    </>
                )}
                {notification.action_required && (
                    <span className="mt-1.5 block">
                        <ActionBadge />
                    </span>
                )}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                <time
                    dateTime={notification.created_at ?? undefined}
                    className={cn(
                        'font-mono text-text-muted',
                        mobile ? 'text-sm' : 'text-xs',
                    )}
                >
                    {formatTime(notification.created_at)}
                </time>
                {unread && (
                    <span className="size-2 rounded-full bg-primary">
                        <span className="sr-only">Belum dibaca</span>
                    </span>
                )}
            </span>
        </button>
    );
}
