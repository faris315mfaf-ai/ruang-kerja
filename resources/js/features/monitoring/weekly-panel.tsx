import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    ListChecks,
    Users,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatNumber } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { DAY_STATES, percentOf } from './lib';
import type { TopTask, WeekBlocker, WeekCell, WeeklyMonitoring } from './types';

const CELL_STYLE: Record<WeekCell['state'], string> = {
    reported: 'bg-success-soft text-success',
    draft: 'bg-warning-soft text-warning',
    missing: 'bg-danger-soft text-danger',
    off: 'bg-surface-2 text-text-subtle',
    future: 'border border-dashed border-border text-text-subtle',
};

function cellText(cell: WeekCell): string {
    switch (cell.state) {
        case 'reported':
            return String(cell.items);
        case 'draft':
            return 'D';
        case 'missing':
            return '!';
        default:
            return '–';
    }
}

/** One day of one person: colour + text (never colour only). */
function DayCell({
    cell,
    name,
    dayLabel,
    onOpen,
    small = false,
}: {
    cell: WeekCell;
    name: string;
    dayLabel: string;
    onOpen: (id: string) => void;
    small?: boolean;
}) {
    const label = `${name}, ${dayLabel}: ${DAY_STATES[cell.state].label}${
        cell.state === 'reported'
            ? `, ${cell.items} tugas${cell.hours !== null ? `, ${formatNumber(cell.hours)} jam` : ''}`
            : ''
    }`;
    const className = cn(
        'flex items-center justify-center rounded-[8px] text-[13px] font-bold tnum',
        small ? 'size-7' : 'size-9',
        CELL_STYLE[cell.state],
    );

    if (cell.report_id) {
        const id = cell.report_id;

        return (
            <button
                type="button"
                onClick={() => onOpen(id)}
                className={cn(className, 'hover:brightness-95', focusRing)}
                aria-label={`${label}. Buka laporan`}
                title={label}
            >
                {cellText(cell)}
            </button>
        );
    }

    return (
        <span className={className} title={label}>
            <span aria-hidden>{cellText(cell)}</span>
            <span className="sr-only">{label}</span>
        </span>
    );
}

function Legend() {
    return (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-text-muted">
            {(['reported', 'draft', 'missing', 'off'] as const).map((state) => (
                <span key={state} className="inline-flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className={cn(
                            'size-3 rounded-[4px]',
                            CELL_STYLE[state],
                        )}
                    />
                    {state === 'reported'
                        ? 'Lapor (angka = jumlah tugas)'
                        : DAY_STATES[state].label}
                </span>
            ))}
        </p>
    );
}

export function WeekStepper({
    weekly,
    onChange,
    loading,
}: {
    weekly: WeeklyMonitoring;
    onChange: (week: string) => void;
    loading: boolean;
}) {
    const next = weekly.week.next;

    return (
        <div className="flex items-center gap-1.5" aria-busy={loading}>
            <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => onChange(weekly.week.previous)}
                aria-label="Minggu sebelumnya"
            >
                <ChevronLeft aria-hidden />
            </Button>
            <span className="min-w-36 text-center text-label tnum">
                {weekly.week.is_current ? 'Minggu ini · ' : ''}
                {weekly.week.label}
            </span>
            <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={next === null}
                onClick={() => next && onChange(next)}
                aria-label="Minggu berikutnya"
            >
                <ChevronRight aria-hidden />
            </Button>
        </div>
    );
}

export function TopTasks({ tasks }: { tasks: TopTask[] }) {
    if (tasks.length === 0) {
        return (
            <EmptyState size="sm" icon={ListChecks} title="Belum ada tugas">
                Tugas yang disebut di laporan minggu ini tampil di sini.
            </EmptyState>
        );
    }

    return (
        <ol className="flex flex-col">
            {tasks.map((task) => (
                <li
                    key={task.task_id}
                    className="flex items-start gap-3 border-t border-divider py-3 first:border-t-0"
                >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <Link
                            href={task.url}
                            className={cn(
                                'rounded-sm text-[16px] font-semibold text-text hover:text-link',
                                focusRing,
                            )}
                        >
                            {task.key && (
                                <span className="mr-1.5 font-mono text-[14px] text-text-muted">
                                    {task.key}
                                </span>
                            )}
                            {task.title}
                        </Link>
                        <span className="text-meta text-text-muted">
                            {task.workspace} · {task.people} orang ·{' '}
                            {task.mentions} laporan
                            {task.hours !== null &&
                                ` · ${formatNumber(task.hours)} jam`}
                        </span>
                    </span>
                    {task.last_percent !== null && (
                        <Badge
                            variant="status"
                            tone="info"
                            className="h-7 tnum"
                        >
                            {task.last_percent}%
                        </Badge>
                    )}
                </li>
            ))}
        </ol>
    );
}

