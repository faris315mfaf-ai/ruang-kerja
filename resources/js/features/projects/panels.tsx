import { Link, router, useForm } from '@inertiajs/react';
import {
    Check,
    CircleAlert,
    CircleCheck,
    CircleDashed,
    CircleDot,
    Flag,
    MoreHorizontal,
    Pencil,
    Plus,
    RotateCcw,
    Trash2,
} from 'lucide-react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { UserAvatar } from '@/components/shell/user-avatar';
import { StatusIcon } from '@/components/status-icon';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    daysBetween,
    dueLabel,
    HEALTH_TONES,
    MILESTONE_LABELS,
    percent,
    pointsLabel,
    RISK_LABELS,
    RISK_TONES,
    shortDay,
    weekdayDay,
} from '@/features/portfolio/lib';
import {
    fieldClass,
    HealthBadge,
    Panel,
    PersonChip,
    ProgressMeter,
} from '@/features/portfolio/parts';
import type {
    Direction,
    MilestoneDetail,
    MilestoneStatus,
    ProjectSummaryProps,
    ProjectUpdateItem,
    RiskItem,
    TaskRef,
} from '@/features/portfolio/types';
import { formatRelative } from '@/lib/format';
import { isPaletteColor } from '@/lib/palette';
import { cn } from '@/lib/utils';
import { show as workspaceTasks } from '@/routes/workspaces';
import {
    complete,
    destroy as destroyMilestone,
} from '@/routes/projects/milestones';
import { store as storeDirection } from '@/routes/projects/directions';
import { destroy as destroyRisk } from '@/routes/projects/risks';
import { BurnupChart, burnupCaption } from './burnup-chart';

export function TaskChip({
    task,
    className,
}: {
    task: TaskRef;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px]',
                className,
            )}
        >
            <StatusIcon
                category={task.status_category}
                color={
                    isPaletteColor(task.status_color) ? task.status_color : null
                }
                className="size-3.5"
            />
            <span className="font-mono text-text-muted">{task.code}</span>
            <span className="truncate text-text">{task.title}</span>
        </span>
    );
}

/* ---------- KPIs ---------- */

const CATEGORY_BAR: {
    key: 'done' | 'review' | 'in_progress' | 'todo' | 'backlog';
    label: string;
    bar: string;
    dot: string;
}[] = [
    { key: 'done', label: 'Selesai', bar: 'bg-primary', dot: 'bg-primary' },
    { key: 'review', label: 'Review', bar: 'bg-info', dot: 'bg-info' },
    {
        key: 'in_progress',
        label: 'Dikerjakan',
        bar: 'bg-warning',
        dot: 'bg-warning',
    },
    {
        key: 'todo',
        label: 'Todo',
        bar: 'bg-text-subtle',
        dot: 'bg-text-subtle',
    },
    {
        key: 'backlog',
        label: 'Backlog',
        bar: 'bg-border-strong',
        dot: 'bg-border-strong',
    },
];

export function StatusStack({
    counts,
}: {
    counts: ProjectSummaryProps['status_counts'];
}) {
    const total =
        CATEGORY_BAR.reduce((sum, item) => sum + counts[item.key], 0) || 1;

    return (
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-surface-2">
            {CATEGORY_BAR.map((item) =>
                counts[item.key] > 0 ? (
                    <span
                        key={item.key}
                        className={item.bar}
                        style={{
                            width: `${(counts[item.key] / total) * 100}%`,
                        }}
                    />
                ) : null,
            )}
        </div>
    );
}

export function StatusLegend({
    counts,
}: {
    counts: ProjectSummaryProps['status_counts'];
}) {
    return (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-text-muted">
            {CATEGORY_BAR.map((item) => (
                <li key={item.key} className="flex items-center gap-1.5">
                    <span className={cn('size-1.5 rounded-full', item.dot)} />
                    {item.label}{' '}
                    <span className="text-text tnum">{counts[item.key]}</span>
                </li>
            ))}
        </ul>
    );
}

