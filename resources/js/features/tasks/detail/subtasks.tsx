import { Plus } from 'lucide-react';
import { useState } from 'react';
import { PriorityIcon } from '@/components/priority-icon';
import { UserAvatar } from '@/components/shell/user-avatar';
import { StatusIcon } from '@/components/status-icon';
import { cn } from '@/lib/utils';
import { formatDayMonth } from '../lib/due-date';
import type { Task, TaskStatus, WorkspaceMember } from '../types';

type Props = {
    subtasks: Task[];
    statuses: TaskStatus[];
    members: WorkspaceMember[];
    editable: boolean;
    mobile?: boolean;
    onOpen: (task: Task) => void;
    onCreate: (title: string) => void;
};

/** Sub-tasks "1/3" with status, key, title, due and assignee (mockup TaskDetail). */
export function SubtasksSection({
    subtasks,
    statuses,
    members,
    editable,
    mobile = false,
    onOpen,
    onCreate,
}: Props) {
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState('');
    const done = subtasks.filter((t) => t.status_category === 'done').length;

    if (subtasks.length === 0 && !editable) {
        return null;
    }

    return (
        <section aria-labelledby="task-subtasks">
            <header
                className={cn(
                    'flex items-center gap-2',
                    mobile ? 'min-h-11' : 'h-9',
                )}
            >
                <h2
                    id="task-subtasks"
                    className={cn(
                        'font-medium text-text',
                        mobile ? 'text-[15px]' : 'text-[13px]',
                    )}
                >
                    Sub-tugas
                </h2>
                {subtasks.length > 0 && (
                    <span className="text-[13px] text-text-muted tnum">
                        {done}/{subtasks.length}
                    </span>
                )}
                {editable && (
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        aria-label="Tambah sub-tugas"
                        className={cn(
                            'ml-auto flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                            mobile ? 'size-11' : 'size-7',
                        )}
                    >
                        <Plus className="size-4" aria-hidden />
                    </button>
                )}
            </header>

            {subtasks.length > 0 && (
                <ul className="overflow-hidden rounded-lg border border-border bg-surface">
                    {subtasks.map((task) => {
                        const status = statuses.find(
                            (s) => s.id === task.status_id,
                        );
                        const assignee = members.find((m) =>
                            task.assignee_ids.includes(m.id),
                        );
                        const closed = task.status_category === 'done';

                        return (
                            <li
                                key={task.id}
                                className="border-b border-border last:border-b-0"
                            >
                                <button
                                    type="button"
                                    onClick={() => onOpen(task)}
                                    className={cn(
                                        'flex w-full items-center gap-3 px-3 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none',
                                        mobile ? 'min-h-14 py-2' : 'h-10',
                                    )}
                                >
                                    <StatusIcon
                                        category={task.status_category}
                                        color={status?.color}
                                        label={status?.name}
                                    />
                                    {!mobile && (
                                        <span className="w-14 shrink-0 font-mono text-xs text-text-muted">
                                            {task.key}
                                        </span>
                                    )}
                                    <span className="min-w-0 flex-1">
                                        <span
                                            className={cn(
                                                'block truncate',
                                                mobile
                                                    ? 'text-[15px]'
                                                    : 'text-[13px]',
                                                closed
                                                    ? 'text-text-muted'
                                                    : 'text-text',
                                            )}
                                        >
                                            {task.title}
                                        </span>
                                        {mobile && (
                                            <span className="block font-mono text-xs text-text-muted">
                                                {task.key}
                                                {task.due_date &&
                                                    ` · ${formatDayMonth(task.due_date)}`}
                                            </span>
                                        )}
                                    </span>
                                    {task.priority !== 0 && (
                                        <PriorityIcon
                                            priority={task.priority}
                                            labelled={false}
                                        />
                                    )}
                                    {!mobile && task.due_date && (
                                        <span className="text-xs text-text-muted">
                                            {closed && task.completed_at
                                                ? `Selesai ${formatDayMonth(task.completed_at.slice(0, 10))}`
                                                : formatDayMonth(task.due_date)}
                                        </span>
                                    )}
                                    {assignee && (
                                        <UserAvatar
                                            name={assignee.name}
                                            src={assignee.avatar}
                                            className="size-5 text-[9px]"
                                        />
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {editable && adding && (
                <form
                    className="mt-2 flex items-center gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const title = draft.trim();

                        if (title !== '') {
                            onCreate(title);
                            setDraft('');
                        }
                    }}
                >
                    <input
                        // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by the "+" button
                        autoFocus
                        aria-label="Judul sub-tugas"
                        placeholder="Judul sub-tugas, lalu Enter"
                        value={draft}
                        maxLength={255}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                event.stopPropagation();
                                setAdding(false);
                            }
                        }}
                        onBlur={() => draft.trim() === '' && setAdding(false)}
                        className={cn(
                            'min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-text placeholder:text-text-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                            mobile ? 'h-11' : 'h-8 text-[13px]',
                        )}
                    />
                </form>
            )}
        </section>
    );
}