export function Blockers({
    blockers,
    onOpen,
}: {
    blockers: WeekBlocker[];
    onOpen: (id: string) => void;
}) {
    if (blockers.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={AlertTriangle}
                title="Tidak ada hambatan"
            >
                Hambatan yang ditulis di laporan minggu ini tampil di sini.
            </EmptyState>
        );
    }

    return (
        <ul className="flex flex-col">
            {blockers.map((blocker) => (
                <li
                    key={blocker.report_id}
                    className="border-t border-divider first:border-t-0"
                >
                    <button
                        type="button"
                        onClick={() => onOpen(blocker.report_id)}
                        className={cn(
                            'flex w-full items-start gap-3 rounded-lg py-3 text-left hover:bg-surface-2/50',
                            focusRing,
                        )}
                    >
                        <UserAvatar
                            name={blocker.user.name}
                            src={blocker.user.avatar}
                            className="size-8 text-[12px]"
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="text-meta text-text-muted">
                                <span className="font-semibold text-text">
                                    {blocker.user.name}
                                </span>{' '}
                                · {formatDate(blocker.date)}
                            </span>
                            <span className="line-clamp-3 text-[15px] leading-6 whitespace-pre-line text-warning">
                                {blocker.text}
                            </span>
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    );
}

/**
 * Monitoring kerja mingguan (keputusan pemilik 6 Okt 2026): Monday–Sunday,
 * per division a person × day matrix (reported or not, tasks, hours), the
 * tasks most worked on and this week's blockers. On phones the matrix
 * becomes one row of small day cells per person.
 */
export function WeeklyPanel({
    weekly,
    loading,
    onWeekChange,
    onOpenReport,
    compact = false,
    className,
}: {
    weekly?: WeeklyMonitoring;
    loading: boolean;
    onWeekChange: (week: string) => void;
    onOpenReport: (id: string) => void;
    compact?: boolean;
    className?: string;
}) {
    if (!weekly) {
        return (
            <Panel
                title="Monitoring kerja mingguan"
                className={cn(compact && 'py-5', className)}
                bodyClassName="gap-3"
            >
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-48 w-full" />
            </Panel>
        );
    }

    const totals = weekly.totals;
    const stepper = (
        <WeekStepper
            weekly={weekly}
            onChange={onWeekChange}
            loading={loading}
        />
    );

    return (
        <Panel
            title={compact ? 'Laporan mingguan' : 'Monitoring kerja mingguan'}
            action={compact ? undefined : stepper}
            className={cn(compact && 'py-5', className)}
            bodyClassName="gap-5"
        >
            {compact && stepper}
            <div
                className={cn(
                    'flex flex-col gap-5 transition-opacity duration-120 ease-brand',
                    loading && 'opacity-60',
                )}
            >
                <p className="text-meta text-text-muted">
                    <span className="font-bold text-text">
                        {totals.reported}
                    </span>{' '}
                    dari {totals.expected} hari kerja terlapor (
                    {percentOf(totals.reported, totals.expected)}%) ·{' '}
                    {totals.people_reported} orang melapor ·{' '}
                    {formatNumber(totals.hours)} jam tercatat
                </p>

                {weekly.divisions.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={Users}
                        title="Belum ada karyawan"
                    />
                ) : compact ? (
                    <div className="flex flex-col gap-4">
                        {weekly.divisions.map((division) => (
                            <section
                                key={division.id ?? 'none'}
                                aria-label={division.name}
                                className="flex flex-col gap-2"
                            >
                                <h3 className="flex items-baseline justify-between gap-2 text-label">
                                    {division.name}
                                    <span className="text-meta font-normal text-text-muted tnum">
                                        {division.reported}/{division.expected}
                                    </span>
                                </h3>
                                <ul className="flex flex-col divide-y divide-divider">
                                    {division.people.map((person) => (
                                        <li
                                            key={person.user.id}
                                            className="flex flex-col gap-1.5 py-2.5"
                                        >
                                            <span className="flex items-baseline justify-between gap-2">
                                                <span className="truncate text-[16px] font-semibold">
                                                    {person.user.name}
                                                </span>
                                                <span className="shrink-0 text-meta text-text-muted tnum">
                                                    {person.reported_days}/
                                                    {person.scheduled_days} hari
                                                </span>
                                            </span>
                                            <span className="flex gap-1">
                                                {person.days.map(
                                                    (cell, index) => (
                                                        <DayCell
                                                            key={cell.date}
                                                            cell={cell}
                                                            name={
                                                                person.user.name
                                                            }
                                                            dayLabel={
                                                                weekly.days[
                                                                    index
                                                                ].label
                                                            }
                                                            onOpen={
                                                                onOpenReport
                                                            }
                                                            small
                                                        />
                                                    ),
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                ) : (
                    <div className="relative -mx-1 overflow-x-auto px-1 [contain:inline-size]">
                        <table className="w-full min-w-[720px] border-separate border-spacing-y-1 text-left">
                            <caption className="sr-only">
                                Laporan per orang per hari, {weekly.week.label}
                            </caption>
                            <thead>
                                <tr className="text-[14px] font-bold text-text-muted">
                                    <th scope="col" className="pb-1 font-bold">
                                        Nama
                                    </th>
                                    {weekly.days.map((day) => (
                                        <th
                                            key={day.date}
                                            scope="col"
                                            className={cn(
                                                'w-12 pb-1 text-center font-bold',
                                                day.is_today && 'text-link',
                                            )}
                                        >
                                            {day.label}
                                        </th>
                                    ))}
                                    <th
                                        scope="col"
                                        className="w-20 pb-1 text-right font-bold"
                                    >
                                        Lapor
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-16 pb-1 text-right font-bold"
                                    >
                                        Jam
                                    </th>
                                </tr>
                            </thead>
                            {weekly.divisions.map((division) => (
                                <tbody key={division.id ?? 'none'}>
                                    <tr>
                                        <th
                                            scope="colgroup"
                                            colSpan={10}
                                            className="pt-3 pb-1 text-[15px] font-bold text-text"
                                        >
                                            {division.name}
                                            <span className="ml-2 font-medium text-text-muted tnum">
                                                {division.reported}/
                                                {division.expected} hari ·{' '}
                                                {percentOf(
                                                    division.reported,
                                                    division.expected,
                                                )}
                                                %
                                            </span>
                                        </th>
                                    </tr>
                                    {division.people.map((person) => (
                                        <tr key={person.user.id}>
                                            <th
                                                scope="row"
                                                className="pr-3 font-normal"
                                            >
                                                <span className="flex min-w-0 items-center gap-2.5">
                                                    <UserAvatar
                                                        name={person.user.name}
                                                        src={person.user.avatar}
                                                        className="size-7 text-[11px]"
                                                    />
                                                    <span className="truncate text-[15px] font-medium">
                                                        {person.user.name}
                                                    </span>
                                                </span>
                                            </th>
                                            {person.days.map((cell, index) => (
                                                <td
                                                    key={cell.date}
                                                    className="text-center"
                                                >
                                                    <span className="inline-flex">
                                                        <DayCell
                                                            cell={cell}
                                                            name={
                                                                person.user.name
                                                            }
                                                            dayLabel={
                                                                weekly.days[
                                                                    index
                                                                ].label
                                                            }
                                                            onOpen={
                                                                onOpenReport
                                                            }
                                                        />
                                                    </span>
                                                </td>
                                            ))}
                                            <td className="text-right text-[15px] tnum">
                                                {person.reported_days}/
                                                {person.scheduled_days}
                                            </td>
                                            <td className="text-right text-[15px] text-text-muted tnum">
                                                {person.hours !== null
                                                    ? formatNumber(person.hours)
                                                    : '–'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            ))}
                        </table>
                    </div>
                )}
                <Legend />

                <div className="grid gap-5 lg:grid-cols-2">
                    <section
                        aria-labelledby="top-tasks"
                        className="flex flex-col gap-1"
                    >
                        <h3 id="top-tasks" className="text-label">
                            Paling banyak dikerjakan
                        </h3>
                        <TopTasks tasks={weekly.top_tasks} />
                    </section>
                    <section
                        aria-labelledby="week-blockers"
                        className="flex flex-col gap-1"
                    >
                        <h3 id="week-blockers" className="text-label">
                            Hambatan minggu ini ({weekly.blockers.length})
                        </h3>
                        <Blockers
                            blockers={weekly.blockers}
                            onOpen={onOpenReport}
                        />
                    </section>
                </div>
            </div>
        </Panel>
    );
}
