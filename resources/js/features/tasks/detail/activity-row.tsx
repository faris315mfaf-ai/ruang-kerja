import { UserAvatar } from '@/components/shell/user-avatar';
import { StatusIcon } from '@/components/status-icon';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { StatusCategory } from '../types';
import { describeTaskActivity } from './timeline';
import type { TaskActivity } from './types';

function category(value: unknown): StatusCategory | null {
    return typeof value === 'object' && value !== null && 'category' in value
        ? ((value as { category: StatusCategory }).category ?? null)
        : null;
}

/** "Dimas Pratama mengubah status ○ Todo → ◐ Sedang dikerjakan · 2 hari lalu". */
export function ActivityRow({
    item,
    names,
}: {
    item: TaskActivity;
    names: Record<string, string>;
}) {
    const to =
        item.event === 'task.status_changed'
            ? category(item.properties.to)
            : null;

    return (
        <div className="flex items-start gap-3 py-1 pl-2 text-[15px] text-text-muted">
            {item.causer ? (
                <UserAvatar
                    name={item.causer.name}
                    src={item.causer.avatar}
                    className="size-6 text-[10px]"
                />
            ) : (
                <span className="size-6 shrink-0" />
            )}
            <p className="min-w-0 flex-1">
                <span className="font-semibold text-text">
                    {item.causer?.name ?? 'Sistem'}
                </span>{' '}
                {to && (
                    <StatusIcon
                        category={to}
                        className="mr-1 inline size-4 align-[-3px]"
                    />
                )}
                {describeTaskActivity(item, names)}
                {' · '}
                <time
                    dateTime={item.created_at}
                    title={formatDateTime(item.created_at)}
                >
                    {formatRelative(item.created_at)}
                </time>
            </p>
        </div>
    );
}
