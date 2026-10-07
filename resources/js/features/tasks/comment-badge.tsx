import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskCommentBadge } from './types';

/** "3 komentar", "3 komentar, ada komentar baru" (screen readers, title). */
export function commentBadgeLabel(comments: TaskCommentBadge): string {
    return `${comments.count} komentar${comments.unread ? ', ada komentar baru' : ''}`;
}

/**
 * Comment count of a card or list row with a dot while someone else's
 * comment is still unread for the viewer (BoardTasks::withCommentState()).
 * Renders nothing without comments or when the payload has no badge.
 */
export function CommentBadge({
    comments,
    className,
}: {
    comments: TaskCommentBadge | undefined;
    className?: string;
}) {
    if (!comments || comments.count === 0) {
        return null;
    }

    const label = commentBadgeLabel(comments);

    return (
        <span
            title={label}
            className={cn(
                'inline-flex shrink-0 items-center gap-1 text-[14px] tnum',
                comments.unread
                    ? 'font-semibold text-text'
                    : 'font-medium text-text-muted',
                className,
            )}
        >
            <span className="relative inline-flex" aria-hidden>
                <MessageSquare className="size-4" />
                {comments.unread && (
                    <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-surface dark:ring-surface-2" />
                )}
            </span>
            <span aria-hidden>{comments.count}</span>
            <span className="sr-only">{label}</span>
        </span>
    );
}
