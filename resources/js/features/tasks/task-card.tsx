import type { ReactNode } from 'react';
import { memo } from 'react';
import { PriorityIcon } from '@/components/priority-icon';
import { cn } from '@/lib/utils';
import { AvatarStack } from './avatar-stack';
import { DueBadge } from './due-badge';
import { LabelPill } from './label-pill';
import type { Label, Person, Task } from './types';

type Props = {
    task: Task;
    labels: Label[];
    assignees: Person[];
    today: string;
    /** Extra control in the footer (mobile "Pindahkan"). */
    action?: ReactNode;
    /** Small note next to the key, e.g. "sedang dipindahkan". */
    note?: string;
    size?: 'default' | 'comfortable';
    className?: string;
};

/**
 * Kanban card (docs/DESIGN.md §6): row 1 mono ID + priority, row 2 title
 * (max 2 lines), optional checklist progress, row 3 labels, due date and
 * assignees. Solid surface, never glass.
 */
export const TaskCardContent = memo(function TaskCardContent({
    task,
    labels,
    assignees,
    today,
    action,
    note,
    size = 'default',
    className,
}: Props) {
    const closed =
        task.status_category === 'done' || task.status_category === 'canceled';
    const comfortable = size === 'comfortable';
    const hasFooter =
        labels.length > 0 ||
        task.due_date !== null ||
        assignees.length > 0 ||
        action !== undefined;

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <div className="flex items-center gap-2">
                <span
                    className={cn(
                        'font-mono text-text-subtle',
                        comfortable ? 'text-[13px]' : 'text-[11px]',
                    )}
                >
                    {task.key}
                </span>
                {note && (
                    <span className="truncate text-[11px] text-text-muted">
                        · {note}
                    </span>
                )}
                <PriorityIcon priority={task.priority} className="ml-auto" />
            </div>

            <p
                className={cn(
                    'line-clamp-2 font-medium text-text',
                    comfortable ? 'text-[15px] leading-6' : 'text-[13px]',
                    closed && 'text-text-muted line-through decoration-1',
                )}
            >
                {task.title}
            </p>

            {task.checklist && task.checklist.total > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span>Checklist</span>
                        <span className="tnum">
                            {task.checklist.done}/{task.checklist.total}
                        </span>
                    </div>
                    <div
                        className="h-1 overflow-hidden rounded-full bg-surface-2"
                        role="progressbar"
                        aria-label="Progres checklist"
                        aria-valuemin={0}
                        aria-valuemax={task.checklist.total}
                        aria-valuenow={task.checklist.done}
                    >
                        <div
                            className="h-full rounded-full bg-primary"
                            style={{
                                width: `${(task.checklist.done / task.checklist.total) * 100}%`,
                            }}
                        />
                    </div>
                </div>
            )}

            {hasFooter ? (
                <div className="flex min-w-0 items-center gap-1.5">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                        {labels.slice(0, 2).map((label) => (
                            <LabelPill key={label.id} label={label} />
                        ))}
                        {labels.length > 2 && (
                            <span className="text-[11px] text-text-subtle">
                                +{labels.length - 2}
                            </span>
                        )}
                        {task.due_date && (
                            <DueBadge
                                due={task.due_date}
                                today={today}
                                closed={closed}
                            />
                        )}
                    </div>
                    {assignees.length > 0 && (
                        <AvatarStack
                            people={assignees}
                            size={comfortable ? 'md' : 'sm'}
                        />
                    )}
                    {action}
                </div>
            ) : (
                <p className="text-[11px] text-text-subtle">Belum ditugaskan</p>
            )}
        </div>
    );
});
