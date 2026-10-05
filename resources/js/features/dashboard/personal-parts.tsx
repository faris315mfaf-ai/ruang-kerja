import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { PriorityIcon } from '@/components/priority-icon';
import { StatusIcon } from '@/components/status-icon';
import type { Priority } from '@/features/tasks/types';
import { formatDue } from '@/features/tasks/lib/due-date';
import { cn } from '@/lib/utils';
import type { PersonalMetrics, TaskSummary } from '@/types/dashboard';
import { busiestDay } from './lib';
import { PanelEmpty } from './panel';

const WEEKDAY_NAMES: Record<string, string> = {
    Sen: 'Senin',
    Sel: 'Selasa',
    Rab: 'Rabu',
    Kam: 'Kamis',
    Jum: 'Jumat',
    Sab: 'Sabtu',
    Min: 'Minggu',
};

function DueText({ task, today }: { task: TaskSummary; today: string }) {
    if (task.days_late > 0) {
        return (
            <span className="text-danger">Terlambat {task.days_late} hari</span>
        );
    }

    return task.due_date ? (
        <span>Tenggat {formatDue(task.due_date, today)}</span>
    ) : (
        <span>Tanpa tenggat</span>
    );
}

/** "Fokus hari ini": overdue first, then the nearest due dates. */
export function FocusList({
    items,
    today,
    variant = 'desktop',
}: {
    items: TaskSummary[];
    today: string;
    variant?: 'desktop' | 'mobile';
}) {
    if (items.length === 0) {
        return <PanelEmpty>Tidak ada tugas terbuka. Kerja bagus!</PanelEmpty>;
    }

    return (
        <ul className="divide-y divide-border">
            {items.map((task) => (
                <li key={task.id}>
                    <Link
                        href={task.url}
                        className={cn(
                            'flex items-center gap-3 px-4 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none',
                            variant === 'mobile'
                                ? 'min-h-16 py-2.5'
                                : 'min-h-11 py-2',
                        )}
                    >
                        {variant === 'desktop' && (
                            <PriorityIcon
                                priority={task.priority as Priority}
                            />
                        )}
                        <StatusIcon category={task.status_category} />
                        {variant === 'desktop' ? (
                            <>
                                <span className="w-16 shrink-0 font-mono text-xs text-text-muted">
                                    {task.key}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm text-text">
                                    {task.title}
                                </span>
                                <span className="hidden shrink-0 text-[13px] text-text-muted xl:inline">
                                    {task.workspace}
                                </span>
                                {task.checklist && (
                                    <span className="shrink-0 text-xs text-text-muted tnum">
                                        {task.checklist.done}/
                                        {task.checklist.total}
                                    </span>
                                )}
                                <span
                                    className={cn(
                                        'shrink-0 rounded-md px-2 py-0.5 text-xs',
                                        task.days_late > 0
                                            ? 'bg-danger/10'
                                            : 'bg-surface-2 text-text-muted',
                                    )}
                                >
                                    <DueText task={task} today={today} />
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[15px] text-text">
                                        {task.title}
                                    </span>
                                    <span className="mt-0.5 block truncate text-[13px] text-text-muted">
                                        <span className="font-mono">
                                            {task.key}
                                        </span>
                                        {' · '}
                                        <DueText task={task} today={today} />
                                        {task.checklist &&
                                            ` · ${task.checklist.done}/${task.checklist.total}`}
                                    </span>
                                </span>
                                <ChevronRight
                                    className="size-4 shrink-0 text-text-subtle"
                                    aria-hidden
                                />
                            </>
                        )}
                    </Link>
                </li>
            ))}
        </ul>
    );
}

