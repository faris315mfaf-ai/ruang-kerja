import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import type { TaskSummary } from '@/types/dashboard';
import { PanelEmpty } from './panel';

/** "Tugas terlambat": key, title, days late (mockup Main). */
export function OverdueList({
    items,
    className,
}: {
    items: TaskSummary[];
    className?: string;
}) {
    if (items.length === 0) {
        return <PanelEmpty>Tidak ada tugas terlambat.</PanelEmpty>;
    }

    return (
        <ul className={cn('divide-y divide-border', className)}>
            {items.map((task) => (
                <li key={task.id}>
                    <Link
                        href={task.url}
                        className="flex min-h-11 items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                    >
                        <span className="w-16 shrink-0 font-mono text-xs text-text-muted">
                            {task.key}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-text">
                            {task.title}
                            {task.assignees.length > 0 && (
                                <span className="text-text-muted">
                                    {' '}
                                    ·{' '}
                                    {task.assignees
                                        .map((person) => person.name)
                                        .join(', ')}
                                </span>
                            )}
                        </span>
                        <span className="shrink-0 text-[13px] text-danger tnum">
                            {task.days_late} hari
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