export function SummaryKpis({ props }: { props: ProjectSummaryProps }) {
    const { project, status_counts: counts, overdue_tasks: overdue } = props;
    const metrics = project.metrics;
    const missed = metrics.missed_milestones;

    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="col-span-2 rounded-lg border border-border bg-surface p-4 lg:col-span-1">
                <p className="text-[13px] text-text-muted">Progres</p>
                <p className="mt-1 text-2xl font-semibold text-text tnum">
                    {percent(metrics.actual)}
                </p>
                <ProgressMeter
                    actual={metrics.actual}
                    planned={metrics.planned}
                    health={project.health}
                    className="mt-2"
                />
                <p className="mt-2 text-[12px] text-text-muted">
                    rencana {percent(metrics.planned)} ·{' '}
                    <span
                        className={cn(
                            metrics.flags.includes('behind')
                                ? 'text-danger'
                                : (metrics.variance ?? 0) < 0
                                  ? 'text-warning'
                                  : 'text-success',
                        )}
                    >
                        {pointsLabel(metrics.variance)}
                    </span>
                    {metrics.uses_estimates && ' · berbobot jam'}
                </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-[13px] text-text-muted">Tugas</p>
                <p className="mt-1 text-text">
                    <span className="text-2xl font-semibold tnum">
                        {metrics.done}
                    </span>
                    <span className="text-[14px] text-text-muted">
                        /{metrics.scope} selesai
                    </span>
                </p>
                <StatusStack counts={counts} />
                <p className="mt-2 text-[12px] text-text-muted">
                    {counts.review} review · {counts.in_progress} dikerjakan ·{' '}
                    {counts.todo} todo · {counts.backlog} backlog
                </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-[13px] text-text-muted">Terlambat</p>
                <p
                    className={cn(
                        'mt-1 text-2xl font-semibold tnum',
                        metrics.overdue > 0 ? 'text-danger' : 'text-text',
                    )}
                >
                    {metrics.overdue}
                </p>
                <p className="mt-1 font-mono text-[12px] text-text-muted">
                    {overdue
                        .slice(0, 3)
                        .map((task) => task.code)
                        .join(' · ') || 'Tidak ada'}
                </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-[13px] text-text-muted">Milestone</p>
                <p className="mt-1 text-text">
                    <span className="text-2xl font-semibold tnum">
                        {metrics.milestones_done}
                    </span>
                    <span className="text-[14px] text-text-muted">
                        /{metrics.milestones_total} selesai
                    </span>
                </p>
                <p
                    className={cn(
                        'mt-1 text-[12px]',
                        missed.length > 0 ? 'text-danger' : 'text-text-muted',
                    )}
                >
                    {missed.length > 0
                        ? `${missed.length} terlewat · ${missed.map((item) => item.name).join(', ')}`
                        : 'Tidak ada yang terlewat'}
                </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-[13px] text-text-muted">Sisa waktu</p>
                <p className="mt-1 text-text">
                    <span className="text-2xl font-semibold tnum">
                        {metrics.days_left === null
                            ? '–'
                            : Math.max(0, metrics.days_left)}
                    </span>
                    <span className="text-[14px] text-text-muted"> hari</span>
                </p>
                <p className="mt-1 text-[12px] text-text-muted">
                    Target {weekdayDay(project.target_date)}
                </p>
            </div>
        </div>
    );
}

/* ---------- Burn-up ---------- */