/** "Minggu ini": tasks due per weekday as small bars. */
export function WeekStrip({ week }: { week: PersonalMetrics['week'] }) {
    const max = Math.max(1, ...week.days.map((day) => day.count));
    const busiest = busiestDay(week.days);

    return (
        <div>
            <ol className="grid auto-cols-fr grid-flow-col gap-2">
                {week.days.map((day) => (
                    <li
                        key={day.date}
                        className={cn(
                            'flex flex-col items-center rounded-lg px-1 py-2 text-center',
                            day.is_today && 'border border-border bg-surface-2',
                        )}
                    >
                        <span
                            className={cn(
                                'text-xs',
                                day.is_today
                                    ? 'font-medium text-text'
                                    : 'text-text-muted',
                            )}
                        >
                            {day.weekday}
                        </span>
                        <span className="text-[11px] text-text-subtle tnum">
                            {day.day}
                        </span>
                        <span
                            className="mt-2 flex h-12 w-full items-end justify-center"
                            aria-hidden
                        >
                            <span
                                className={cn(
                                    'w-2.5 rounded-t',
                                    day.count === 0
                                        ? 'h-0.5 bg-border-strong'
                                        : day.is_today
                                          ? 'bg-primary'
                                          : 'bg-primary/50',
                                )}
                                style={
                                    day.count > 0
                                        ? {
                                              height: `${(day.count / max) * 100}%`,
                                          }
                                        : undefined
                                }
                            />
                        </span>
                        <span className="mt-1.5 text-sm font-medium text-text tnum">
                            <span className="sr-only">
                                {WEEKDAY_NAMES[day.weekday]}:{' '}
                            </span>
                            {day.count}
                            <span className="sr-only"> tugas bertenggat</span>
                        </span>
                    </li>
                ))}
            </ol>
            {busiest && busiest.count > 1 && (
                <p className="mt-3 text-[13px] text-text-muted">
                    {WEEKDAY_NAMES[busiest.weekday]} paling padat (
                    {busiest.count} tugas).
                </p>
            )}
        </div>
    );
}

const DAY_TONE: Record<string, string> = {
    present: 'bg-success/70',
    wfh: 'bg-success/70',
    early_leave: 'bg-success/40',
    late: 'bg-warning',
    absent: 'bg-danger',
    needs_correction: 'bg-danger/50',
    leave: 'bg-info/60',
    permit: 'bg-info/60',
    sick: 'bg-info/60',
    business_trip: 'bg-info/60',
    holiday: 'bg-surface-2',
};

/** Attendance days of the period as squares + legend. */
export function AttendanceStrip({
    days,
}: {
    days: PersonalMetrics['attendance']['days'];
}) {
    if (days.items.length === 0) {
        return (
            <PanelEmpty>Belum ada catatan absensi pada periode ini.</PanelEmpty>
        );
    }

    return (
        <div>
            <p className="text-sm text-text tnum">
                <span className="text-success">{days.counts.present}</span>{' '}
                hadir · <span className="text-warning">{days.counts.late}</span>{' '}
                terlambat · <span>{days.counts.absent}</span> alpha
                {days.counts.away > 0 &&
                    ` · ${days.counts.away} cuti/izin/sakit`}
            </p>
            <ol className="mt-3 flex flex-wrap gap-1">
                {days.items.map((day) => (
                    <li
                        key={day.date}
                        title={`${day.date}: ${day.label}${day.late_minutes > 0 ? ` ${day.late_minutes} menit` : ''}`}
                        className={cn(
                            'size-5 rounded-[4px]',
                            DAY_TONE[day.status] ?? 'bg-surface-2',
                        )}
                    >
                        <span className="sr-only">
                            {day.date}: {day.label}
                        </span>
                    </li>
                ))}
            </ol>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2 rounded-sm bg-success/70"
                        aria-hidden
                    />
                    Hadir
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2 rounded-sm bg-warning"
                        aria-hidden
                    />
                    Terlambat
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-danger" aria-hidden />
                    Alpha
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2 rounded-sm bg-info/60"
                        aria-hidden
                    />
                    Cuti/izin/sakit
                </span>
            </p>
        </div>
    );
}
