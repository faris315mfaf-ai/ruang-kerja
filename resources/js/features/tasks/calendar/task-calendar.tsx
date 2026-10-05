import {
    AlertCircle,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { PriorityIcon } from '@/components/priority-icon';
import { defaultStatusColor, StatusIcon } from '@/components/status-icon';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';
import {
    addMonths,
    groupByDueDate,
    isSameMonth,
    monthGrid,
    monthStart,
    WEEKDAY_LABELS,
    weekDays,
} from '../lib/calendar';
import {
    addDays,
    diffDays,
    formatDayMonth,
    formatDayRange,
    formatMonthYear,
    formatShortDate,
    startOfWeek,
} from '../lib/due-date';
import { prioritySortWeight } from '../lib/priority';
import type { Label, Person, StatusCategory, Task, TaskStatus } from '../types';

type Props = {
    statuses: TaskStatus[];
    tasks: Task[];
    labelsById: Record<string, Label>;
    peopleById: Record<string, Person>;
    today: string;
    /** First day of the loaded month ("YYYY-MM-01"). */
    month: string;
    workspaceKey: string;
    onMonthChange: (month: string) => void;
    onOpen: (task: Task) => void;
    onShowUndated: () => void;
};

const LEGEND: { category: StatusCategory | 'overdue'; label: string }[] = [
    { category: 'todo', label: 'Todo' },
    { category: 'in_progress', label: 'Sedang dikerjakan' },
    { category: 'review', label: 'Review' },
    { category: 'done', label: 'Selesai' },
    { category: 'overdue', label: 'Terlambat' },
];

function isClosed(task: Task): boolean {
    return (
        task.status_category === 'done' || task.status_category === 'canceled'
    );
}

function isOverdue(task: Task, today: string): boolean {
    return task.due_date !== null && task.due_date < today && !isClosed(task);
}

function dotClass(task: Task, today: string): string {
    return isOverdue(task, today)
        ? 'bg-danger'
        : palette(defaultStatusColor(task.status_category)).bg;
}

function sortDay(tasks: Task[]): Task[] {
    return [...tasks].sort(
        (a, b) =>
            prioritySortWeight(a.priority) - prioritySortWeight(b.priority) ||
            a.number - b.number,
    );
}

function Chip({
    task,
    today,
    peopleById,
    onOpen,
}: {
    task: Task;
    today: string;
    peopleById: Record<string, Person>;
    onOpen: (task: Task) => void;
}) {
    const overdue = isOverdue(task, today);
    const assignee = task.assignee_ids[0]
        ? peopleById[task.assignee_ids[0]]
        : undefined;

    return (
        <button
            type="button"
            onClick={() => onOpen(task)}
            className={cn(
                'block w-full rounded-md border px-2 py-1.5 text-left transition-colors duration-120 ease-brand hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                overdue
                    ? 'border-danger/40 bg-danger/10'
                    : 'border-border bg-surface',
            )}
        >
            <span className="flex items-center gap-1.5">
                <span
                    aria-hidden
                    className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        dotClass(task, today),
                    )}
                />
                <span
                    className={cn(
                        'truncate text-[12px] text-text',
                        isClosed(task) && 'text-text-muted line-through',
                    )}
                >
                    {task.title}
                </span>
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                <span
                    className={cn(
                        'font-mono',
                        overdue ? 'text-danger' : 'text-text-subtle',
                    )}
                >
                    {task.key}
                </span>
                {overdue && (
                    <span className="text-danger">
                        · lewat {-diffDays(today, task.due_date ?? today)} hari
                    </span>
                )}
                {task.checklist && (
                    <span className="text-text-subtle tnum">
                        · {task.checklist.done}/{task.checklist.total}
                    </span>
                )}
                <span className="ml-auto flex items-center gap-1">
                    {task.priority === 1 && (
                        <PriorityIcon priority={1} className="size-3.5" />
                    )}
                    {assignee && (
                        <UserAvatar
                            name={assignee.name}
                            src={assignee.avatar}
                            className="size-4 text-[8px]"
                        />
                    )}
                </span>
            </span>
        </button>
    );
}

