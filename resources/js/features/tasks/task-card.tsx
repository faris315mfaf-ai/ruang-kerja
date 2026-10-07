import type { ReactNode } from 'react';
import { memo } from 'react';
import { PriorityIcon } from '@/components/priority-icon';
import { cn } from '@/lib/utils';
import { AvatarStack } from './avatar-stack';
import { CommentBadge } from './comment-badge';
import { DueBadge } from './due-badge';
import { dueState, formatCompletion } from './lib/due-date';
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
    className?: string;
};

export function CompletionText({
    completedAt,
    due,
}: {
    completedAt: string;
    due: string | null;
}) {
    const { text, late } = formatCompletion(completedAt, due);

    return (
        <span
            className={cn(
                'text-[14px] font-medium',
                late ? 'text-warning' : 'text-success',
            )}
        >
            {text}
        </span>
    );
}

/**
 * Card surface of the boards (DBoard): radius 18, white on the light board,
 * surface-2 inside the night columns; overdue open tasks get a red outline
 * plus a soft red halo.
 */
export function taskCardClass(task: Task, today: string): string {
    const closed =
        task.status_category === 'done' || task.status_category === 'canceled';
    const late =
        !closed &&
        task.due_date !== null &&
        dueState(task.due_date, today) === 'overdue';

    return cn(
        'rounded-[18px] border bg-surface p-4 text-text shadow-card dark:bg-surface-2 dark:shadow-none',
        late ? 'border-danger/55 ring-[3px] ring-danger/12' : 'border-border',
    );
}

/**
 * Kanban card content (DBoard): mono ID + priority bars, 17px title (max 2
 * lines), optional checklist bar "4/7", then label chips, due date and the
 * assignees. The surrounding card surface comes from the board.
 */
export const TaskCardContent = memo(function TaskCardContent({
    task,
    labels,
    assignees,
    today,
    action,
    note,
    className,
}: Props) {
    const closed =
        task.status_category === 'done' || task.status_category === 'canceled';
    const hasFooter =
        labels.length > 0 ||
        task.due_date !== null ||
        task.completed_at !== null ||
        assignees.length > 0 ||
        (task.comments?.count ?? 0) > 0 ||
        action !== undefined;

    return (
        <div className={cn('flex flex-col gap-3', className)}>
            <div className="flex items-center gap-2">
                <span className="font-mono text-[14px] font-semibold text-text-muted">
                    {task.key}
                </span>
                {note && (
                    <span className="truncate text-meta text-text-muted">
                        · {note}
                    </span>
                )}
                <PriorityIcon priority={task.priority} className="ml-auto" />
            </div>

            <p
                className={cn(
                    'line-clamp-2 text-[17px] leading-6 font-semibold',
                    closed ? 'text-text-muted' : 'text-text',
                )}
            >
                {task.title}
            </p>

            {task.checklist && task.checklist.total > 0 && (
                <div className="flex items-center gap-2.5 text-[14px] text-text-muted">
                    <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2 dark:bg-border"
                        role="progressbar"
                        aria-label="Progres checklist"
                        aria-valuemin={0}
                        aria-valuemax={task.checklist.total}
                        aria-valuenow={task.checklist.done}
                    >
                        <div
                            className="h-full rounded-full bg-grad-merek-x"
                            style={{
                                width: `${(task.checklist.done / task.checklist.total) * 100}%`,
                            }}
                        />
                    </div>
                    <span className="tnum">
                        {task.checklist.done}/{task.checklist.total}
                    </span>
                </div>
            )}

            {hasFooter ? (
                <div className="flex min-w-0 items-center gap-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        {labels.slice(0, 2).map((label) => (
                            <LabelPill key={label.id} label={label} />
                        ))}
                        {labels.length > 2 && (
                            <span className="text-[14px] font-semibold text-text-muted">
                                +{labels.length - 2}
                            </span>
                        )}
                        {closed && task.completed_at ? (
                            <CompletionText
                                completedAt={task.completed_at}
                                due={task.due_date}
                            />
                        ) : (
                            task.due_date && (
                                <DueBadge
                                    due={task.due_date}
                                    today={today}
                                    closed={closed}
                                />
                            )
                        )}
                        <CommentBadge comments={task.comments} />
                    </div>
                    {assignees.length > 0 && (
                        <AvatarStack people={assignees} size="lg" />
                    )}
                    {action}
                </div>
            ) : (
                <p className="text-[14px] text-text-muted">Belum ditugaskan</p>
            )}
        </div>
    );
});
