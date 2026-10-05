import { titleSegments } from '@/features/notifications/utils';
import { cn } from '@/lib/utils';
import type { InboxNotification } from '@/types/notifications';

type Props = {
    notification: Pick<InboxNotification, 'title' | 'actor' | 'subject'>;
    className?: string;
};

/**
 * Title with the actor's name and subject code emphasised. Inherits colour
 * and weight from the row (bold while unread, DInbox).
 */
export function NotificationTitle({ notification, className }: Props) {
    const segments = titleSegments(notification.title, [
        notification.actor?.name,
        notification.subject?.code,
    ]);

    return (
        <span className={cn(className)}>
            {segments.map((segment, index) =>
                segment.strong ? (
                    <strong key={index} className="font-bold">
                        {segment.text}
                    </strong>
                ) : (
                    <span key={index}>{segment.text}</span>
                ),
            )}
        </span>
    );
}
