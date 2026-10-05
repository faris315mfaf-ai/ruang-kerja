import { Link } from '@inertiajs/react';
import { CircleCheckBig } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { cn, focusRing } from '@/lib/utils';
import type { TaskSummary } from '@/types/dashboard';

/**
 * "Tugas terlambat" (DBeranda): key chip, title, assignees, days late pill.
 * `compact` drops the key chip (phones).
 */
export function OverdueList({
    items,
    compact = false,
    className,
}: {
    items: TaskSummary[];
    compact?: boolean;
    className?: string;
}) {
    if (items.length === 0) {
        return (
            <div className="px-5 pb-2 md:px-7">
                <EmptyState
                    size="sm"
                    icon={CircleCheckBig}
                    title="Tidak ada tugas terlambat"
                />
            </div>
        );
    }

    return (
        <ul className={cn('divide-y divide-divider', className)}>
            {items.map((task) => (
                <li key={task.id}>
                    <Link
                        href={task.url}
                        prefetch
                        className={cn(
                            'flex min-h-[68px] items-center gap-4 px-5 py-2 transition-colors duration-120 ease-brand hover:bg-background md:px-7',
                            focusRing,
                            'focus-visible:ring-inset',
                        )}
                    >
                        {!compact && (
                            <span className="shrink-0 rounded-sm bg-surface-2 px-2 py-1 font-mono text-[14px] font-semibold">
                                {task.key}
                            </span>
                        )}
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-[17px] font-semibold">
                                {task.title}
                            </span>
                            <span className="truncate text-label font-normal text-text-muted">
                                {compact && (
                                    <span className="font-mono text-[14px] font-semibold">
                                        {task.key} ·{' '}
                                    </span>
                                )}
                                {task.assignees.length > 0
                                    ? task.assignees
                                          .map((person) => person.name)
                                          .join(', ')
                                    : 'Belum ada penanggung jawab'}
                            </span>
                        </span>
                        <Badge
                            variant="status"
                            tone="danger"
                            className="h-[30px]"
                        >
                            {task.days_late} hari
                            <span className="sr-only"> terlambat</span>
                        </Badge>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