function MonthView({
    tasks,
    today,
    month,
    peopleById,
    onMonthChange,
    onOpen,
    onShowUndated,
}: Props) {
    const [expanded, setExpanded] = useState<string | null>(null);
    const byDay = groupByDueDate(tasks);
    const undated = tasks.filter(
        (task) => task.due_date === null && !isClosed(task),
    ).length;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="Bulan sebelumnya"
                    onClick={() => onMonthChange(addMonths(month, -1))}
                >
                    <ChevronLeft />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="Bulan berikutnya"
                    onClick={() => onMonthChange(addMonths(month, 1))}
                >
                    <ChevronRight />
                </Button>
                <h2 className="px-2 text-lg font-semibold text-text">
                    {formatMonthYear(month)}
                </h2>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => onMonthChange(monthStart(today))}
                >
                    Hari ini
                </Button>
                <ul
                    className="ml-auto flex flex-wrap items-center gap-3 text-[12px] text-text-muted"
                    aria-label="Keterangan warna"
                >
                    {LEGEND.map((item) => (
                        <li
                            key={item.category}
                            className="flex items-center gap-1.5"
                        >
                            <span
                                aria-hidden
                                className={cn(
                                    'size-1.5 rounded-full',
                                    item.category === 'overdue'
                                        ? 'bg-danger'
                                        : palette(
                                              defaultStatusColor(item.category),
                                          ).bg,
                                )}
                            />
                            {item.label}
                        </li>
                    ))}
                </ul>
            </div>
            <p className="text-right text-[12px] text-text-muted">
                Ditampilkan menurut tenggat
                {undated > 0 && (
                    <>
                        {' · '}
                        <button
                            type="button"
                            onClick={onShowUndated}
                            className="text-primary underline underline-offset-2"
                        >
                            {undated} tugas tanpa tenggat
                        </button>
                    </>
                )}
            </p>

            <div
                role="grid"
                aria-label={`Kalender ${formatMonthYear(month)}`}
                className="overflow-hidden rounded-lg border border-border bg-surface"
            >
                <div
                    role="row"
                    className="grid grid-cols-7 border-b border-border bg-surface-2"
                >
                    {WEEKDAY_LABELS.map((day) => (
                        <div
                            key={day}
                            role="columnheader"
                            className="px-3 py-2 text-[12px] text-text-muted"
                        >
                            {day}
                        </div>
                    ))}
                </div>
                {monthGrid(month).map((week) => (
                    <div
                        key={week[0]}
                        role="row"
                        className="grid grid-cols-7 border-b border-border last:border-b-0"
                    >
                        {week.map((day) => {
                            const items = sortDay(byDay.get(day) ?? []);
                            const inMonth = isSameMonth(day, month);
                            const isToday = day === today;
                            const open = expanded === day;
                            const shown = open ? items : items.slice(0, 2);

                            return (
                                <div
                                    key={day}
                                    role="gridcell"
                                    aria-label={`${formatShortDate(day)}, ${items.length} tugas`}
                                    className={cn(
                                        'min-h-32 space-y-1.5 border-r border-border p-1.5 last:border-r-0',
                                        !inMonth && 'bg-surface-2/50',
                                        isToday &&
                                            'bg-primary/5 ring-1 ring-primary/40 ring-inset',
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'flex items-center gap-1.5 px-1 text-[12px]',
                                            inMonth
                                                ? 'text-text'
                                                : 'text-text-subtle',
                                        )}
                                    >
                                        {isToday ? (
                                            <>
                                                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                                                    {Number(day.slice(8))}
                                                </span>
                                                <span className="text-primary">
                                                    Hari ini
                                                </span>
                                            </>
                                        ) : day.slice(8) === '01' ||
                                          (day === week[0] && !inMonth) ? (
                                            formatDayMonth(day)
                                        ) : (
                                            Number(day.slice(8))
                                        )}
                                    </div>
                                    {isToday && items.length === 0 && (
                                        <p className="px-1 text-[11px] text-text-muted">
                                            Tidak ada tenggat
                                        </p>
                                    )}
                                    {shown.map((task) => (
                                        <Chip
                                            key={task.id}
                                            task={task}
                                            today={today}
                                            peopleById={peopleById}
                                            onOpen={onOpen}
                                        />
                                    ))}
                                    {items.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExpanded(open ? null : day)
                                            }
                                            className="px-1 text-[12px] text-text-muted hover:text-text"
                                        >
                                            {open
                                                ? 'Lebih sedikit'
                                                : `+${items.length - 2} lainnya`}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

function AgendaView({
    statuses,
    tasks,
    labelsById,
    peopleById,
    today,
    month,
    workspaceKey,
    onMonthChange,
    onOpen,
}: Props) {
    const [weekStart, setWeekStart] = useState(() =>
        startOfWeek(isSameMonth(today, month) ? today : month),
    );
    const [showMonth, setShowMonth] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const days = weekDays(weekStart);
    const byDay = groupByDueDate(tasks);
    const overdue = tasks
        .filter((task) => isOverdue(task, today))
        .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
    const statusById = Object.fromEntries(
        statuses.map((status) => [status.id, status]),
    );

    const goToWeek = (start: string) => {
        setWeekStart(start);
        // Load the month of the week's Thursday when it is outside the loaded month.
        const thursday = addDays(start, 3);

        if (!isSameMonth(thursday, month)) {
            onMonthChange(monthStart(thursday));
        }
    };

    const subtitle = (task: Task) => {
        if (task.parent_key) {
            return `sub-tugas ${task.parent_key}`;
        }

        if (task.checklist) {
            return `checklist ${task.checklist.done}/${task.checklist.total}`;
        }

        return task.label_ids[0]
            ? labelsById[task.label_ids[0]]?.name
            : statusById[task.status_id]?.name;
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-semibold text-text">
                        Kalender · {workspaceKey}
                    </p>
                    <p className="text-sm text-text-muted">
                        {formatDayRange(days[0], days[6])} {days[6].slice(0, 4)}
                    </p>
                </div>
                <button
                    type="button"
                    aria-label="Minggu sebelumnya"
                    onClick={() => goToWeek(addDays(weekStart, -7))}
                    className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
                >
                    <ChevronLeft className="size-5" />
                </button>
                <button
                    type="button"
                    aria-label="Minggu berikutnya"
                    onClick={() => goToWeek(addDays(weekStart, 7))}
                    className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
                >
                    <ChevronRight className="size-5" />
                </button>
                <Button
                    variant="outline"
                    className="h-11"
                    aria-pressed={showMonth}
                    onClick={() => setShowMonth((value) => !value)}
                >
                    <CalendarDays />
                    Bulan
                </Button>
            </div>

            {showMonth && (
                <div className="rounded-lg border border-border bg-surface p-2">
                    <div className="mb-1 flex items-center justify-between">
                        <button
                            type="button"
                            aria-label="Bulan sebelumnya"
                            onClick={() => onMonthChange(addMonths(month, -1))}
                            className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
                        >
                            <ChevronLeft className="size-4" />
                        </button>
                        <span className="text-[15px] font-medium text-text">
                            {formatMonthYear(month)}
                        </span>
                        <button
                            type="button"
                            aria-label="Bulan berikutnya"
                            onClick={() => onMonthChange(addMonths(month, 1))}
                            className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
                        >
                            <ChevronRight className="size-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-7 text-center text-[11px] text-text-muted">
                        {WEEKDAY_LABELS.map((day) => (
                            <span key={day}>{day}</span>
                        ))}
                    </div>
                    {monthGrid(month).map((week) => (
                        <div key={week[0]} className="grid grid-cols-7">
                            {week.map((day) => (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => {
                                        setWeekStart(startOfWeek(day));
                                        setShowMonth(false);
                                    }}
                                    className={cn(
                                        'flex h-11 flex-col items-center justify-center rounded-md text-sm',
                                        isSameMonth(day, month)
                                            ? 'text-text'
                                            : 'text-text-subtle',
                                        day === today &&
                                            'font-semibold text-primary',
                                    )}
                                >
                                    {Number(day.slice(8))}
                                    {(byDay.get(day)?.length ?? 0) > 0 && (
                                        <span
                                            aria-hidden
                                            className="size-1 rounded-full bg-text-muted"
                                        />
                                    )}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            <div className="-mx-4 grid grid-cols-7 gap-1 border-b border-border px-2 pb-3">
                {days.map((day, index) => {
                    const count = byDay.get(day)?.length ?? 0;
                    const late = (byDay.get(day) ?? []).some((task) =>
                        isOverdue(task, today),
                    );

                    return (
                        <a
                            key={day}
                            href={`#hari-${day}`}
                            className={cn(
                                'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-text-muted',
                                day === today &&
                                    'bg-surface-2 ring-1 ring-border',
                            )}
                        >
                            <span
                                className={cn(
                                    'text-[13px]',
                                    day === today && 'text-primary',
                                )}
                            >
                                {WEEKDAY_LABELS[index]}
                            </span>
                            <span
                                className={cn(
                                    'flex size-8 items-center justify-center rounded-full text-[17px] font-medium',
                                    day === today
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-text',
                                )}
                            >
                                {Number(day.slice(8))}
                            </span>
                            <span
                                className="flex h-1.5 items-center gap-0.5"
                                aria-label={`${count} tugas`}
                            >
                                {Array.from(
                                    { length: Math.min(count, 3) },
                                    (_, dot) => (
                                        <span
                                            key={dot}
                                            className={cn(
                                                'size-1.5 rounded-full',
                                                late
                                                    ? 'bg-danger'
                                                    : 'bg-text-muted',
                                            )}
                                        />
                                    ),
                                )}
                            </span>
                        </a>
                    );
                })}
            </div>

            {overdue.length > 0 && (
                <button
                    type="button"
                    onClick={() => onOpen(overdue[0])}
                    className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 text-left text-[15px]"
                >
                    <AlertCircle
                        className="size-5 shrink-0 text-danger"
                        aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">
                        <span className="text-danger">
                            {overdue.length} terlambat
                        </span>
                        <span className="text-text-muted">
                            {' '}
                            · {overdue[0].key}{' '}
                        </span>
                        <span className="text-text">{overdue[0].title}</span>
                    </span>
                    <ChevronRight
                        className="size-4 text-text-muted"
                        aria-hidden
                    />
                </button>
            )}

            {days.map((day) => {
                const items = sortDay(byDay.get(day) ?? []);
                const open = expanded === day;
                const shown = open ? items : items.slice(0, 2);
                const relative = diffDays(today, day);

                if (items.length === 0 && day !== today) {
                    return null;
                }

                return (
                    <section
                        key={day}
                        id={`hari-${day}`}
                        className="scroll-mt-20 space-y-2"
                    >
                        <h3 className="flex items-center gap-2 text-[15px] font-medium text-text">
                            {formatShortDate(day)}
                            {day === today && (
                                <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[13px] text-primary">
                                    Hari ini
                                </span>
                            )}
                            {relative === 1 && (
                                <span className="text-text-muted">· besok</span>
                            )}
                            {items.length > 2 && (
                                <span className="font-normal text-text-muted">
                                    · {items.length} tugas
                                </span>
                            )}
                        </h3>
                        {items.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-border-strong px-4 py-3 text-[15px] text-text-muted">
                                Tidak ada tenggat
                            </p>
                        ) : (
                            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                                {shown.map((task) => {
                                    const status = statusById[task.status_id];
                                    const assignee = task.assignee_ids[0]
                                        ? peopleById[task.assignee_ids[0]]
                                        : undefined;

                                    return (
                                        <button
                                            key={task.id}
                                            type="button"
                                            onClick={() => onOpen(task)}
                                            className={cn(
                                                'flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left',
                                                isOverdue(task, today) &&
                                                    'border-l-2 border-l-danger',
                                            )}
                                        >
                                            {status && (
                                                <StatusIcon
                                                    category={status.category}
                                                    color={status.color}
                                                    className="size-5"
                                                />
                                            )}
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-[15px] text-text">
                                                    {task.title}
                                                </span>
                                                <span className="block truncate text-[13px] text-text-muted">
                                                    <span className="font-mono">
                                                        {task.key}
                                                    </span>{' '}
                                                    · {subtitle(task)}
                                                </span>
                                            </span>
                                            <PriorityIcon
                                                priority={task.priority}
                                            />
                                            {assignee && (
                                                <UserAvatar
                                                    name={assignee.name}
                                                    src={assignee.avatar}
                                                    className="size-8 text-[11px]"
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                                {items.length > 2 && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setExpanded(open ? null : day)
                                        }
                                        className="min-h-12 w-full px-12 text-left text-[15px] text-primary"
                                    >
                                        {open
                                            ? 'Lebih sedikit'
                                            : `+ ${items.length - 2} lainnya`}
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
                );
            })}
        </div>
    );
}

/** Calendar by due date: month grid on desktop (KalenderTugas), week strip + agenda on mobile (MKalender). */
export function TaskCalendar(props: Props) {
    const breakpoint = useBreakpoint();

    return breakpoint === 'mobile' ? (
        <AgendaView {...props} />
    ) : (
        <MonthView {...props} />
    );
}