export function BurnupPanel({
    props,
    compact = false,
}: {
    props: ProjectSummaryProps;
    compact?: boolean;
}) {
    const caption = burnupCaption(
        props.burnup,
        shortDay(props.project.target_date),
    );

    return (
        <Panel
            title={
                <>
                    {compact ? 'Burn-up mingguan' : 'Burn-up'}
                    {!compact && (
                        <span className="text-[13px] font-normal text-text-muted">
                            jumlah tugas, mingguan
                        </span>
                    )}
                </>
            }
            aside={
                <ul className="flex items-center gap-3 text-[12px] text-text-muted">
                    <li className="flex items-center gap-1.5">
                        <span className="h-0.5 w-4 bg-info" /> Lingkup
                    </li>
                    <li className="flex items-center gap-1.5">
                        <span className="h-0.5 w-4 bg-primary" /> Selesai
                    </li>
                    <li className="flex items-center gap-1.5">
                        <span className="h-0 w-4 border-t border-dashed border-text-muted" />{' '}
                        Ideal
                    </li>
                    {!compact && (
                        <li className="hidden items-center gap-1.5 sm:flex">
                            <span className="size-2 rotate-45 bg-text-muted" />{' '}
                            Milestone
                        </li>
                    )}
                </ul>
            }
        >
            <div className="p-4 pt-2">
                <BurnupChart
                    burnup={props.burnup}
                    height={compact ? 180 : 240}
                    compact={compact}
                />
                {caption && !compact && (
                    <p className="mt-3 text-[13px] text-text-muted">
                        {caption}
                    </p>
                )}
            </div>
        </Panel>
    );
}

/* ---------- Milestones ---------- */

const MILESTONE_ICON: Record<
    MilestoneStatus,
    { icon: typeof Check; className: string }
> = {
    completed: { icon: CircleCheck, className: 'text-primary' },
    completed_late: { icon: CircleCheck, className: 'text-primary' },
    missed: { icon: CircleAlert, className: 'text-danger' },
    in_progress: { icon: CircleDot, className: 'text-warning' },
    not_started: { icon: CircleDashed, className: 'text-text-subtle' },
};

function MilestoneStatusNote({
    milestone,
    today,
}: {
    milestone: MilestoneDetail;
    today: string;
}) {
    if (
        milestone.status === 'completed' ||
        milestone.status === 'completed_late'
    ) {
        const doneDay = milestone.completed_at
            ? milestone.completed_at.slice(0, 10)
            : null;
        const late = doneDay ? daysBetween(milestone.target_date, doneDay) : 0;

        return (
            <span className="inline-flex flex-wrap items-center gap-2 text-[13px] text-primary">
                Selesai {weekdayDay(doneDay)}
                {milestone.status === 'completed_late' && late > 0 && (
                    <span className="rounded bg-warning/12 px-1.5 text-[12px] text-warning">
                        terlambat {late} hari
                    </span>
                )}
            </span>
        );
    }

    if (milestone.status === 'missed') {
        return (
            <span className="rounded bg-danger/12 px-1.5 text-[12px] text-danger">
                Terlewat · {Math.abs(daysBetween(today, milestone.target_date))}{' '}
                hari
            </span>
        );
    }

    return (
        <span
            className={cn(
                'text-[13px]',
                milestone.status === 'in_progress'
                    ? 'rounded bg-warning/12 px-1.5 text-warning'
                    : 'text-text-muted',
            )}
        >
            {MILESTONE_LABELS[milestone.status]}
        </span>
    );
}

