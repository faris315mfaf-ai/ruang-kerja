import { Link } from '@inertiajs/react';
import { CalendarCheck, CircleCheckBig, ClipboardList } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { STATUS_CATEGORY_LABELS, StatusIcon } from '@/components/status-icon';
import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { formatDue } from '@/features/tasks/lib/due-date';
import { cn, focusRing } from '@/lib/utils';
import type {
    PersonalLive,
    PersonalMetrics,
    TaskSummary,
} from '@/types/dashboard';
import { busiestDay } from './lib';

const WEEKDAY_NAMES: Record<string, string> = {
    Sen: 'Senin',
    Sel: 'Selasa',
    Rab: 'Rabu',
    Kam: 'Kamis',
    Jum: 'Jumat',
    Sab: 'Sabtu',
    Min: 'Minggu',
};

/** Due pill text + tone: "Lewat 2 hari" (danger), "Hari ini" (warning). */
export function dueInfo(
    task: TaskSummary,
    today: string,
    short = false,
): { text: string; tone: BadgeTone } {
    if (task.days_late > 0) {
        return {
            text: `Lewat ${task.days_late} ${short ? 'hr' : 'hari'}`,
            tone: 'danger',
        };
    }

    if (!task.due_date) {
        return { text: 'Tanpa tenggat', tone: 'neutral' };
    }

    return {
        text: formatDue(task.due_date, today),
        tone: task.due_date === today ? 'warning' : 'neutral',
    };
}

const DUE_TEXT: Record<BadgeTone, string> = {
    danger: 'text-danger',
    warning: 'text-warning',
    success: 'text-success',
    info: 'text-info',
    link: 'text-link',
    neutral: 'text-text-muted',
};

