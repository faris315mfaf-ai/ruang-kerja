import { titleSegments } from '@/features/notifications/utils';
import { cn } from '@/lib/utils';
import type { InboxNotification } from '@/types/notifications';

type Props = {
    notification: Pick<InboxNotification, 'title' | 'actor' | 'subject'>;
    className?: string;
};

/** Title with the actor's name and subject code emphasised (mockup Inbox). */
export function NotificationTitle({ notification, className }: Props) {
    const segments = titleSegments(notification.title, [
        notification.actor?.name,
        notification.subject?.code,
    ]);

    return (
        <span className={cn('text-text-muted', className)}>
            {segments.map((segment, index) =>
                segment.strong ? (
                    <strong key={index} className="font-semibold text-text">
                        {segment.text}
                    </strong>
                ) : (
                    <span key={index}>{segment.text}</span>
                ),
            )}
        </span>
    );
}