export function MilestonesPanel({
    props,
    onEdit,
    onCreate,
    compact = false,
}: {
    props: ProjectSummaryProps;
    onEdit: (milestone: MilestoneDetail) => void;
    onCreate: () => void;
    compact?: boolean;
}) {
    const { milestones, project, today, project_can: can } = props;
    const missed = milestones.filter(
        (milestone) => milestone.status === 'missed',
    ).length;
    const done = milestones.filter((milestone) =>
        milestone.status.startsWith('completed'),
    ).length;

    const setCompleted = (milestone: MilestoneDetail, completed: boolean) =>
        router.patch(
            complete({ workspace: project.key, milestone: milestone.id }).url,
            { completed },
            { preserveScroll: true },
        );

    const remove = (milestone: MilestoneDetail) => {
        if (window.confirm(`Hapus milestone "${milestone.name}"?`)) {
            router.delete(
                destroyMilestone({
                    workspace: project.key,
                    milestone: milestone.id,
                }).url,
                { preserveScroll: true },
            );
        }
    };

    return (
        <Panel
            title="Milestone"
            count={
                <>
                    {done} dari {milestones.length} selesai
                    {missed > 0 && (
                        <span className="text-danger">
                            {' '}
                            · {missed} terlewat
                        </span>
                    )}
                </>
            }
            aside={
                can.manage && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-11 md:h-8"
                        onClick={onCreate}
                    >
                        <Plus aria-hidden />
                        Milestone
                    </Button>
                )
            }
        >
            {milestones.length === 0 ? (
                <p className="flex items-center gap-2 p-4 text-[13px] text-text-muted">
                    <Flag className="size-4" aria-hidden />
                    Belum ada milestone.
                    {can.manage &&
                        ' Tambahkan target antara agar Direksi bisa memantau jadwal.'}
                </p>
            ) : (
                <ol className="divide-y divide-border">
                    {milestones.map((milestone, index) => {
                        const { icon: Icon, className } =
                            MILESTONE_ICON[milestone.status];
                        const isLast =
                            index === milestones.length - 1 &&
                            milestone.target_date === project.target_date;
                        const remaining = daysBetween(
                            today,
                            milestone.target_date,
                        );

                        return (
                            <li
                                key={milestone.id}
                                className={cn(
                                    'space-y-2 px-4 py-3',
                                    milestone.status === 'missed' &&
                                        'bg-danger/6',
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    {isLast &&
                                    milestone.status === 'not_started' ? (
                                        <Flag
                                            className="mt-0.5 size-4 shrink-0 text-text-subtle"
                                            aria-hidden
                                        />
                                    ) : (
                                        <Icon
                                            className={cn(
                                                'mt-0.5 size-4 shrink-0',
                                                className,
                                            )}
                                            aria-label={
                                                MILESTONE_LABELS[
                                                    milestone.status
                                                ]
                                            }
                                        />
                                    )}
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <span className="text-[15px] font-medium text-text md:text-[14px]">
                                                {milestone.name}
                                            </span>
                                            <MilestoneStatusNote
                                                milestone={milestone}
                                                today={today}
                                            />
                                            {isLast && (
                                                <span className="text-[13px] text-text-muted">
                                                    · target proyek
                                                </span>
                                            )}
                                        </p>
                                        {milestone.description && (
                                            <p className="text-[13px] text-text-muted">
                                                {milestone.description}
                                            </p>
                                        )}
                                        {milestone.tasks.length > 0 && (
                                            <div
                                                className={cn(
                                                    'flex flex-wrap gap-1.5',
                                                    compact && 'hidden',
                                                )}
                                            >
                                                {milestone.tasks.map((task) => (
                                                    <TaskChip
                                                        key={task.id}
                                                        task={task}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        {compact &&
                                            milestone.tasks.length > 0 && (
                                                <p className="font-mono text-[12px] text-text-muted">
                                                    {milestone.tasks
                                                        .map(
                                                            (task) => task.code,
                                                        )
                                                        .join(', ')}
                                                </p>
                                            )}
                                    </div>
                                    <div className="shrink-0 text-right text-[13px] text-text-muted">
                                        <p
                                            className={
                                                compact
                                                    ? 'font-mono'
                                                    : undefined
                                            }
                                        >
                                            {compact
                                                ? shortDay(
                                                      milestone.target_date,
                                                  )
                                                : `Target ${weekdayDay(milestone.target_date)}`}
                                        </p>
                                        {!milestone.status.startsWith(
                                            'completed',
                                        ) &&
                                            remaining > 0 && (
                                                <p className="text-[12px]">
                                                    {dueLabel(remaining)}
                                                </p>
                                            )}
                                    </div>
                                    {can.manage && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="-my-1 size-11 shrink-0 md:size-8"
                                                    aria-label={`Aksi milestone ${milestone.name}`}
                                                >
                                                    <MoreHorizontal />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {milestone.status.startsWith(
                                                    'completed',
                                                ) ? (
                                                    <DropdownMenuItem
                                                        onSelect={() =>
                                                            setCompleted(
                                                                milestone,
                                                                false,
                                                            )
                                                        }
                                                    >
                                                        <RotateCcw /> Buka
                                                        kembali
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem
                                                        onSelect={() =>
                                                            setCompleted(
                                                                milestone,
                                                                true,
                                                            )
                                                        }
                                                    >
                                                        <Check /> Tandai selesai
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        onEdit(milestone)
                                                    }
                                                >
                                                    <Pencil /> Ubah
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-danger"
                                                    onSelect={() =>
                                                        remove(milestone)
                                                    }
                                                >
                                                    <Trash2 /> Hapus
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </Panel>
    );
}

/* ---------- Updates ---------- */

function DirectionList({ directions }: { directions: Direction[] }) {
    if (directions.length === 0) {
        return null;
    }

    return (
        <ul className="space-y-2">
            {directions.map((direction) => (
                <li
                    key={direction.id}
                    className="flex gap-2 rounded-md bg-surface-2 px-3 py-2 text-[13px]"
                >
                    <UserAvatar
                        name={direction.author?.name ?? 'Direksi'}
                        src={direction.author?.avatar}
                        className="size-5 text-[9px]"
                    />
                    <div className="min-w-0">
                        <p className="text-text-muted">
                            <span className="font-medium text-text">
                                {direction.author?.name ?? 'Direksi'}
                            </span>{' '}
                            · {formatRelative(direction.created_at)}
                        </p>
                        <p className="whitespace-pre-line text-text">
                            {direction.body}
                        </p>
                    </div>
                </li>
            ))}
        </ul>
    );
}

export function LatestUpdatePanel({
    props,
    onWrite,
    onDiscuss,
    onResolve,
    resolving,
    compact = false,
}: {
    props: ProjectSummaryProps;
    onWrite: () => void;
    onDiscuss: (update: ProjectUpdateItem) => void;
    onResolve: (update: ProjectUpdateItem) => void;
    resolving: string | null;
    compact?: boolean;
}) {
    const [latest, ...history] = props.updates;
    const can = props.project_can;

    return (
        <Panel
            title="Update terbaru PIC"
            aside={
                can.manage ? (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-11 md:h-8"
                        onClick={onWrite}
                    >
                        <Pencil aria-hidden /> Tulis update
                    </Button>
                ) : (
                    <span className="text-[12px] text-text-muted">
                        mingguan
                    </span>
                )
            }
        >
            {!latest ? (
                <p className="p-4 text-[13px] text-text-muted">
                    Belum ada update.{' '}
                    {can.manage
                        ? 'Tulis update pertama untuk Direksi.'
                        : 'PIC belum menulis update.'}
                </p>
            ) : (
                <div className="space-y-3 p-4">
                    <div className="flex items-center gap-2.5">
                        <UserAvatar
                            name={latest.author?.name ?? 'PIC'}
                            src={latest.author?.avatar}
                            className="size-8 text-xs"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-medium text-text">
                                {latest.author?.name ?? '–'}
                            </p>
                            <p className="text-[12px] text-text-muted">
                                {weekdayDay(latest.created_at.slice(0, 10))} ·{' '}
                                {formatRelative(latest.created_at)}
                            </p>
                        </div>
                        <HealthBadge health={latest.health} />
                    </div>
                    <div>
                        <p className="text-[11px] font-medium tracking-[.04em] text-text-muted uppercase">
                            Ringkasan
                        </p>
                        <p className="text-[14px] whitespace-pre-line text-text">
                            {latest.summary}
                        </p>
                    </div>
                    {latest.blockers && (
                        <div>
                            <p className="text-[11px] font-medium tracking-[.04em] text-text-muted uppercase">
                                Hambatan
                            </p>
                            <p className="text-[14px] whitespace-pre-line text-text">
                                {latest.blockers}
                            </p>
                        </div>
                    )}
                    {latest.decision_needed && (
                        <div className="rounded-md border border-primary/40 bg-primary/8 p-3">
                            <p className="text-[11px] font-medium tracking-[.04em] text-primary uppercase">
                                Keputusan yang dibutuhkan
                            </p>
                            <p className="mt-1 text-[14px] text-text">
                                {latest.decision_needed}
                            </p>
                            {latest.decision_resolved_at ? (
                                <p className="mt-2 flex items-center gap-1.5 text-[13px] text-success">
                                    <CircleCheck
                                        className="size-4"
                                        aria-hidden
                                    />
                                    Ditandai selesai oleh{' '}
                                    {latest.decision_resolved_by ?? 'Direksi'} ·{' '}
                                    {formatRelative(
                                        latest.decision_resolved_at,
                                    )}
                                </p>
                            ) : (
                                can.steer && (
                                    <div className="mt-3 flex gap-2">
                                        <Button
                                            size="sm"
                                            className="h-11 md:h-8"
                                            disabled={resolving === latest.id}
                                            onClick={() => onResolve(latest)}
                                        >
                                            Setujui
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-11 md:h-8"
                                            onClick={() => onDiscuss(latest)}
                                        >
                                            Diskusikan
                                        </Button>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                    <DirectionList directions={latest.directions} />
                </div>
            )}
            {history.length > 0 && !compact && (
                <div className="border-t border-border px-4 py-3">
                    <p className="mb-2 text-[11px] font-medium tracking-[.04em] text-text-muted uppercase">
                        Riwayat
                    </p>
                    <ul className="space-y-2">
                        {history.map((update) => (
                            <li
                                key={update.id}
                                className="grid grid-cols-[48px_10px_1fr] items-start gap-2 text-[13px]"
                            >
                                <span className="text-text-muted">
                                    {shortDay(update.created_at.slice(0, 10))}
                                </span>
                                <span
                                    className={cn(
                                        'mt-1.5 size-2 rounded-full',
                                        HEALTH_TONES[update.health].dot,
                                    )}
                                    aria-label={update.health}
                                />
                                <span className="text-text">
                                    {update.summary}
                                    {update.decision_needed &&
                                        !update.decision_resolved_at && (
                                            <span className="ml-1 text-primary">
                                                · keputusan tertunda
                                            </span>
                                        )}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-2 text-[12px] text-text-muted">
                        Titik hijau = Sesuai jalur pada update tersebut.
                    </p>
                </div>
            )}
            {history.length > 0 && compact && (
                <details className="border-t border-border">
                    <summary className="flex min-h-12 cursor-pointer items-center px-4 text-[14px] text-primary">
                        Riwayat update ({props.updates.length})
                    </summary>
                    <ul className="space-y-2 px-4 pb-3">
                        {history.map((update) => (
                            <li
                                key={update.id}
                                className="flex gap-2 text-[14px]"
                            >
                                <span
                                    className={cn(
                                        'mt-2 size-2 shrink-0 rounded-full',
                                        HEALTH_TONES[update.health].dot,
                                    )}
                                />
                                <span>
                                    <span className="text-text-muted">
                                        {shortDay(
                                            update.created_at.slice(0, 10),
                                        )}{' '}
                                        ·{' '}
                                    </span>
                                    {update.summary}
                                </span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </Panel>
    );
}

/* ---------- Risks ---------- */

export function RisksPanel({
    props,
    onCreate,
    onEdit,
}: {
    props: ProjectSummaryProps;
    onCreate: () => void;
    onEdit: (risk: RiskItem) => void;
}) {
    const open = props.risks.filter((risk) => risk.status === 'open');
    const resolved = props.risks.length - open.length;
    const can = props.project_can;

    const remove = (risk: RiskItem) => {
        if (window.confirm(`Hapus risiko "${risk.title}"?`)) {
            router.delete(
                destroyRisk({ workspace: props.project.key, risk: risk.id })
                    .url,
                { preserveScroll: true },
            );
        }
    };

    return (
        <Panel
            title="Risiko terbuka"
            count={open.length}
            aside={
                can.manage && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-11 md:h-8"
                        onClick={onCreate}
                    >
                        <Plus aria-hidden /> Risiko
                    </Button>
                )
            }
        >
            {open.length === 0 ? (
                <p className="p-4 text-[13px] text-text-muted">
                    Tidak ada risiko terbuka
                    {resolved > 0 && ` · ${resolved} teratasi`}.
                </p>
            ) : (
                <ul className="divide-y divide-border">
                    {open.map((risk) => (
                        <li
                            key={risk.id}
                            className="flex items-start gap-3 px-4 py-3"
                        >
                            <span
                                className={cn(
                                    'mt-0.5 shrink-0 rounded px-1.5 text-[12px] leading-5',
                                    RISK_TONES[risk.level],
                                )}
                            >
                                {RISK_LABELS[risk.level]}
                            </span>
                            <div className="min-w-0 flex-1 space-y-1">
                                <p className="text-[14px] text-text">
                                    {risk.title}
                                    {risk.task && (
                                        <span className="ml-1.5 font-mono text-[12px] whitespace-nowrap text-primary">
                                            {risk.task.code}
                                        </span>
                                    )}
                                </p>
                                <PersonChip
                                    person={risk.owner}
                                    className="text-[13px] text-text-muted"
                                />
                            </div>
                            {can.manage && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="-my-1 size-11 shrink-0 md:size-8"
                                            aria-label={`Aksi risiko ${risk.title}`}
                                        >
                                            <MoreHorizontal />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onSelect={() => onEdit(risk)}
                                        >
                                            <Pencil /> Ubah / tandai teratasi
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-danger"
                                            onSelect={() => remove(risk)}
                                        >
                                            <Trash2 /> Hapus
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

/* ---------- Overdue tasks ---------- */

export function OverduePanel({
    props,
    compact = false,
}: {
    props: ProjectSummaryProps;
    compact?: boolean;
}) {
    const tasks = props.overdue_tasks;
    const href = `${workspaceTasks.url(props.project.key)}?view=list`;

    return (
        <Panel
            title="Tugas terlambat"
            count={
                <span className={tasks.length > 0 ? 'text-danger' : undefined}>
                    {tasks.length}
                </span>
            }
            aside={
                <Link
                    href={href}
                    className="text-[13px] text-primary hover:underline"
                >
                    {compact
                        ? 'Semua tugas'
                        : `Semua tugas (${props.project.metrics.scope})`}
                </Link>
            }
        >
            {tasks.length === 0 ? (
                <p className="flex items-center gap-2 p-4 text-[13px] text-text-muted">
                    <CircleCheck className="size-4 text-success" aria-hidden />{' '}
                    Tidak ada tugas terlambat.
                </p>
            ) : (
                <ul className="divide-y divide-border">
                    {tasks.map((task) => (
                        <li
                            key={task.id}
                            className="flex min-h-12 items-center gap-3 px-4 py-2 text-[14px] md:text-[13px]"
                        >
                            <StatusIcon
                                category={task.status_category}
                                color={
                                    isPaletteColor(task.status_color)
                                        ? task.status_color
                                        : null
                                }
                            />
                            {compact ? (
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-text">
                                        {task.title}
                                    </span>
                                    <span className="text-[13px]">
                                        <span className="font-mono text-text-muted">
                                            {task.code}
                                        </span>
                                        <span className="text-danger">
                                            {' '}
                                            · Lewat{' '}
                                            {Math.abs(
                                                daysBetween(
                                                    props.today,
                                                    task.due_date ??
                                                        props.today,
                                                ),
                                            )}{' '}
                                            hari
                                        </span>
                                    </span>
                                </span>
                            ) : (
                                <>
                                    <span className="w-16 shrink-0 font-mono text-[12px] text-text-muted">
                                        {task.code}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-text">
                                        {task.title}
                                    </span>
                                    <PersonChip
                                        person={task.assignee}
                                        className="w-36 shrink-0 text-text"
                                    />
                                    <span className="w-24 shrink-0 text-right text-danger">
                                        lewat{' '}
                                        {Math.abs(
                                            daysBetween(
                                                props.today,
                                                task.due_date ?? props.today,
                                            ),
                                        )}{' '}
                                        hari
                                    </span>
                                </>
                            )}
                            {compact && task.assignee && (
                                <UserAvatar
                                    name={task.assignee.name}
                                    src={task.assignee.avatar}
                                    className="size-7 text-[10px]"
                                />
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

/* ---------- Team & load ---------- */

export function TeamLoadPanel({ props }: { props: ProjectSummaryProps }) {
    const { members, idle, open_total: openTotal } = props.team_load;
    const max = Math.max(5, ...members.map((member) => member.open));

    return (
        <Panel
            title="Tim & beban"
            aside={
                <span className="text-[12px] text-text-muted">
                    tugas terbuka
                </span>
            }
        >
            <ul className="space-y-2.5 p-4">
                {members.length === 0 && (
                    <li className="text-[13px] text-text-muted">
                        Belum ada tugas terbuka yang ditugaskan.
                    </li>
                )}
                {members.map((member) => (
                    <li
                        key={member.person?.id}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_24px] items-center gap-3 text-[13px]"
                    >
                        <PersonChip
                            person={member.person}
                            className="text-text"
                        />
                        <span className="h-1.5 rounded-full bg-surface-2">
                            <span
                                className="block h-full rounded-full bg-text-muted"
                                style={{
                                    width: `${(member.open / max) * 100}%`,
                                }}
                            />
                        </span>
                        <span className="text-right text-text tnum">
                            {member.open}
                        </span>
                    </li>
                ))}
            </ul>
            <p className="px-4 pb-4 text-[12px] text-text-muted">
                {openTotal} tugas terbuka
                {idle > 0 && ` · ${idle} anggota lain tanpa tugas terbuka`}.
                Skala batang 0–{max}.
            </p>
        </Panel>
    );
}

/* ---------- Arahan Direksi ---------- */

export function DirectionsBox({
    props,
    currentUser,
}: {
    props: ProjectSummaryProps;
    currentUser: { name: string; avatar?: string | null } | null;
}) {
    const form = useForm({ body: '' });
    const lead = props.project.lead;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.submit(storeDirection(props.project.key), {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    if (!props.project_can.steer && props.directions.length === 0) {
        return null;
    }

    return (
        <Panel id="arahan" title="Arahan Direksi">
            <div className="space-y-3 p-4">
                {props.project_can.steer && (
                    <form onSubmit={submit} className="flex gap-3">
                        <UserAvatar
                            name={currentUser?.name ?? 'Direksi'}
                            src={currentUser?.avatar}
                            className="size-7 text-[10px]"
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                            <label className="sr-only" htmlFor="direction-body">
                                Arahan untuk PIC
                            </label>
                            <textarea
                                id="direction-body"
                                className={cn(fieldClass, 'min-h-20')}
                                placeholder="Tulis arahan untuk PIC…"
                                value={form.data.body}
                                maxLength={2000}
                                onChange={(event) =>
                                    form.setData('body', event.target.value)
                                }
                            />
                            <InputError message={form.errors.body} />
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-[12px] text-text-muted">
                                    Dikirim ke {lead?.name ?? 'pemilik proyek'}{' '}
                                    dan tercatat di Aktivitas proyek.
                                </p>
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={
                                        form.processing ||
                                        form.data.body.trim() === ''
                                    }
                                >
                                    Kirim
                                </Button>
                            </div>
                        </div>
                    </form>
                )}
                <DirectionList directions={props.directions} />
            </div>
        </Panel>
    );
}