/**
 * "Fokus hari ini" (SBeranda / MSBeranda): overdue first, then the nearest
 * due dates. Row = status icon, title, "KEY · workspace · status", due pill.
 */
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
        return (
            <div className="px-5 pb-4 md:px-7">
                <EmptyState
                    size="sm"
                    icon={CircleCheckBig}
                    title="Tidak ada tugas terbuka"
                >
                    Kerja bagus! Tugas baru akan muncul di sini.
                </EmptyState>
            </div>
        );
    }

    const mobile = variant === 'mobile';

    return (
        <ul className={cn(!mobile && 'border-t border-divider')}>
            {items.map((task, index) => {
                const due = dueInfo(task, today, mobile);

                return (
                    <li
                        key={task.id}
                        className={cn(index > 0 && 'border-t border-divider')}
                    >
                        <Link
                            href={task.url}
                            prefetch
                            className={cn(
                                'flex items-center transition-colors duration-120 ease-brand hover:bg-background',
                                focusRing,
                                'focus-visible:ring-inset',
                                mobile
                                    ? 'min-h-[70px] gap-3 px-4 py-2'
                                    : 'min-h-[72px] gap-3.5 px-7 py-2',
                            )}
                        >
                            <StatusIcon
                                category={task.status_category}
                                label={
                                    STATUS_CATEGORY_LABELS[task.status_category]
                                }
                                className="size-5"
                            />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-[17px] leading-[22px] font-semibold text-text">
                                    {task.title}
                                </span>
                                <span className="truncate text-meta text-text-muted md:text-[15px]">
                                    <span className="font-mono text-[14px] font-semibold">
                                        {task.key}
                                    </span>
                                    {!mobile && ` · ${task.workspace}`}
                                    {' · '}
                                    {
                                        STATUS_CATEGORY_LABELS[
                                            task.status_category
                                        ]
                                    }
                                    {task.checklist &&
                                        ` · ${task.checklist.done}/${task.checklist.total}`}
                                </span>
                            </span>
                            {mobile ? (
                                <span
                                    className={cn(
                                        'shrink-0 text-[14px] font-bold whitespace-nowrap',
                                        DUE_TEXT[due.tone],
                                    )}
                                >
                                    {due.text}
                                </span>
                            ) : (
                                <Badge
                                    variant="status"
                                    tone={due.tone}
                                    className="h-[30px]"
                                >
                                    {due.text}
                                </Badge>
                            )}
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}

/**
 * "Minggu ini" (SBeranda): one tile per day with the number of tasks due;
 * today is the gradient tile.
 */
export function WeekStrip({ week }: { week: PersonalLive['week'] }) {
    const busiest = busiestDay(week.days);

    if (week.total === 0) {
        return (
            <EmptyState
                size="sm"
                icon={CalendarCheck}
                title="Tidak ada tenggat minggu ini"
            />
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <ol
                className="grid gap-3"
                style={{
                    gridTemplateColumns: `repeat(${week.days.length}, minmax(0, 1fr))`,
                }}
            >
                {week.days.map((day) => (
                    <li
                        key={day.date}
                        className={cn(
                            'flex min-h-[132px] flex-col gap-2.5 rounded-[18px] p-3.5',
                            day.is_today
                                ? 'bg-primary bg-grad-active text-on-brand'
                                : 'border border-divider bg-background text-text',
                        )}
                    >
                        <span className="flex items-baseline justify-between gap-1">
                            <span className="text-[15px] font-bold">
                                <span className="sr-only">
                                    {WEEKDAY_NAMES[day.weekday]}
                                </span>
                                <span aria-hidden>{day.weekday}</span>
                            </span>
                            <span className="text-[24px] leading-7 font-extrabold tnum">
                                {day.day}
                            </span>
                        </span>
                        {day.count > 0 ? (
                            <span
                                className={cn(
                                    'rounded-[10px] px-2.5 py-2 text-[14px] leading-[19px] font-semibold',
                                    day.is_today
                                        ? 'bg-on-brand/18'
                                        : 'bg-surface',
                                )}
                            >
                                {day.count} tugas
                                <span className="sr-only"> bertenggat</span>
                                {day.open < day.count && (
                                    <span className="block font-medium opacity-80">
                                        {day.count - day.open} selesai
                                    </span>
                                )}
                            </span>
                        ) : (
                            <span
                                className={cn(
                                    'text-[14px]',
                                    day.is_today
                                        ? 'opacity-80'
                                        : 'text-text-subtle',
                                )}
                            >
                                Kosong
                            </span>
                        )}
                    </li>
                ))}
            </ol>
            {busiest && busiest.count > 1 && (
                <p className="text-label font-normal text-text-muted">
                    {WEEKDAY_NAMES[busiest.weekday]} paling padat (
                    {busiest.count} tugas).
                </p>
            )}
        </div>
    );
}

const DAY_TONE: Record<string, string> = {
    present: 'bg-success',
    wfh: 'bg-success',
    early_leave: 'bg-success/50',
    late: 'bg-fill-warning',
    absent: 'bg-fill-danger',
    needs_correction: 'bg-fill-danger/50',
    leave: 'bg-accent-blue',
    permit: 'bg-accent-blue',
    sick: 'bg-accent-blue',
    business_trip: 'bg-accent-blue',
    holiday: 'bg-surface-2',
};

const LEGEND = [
    { label: 'Hadir', tone: 'bg-success' },
    { label: 'Terlambat', tone: 'bg-fill-warning' },
    { label: 'Alpha', tone: 'bg-fill-danger' },
    { label: 'Cuti/izin/sakit', tone: 'bg-accent-blue' },
] as const;

/** Attendance days of the period as squares + legend. */
export function AttendanceStrip({
    days,
}: {
    days: PersonalMetrics['attendance']['days'];
}) {
    if (days.items.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={ClipboardList}
                title="Belum ada catatan absensi"
            >
                Belum ada catatan absensi pada periode ini.
            </EmptyState>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-body text-text tnum">
                <b className="text-success">{days.counts.present}</b> hadir ·{' '}
                <b className="text-warning">{days.counts.late}</b> terlambat ·{' '}
                <b>{days.counts.absent}</b> alpha
                {days.counts.away > 0 &&
                    ` · ${days.counts.away} cuti/izin/sakit`}
            </p>
            <ol className="flex flex-wrap gap-1.5">
                {days.items.map((day) => (
                    <li
                        key={day.date}
                        title={`${day.date}: ${day.label}${day.late_minutes > 0 ? ` ${day.late_minutes} menit` : ''}`}
                        className={cn(
                            'size-6 rounded-xs',
                            DAY_TONE[day.status] ?? 'bg-surface-2',
                        )}
                    >
                        <span className="sr-only">
                            {day.date}: {day.label}
                        </span>
                    </li>
                ))}
            </ol>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-text-muted">
                {LEGEND.map((item) => (
                    <span
                        key={item.label}
                        className="inline-flex items-center gap-1.5"
                    >
                        <span
                            aria-hidden
                            className={cn('size-2.5 rounded-full', item.tone)}
                        />
                        {item.label}
                    </span>
                ))}
            </p>
        </div>
    );
}
