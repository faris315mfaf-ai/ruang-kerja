import { Link } from '@inertiajs/react';
import {
    ChevronRight,
    CircleCheck,
    Info,
    MapPin,
    MessageSquare,
    TriangleAlert,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { WorkspaceAvatar } from '@/features/workspaces/workspace-avatar';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { summary } from '@/routes/projects';
import {
    daysBetween,
    dueLabel,
    flagSummary,
    HEALTH_TONES,
    percent,
    positionPercent,
    shortDay,
    updateAgeLabel,
    weekdayDay,
} from './lib';
import { HealthBadge, Panel, PersonChip, ProgressMeter } from './parts';
import type {
    AttendanceSummary,
    AttentionItem,
    DecisionItem,
    FeedItem,
    PortfolioKpis,
    ProjectRow,
    Roadmap,
} from './types';
import type { PortfolioActions } from './use-portfolio';

const DEFINITIONS = {
    active: 'Proyek berstatus berjalan/direncanakan/ditunda dalam periode ini, dikelompokkan menurut status dari PIC.',
    upcoming: 'Milestone belum selesai dengan target dalam 14 hari ke depan.',
    missed: 'Milestone yang target tanggalnya sudah lewat dan belum ditandai selesai.',
    overdue:
        'Tugas belum selesai (bukan Selesai/Dibatalkan) dengan tenggat sebelum hari ini, di proyek aktif.',
    decisions:
        'Update PIC yang meminta keputusan Direksi dan belum ditandai selesai.',
    progress:
        'Progres = tugas selesai ÷ tugas non-batal (berbobot estimasi jam bila ≥ 80% tugas punya estimasi). Garis = rencana: waktu berjalan ÷ durasi proyek.',
};

function InfoTip({ text }: { text: string }) {
    return (
        <Tooltip>
            <TooltipTrigger
                type="button"
                className="rounded-full text-text-subtle hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label="Definisi"
            >
                <Info className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{text}</TooltipContent>
        </Tooltip>
    );
}

function KpiCard({
    label,
    tip,
    value,
    tone,
    children,
    highlight,
}: {
    label: string;
    tip: string;
    value: number;
    tone?: 'danger';
    children?: React.ReactNode;
    highlight?: boolean;
}) {
    return (
        <div
            className={cn(
                'flex min-h-32 flex-col gap-2 rounded-lg border p-4',
                highlight
                    ? 'border-primary/40 bg-primary/8'
                    : 'border-border bg-surface',
            )}
        >
            <p className="flex items-center gap-1.5 text-[13px] text-text-muted">
                {label}
                <InfoTip text={tip} />
            </p>
            <p
                className={cn(
                    'text-2xl leading-8 font-semibold tnum',
                    tone === 'danger' && value > 0
                        ? 'text-danger'
                        : 'text-text',
                )}
            >
                {value}
            </p>
            <div className="text-[12px] leading-4 text-text-muted">
                {children}
            </div>
        </div>
    );
}

function joinDated(items: { key: string; target_date: string }[]) {
    return items
        .map((item) => `${shortDay(item.target_date)} ${item.key}`)
        .join(' · ');
}

/** KPI row (mockup DashboardDireksi). */
export function KpiRow({
    kpis,
    decisions,
}: {
    kpis: PortfolioKpis;
    decisions: DecisionItem[];
}) {
    const health = kpis.active.health;
    const total = Math.max(1, kpis.active.count);
    const decisionKeys = [
        ...new Set(decisions.map((item) => item.project.key)),
    ];

    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard
                label="Proyek aktif"
                tip={DEFINITIONS.active}
                value={kpis.active.count}
            >
                <div className="mb-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-surface-2">
                    {(['on_track', 'at_risk', 'off_track'] as const).map(
                        (key) =>
                            health[key] > 0 ? (
                                <span
                                    key={key}
                                    className={HEALTH_TONES[key].bar}
                                    style={{
                                        width: `${(health[key] / total) * 100}%`,
                                    }}
                                />
                            ) : null,
                    )}
                </div>
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-success" />
                        {health.on_track} sesuai jalur
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-warning" />
                        {health.at_risk} berisiko
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-danger" />
                        {health.off_track} bermasalah
                    </span>
                    {health.none > 0 && (
                        <span>{health.none} belum ada update</span>
                    )}
                </span>
            </KpiCard>
            <KpiCard
                label="Milestone 2 minggu ke depan"
                tip={DEFINITIONS.upcoming}
                value={kpis.upcoming_milestones.count}
            >
                <span className="font-mono">
                    {joinDated(kpis.upcoming_milestones.items) || 'Tidak ada'}
                </span>
            </KpiCard>
            <KpiCard
                label="Milestone terlewat"
                tip={DEFINITIONS.missed}
                value={kpis.missed_milestones.count}
                tone="danger"
            >
                {kpis.missed_milestones.items
                    .map((item) => `${item.name} ${item.key}`)
                    .join(' · ') || 'Tidak ada'}
            </KpiCard>
            <KpiCard
                label="Tugas proyek terlambat"
                tip={DEFINITIONS.overdue}
                value={kpis.overdue_tasks.count}
            >
                di {kpis.overdue_tasks.projects} dari{' '}
                {kpis.overdue_tasks.total_projects} proyek
                {kpis.overdue_tasks.top &&
                    ` · terbanyak ${kpis.overdue_tasks.top.key} (${kpis.overdue_tasks.top.count})`}
            </KpiCard>
            <KpiCard
                label="Butuh keputusan Anda"
                tip={DEFINITIONS.decisions}
                value={decisions.length}
                highlight={decisions.length > 0}
            >
                {decisions.length > 0 ? (
                    <a
                        href="#keputusan"
                        className="text-primary hover:underline"
                    >
                        {decisionKeys.length === 1
                            ? `${decisions.length > 1 ? 'Semuanya' : 'Dari'} ${decisionKeys[0]} · lihat di bawah`
                            : `Dari ${decisionKeys.join(', ')} · lihat di bawah`}
                    </a>
                ) : (
                    'Tidak ada keputusan tertunda'
                )}
            </KpiCard>
        </div>
    );
}

function StatusCell({ project }: { project: ProjectRow }) {
    const summaryText = flagSummary(project.metrics);

    return (
        <div className="space-y-1">
            <HealthBadge health={project.health} />
            {summaryText && (
                <p className="flex items-start gap-1 text-[12px] leading-4 text-text-muted">
                    <TriangleAlert
                        aria-hidden
                        className="mt-px size-3 shrink-0 text-danger"
                    />
                    <span>{summaryText}</span>
                </p>
            )}
        </div>
    );
}

/** Desktop project table. */
export function ProjectTable({
    projects,
    today,
}: {
    projects: ProjectRow[];
    today: string;
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-[13px]">
                <thead className="bg-surface-2/60 text-[12px] text-text-muted">
                    <tr>
                        <th scope="col" className="px-4 py-2.5 font-medium">
                            Proyek
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                            PIC
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                            Status
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                            <span className="inline-flex items-center gap-1">
                                Progres <InfoTip text={DEFINITIONS.progress} />
                            </span>
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                            Milestone berikutnya
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                            Target
                        </th>
                        <th
                            scope="col"
                            className="px-3 py-2.5 text-right font-medium"
                        >
                            Terlambat
                        </th>
                        <th scope="col" className="px-4 py-2.5 font-medium">
                            Update terakhir
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {projects.map((project) => {
                        const stale =
                            project.metrics.flags.includes('stale_update');
                        const next = project.next_milestone;

                        return (
                            <tr
                                key={project.id}
                                className="group align-top hover:bg-surface-2/50"
                            >
                                <td className="px-4 py-3">
                                    <Link
                                        href={summary.url(project.key)}
                                        prefetch
                                        className="flex items-start gap-2.5 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    >
                                        <WorkspaceAvatar
                                            name={project.name}
                                            type="project"
                                            color={project.color}
                                            className="mt-0.5 size-6 rounded-md text-xs"
                                        />
                                        <span className="min-w-0">
                                            <span className="block font-medium text-text group-hover:underline">
                                                {project.name}
                                            </span>
                                            <span className="block text-[12px] text-text-muted">
                                                <span className="font-mono">
                                                    {project.key}
                                                </span>
                                                {project.division &&
                                                    ` · ${project.division}`}
                                            </span>
                                        </span>
                                    </Link>
                                </td>
                                <td className="px-3 py-3 text-text">
                                    <PersonChip person={project.lead} />
                                </td>
                                <td className="max-w-52 px-3 py-3">
                                    <StatusCell project={project} />
                                </td>
                                <td className="w-40 px-3 py-3">
                                    <ProgressMeter
                                        actual={project.metrics.actual}
                                        planned={project.metrics.planned}
                                        health={project.health}
                                        className="mt-1.5"
                                    />
                                    <p className="mt-1.5 text-[12px] text-text-muted tnum">
                                        <span className="font-medium text-text">
                                            {percent(project.metrics.actual)}
                                        </span>{' '}
                                        · rencana{' '}
                                        {percent(project.metrics.planned)}
                                    </p>
                                </td>
                                <td className="px-3 py-3">
                                    {next ? (
                                        <>
                                            <p className="text-text">
                                                {next.name}
                                            </p>
                                            <p className="text-[12px] text-text-muted">
                                                {weekdayDay(next.target_date)} ·{' '}
                                                {dueLabel(
                                                    daysBetween(
                                                        today,
                                                        next.target_date,
                                                    ),
                                                )}
                                            </p>
                                        </>
                                    ) : (
                                        <span className="text-text-muted">
                                            –
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-3">
                                    <p className="text-text">
                                        {weekdayDay(project.target_date)}
                                    </p>
                                    <p className="text-[12px] text-text-muted">
                                        {dueLabel(project.metrics.days_left)}
                                    </p>
                                </td>
                                <td
                                    className={cn(
                                        'px-3 py-3 text-right tnum',
                                        project.metrics.overdue > 0
                                            ? 'text-danger'
                                            : 'text-text-muted',
                                    )}
                                >
                                    {project.metrics.overdue}
                                </td>
                                <td className="px-4 py-3">
                                    <p
                                        className={
                                            stale ? 'text-warning' : 'text-text'
                                        }
                                    >
                                        {updateAgeLabel(
                                            project.metrics.update_age_days,
                                        )}
                                    </p>
                                    {project.last_update_at && (
                                        <p className="text-[12px] text-text-muted">
                                            {weekdayDay(
                                                project.last_update_at.slice(
                                                    0,
                                                    10,
                                                ),
                                            )}
                                        </p>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/** Mobile project card (mockup MDashboardDireksi). */
export function ProjectCard({ project }: { project: ProjectRow }) {
    const { metrics } = project;
    const behind = metrics.flags.includes('behind');

    return (
        <Link
            href={summary.url(project.key)}
            prefetch
            className="block space-y-3 rounded-lg border border-border bg-surface p-4 active:bg-surface-2"
        >
            <div className="flex items-start gap-2.5">
                <WorkspaceAvatar
                    name={project.name}
                    type="project"
                    color={project.color}
                    className="size-7 rounded-md text-sm"
                />
                <p className="min-w-0 flex-1 text-[16px] leading-6 font-medium text-text">
                    {project.name}
                </p>
                <span className="font-mono text-[12px] text-text-muted">
                    {project.key}
                </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                <HealthBadge health={project.health} />
                {behind && (
                    <span className="inline-flex h-6 items-center rounded-md border border-border px-1.5 text-[12px] text-text-muted">
                        Tertinggal {Math.abs(Math.round(metrics.variance ?? 0))}{' '}
                        poin
                    </span>
                )}
                {metrics.flags.includes('missed_milestone') && (
                    <span className="inline-flex h-6 items-center gap-1 rounded-md border border-danger/50 px-1.5 text-[12px] text-danger">
                        <TriangleAlert aria-hidden className="size-3" />
                        Milestone terlewat
                    </span>
                )}
                {metrics.flags.includes('stale_update') && (
                    <span className="inline-flex h-6 items-center rounded-md border border-warning/50 px-1.5 text-[12px] text-warning">
                        Update kedaluwarsa
                    </span>
                )}
                {project.sponsor && (
                    <span className="text-[12px] text-text-muted">
                        Sponsor {project.sponsor.name}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-3">
                <ProgressMeter
                    actual={metrics.actual}
                    planned={metrics.planned}
                    health={project.health}
                    className="flex-1"
                />
                <span className="text-[13px] text-text-muted tnum">
                    <span className="font-semibold text-text">
                        {percent(metrics.actual)}
                    </span>{' '}
                    · rencana {percent(metrics.planned)}
                </span>
            </div>
            <div className="space-y-1 text-[14px] text-text-muted">
                {project.next_milestone && (
                    <p>
                        Berikutnya:{' '}
                        <span className="text-text">
                            {project.next_milestone.name}
                        </span>{' '}
                        · {shortDay(project.next_milestone.target_date)}
                    </p>
                )}
                <p className="flex flex-wrap items-center gap-x-2">
                    <span>Target {shortDay(project.target_date)}</span>
                    <span aria-hidden>·</span>
                    <span
                        className={
                            metrics.overdue > 0 ? 'text-danger' : undefined
                        }
                    >
                        {metrics.overdue} terlambat
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1.5">
                        <PersonChip
                            person={project.lead}
                            className="[&>span:last-child]:hidden"
                        />
                        <span
                            className={
                                metrics.flags.includes('stale_update')
                                    ? 'text-warning'
                                    : undefined
                            }
                        >
                            Update{' '}
                            {updateAgeLabel(
                                metrics.update_age_days,
                            ).toLowerCase()}
                        </span>
                    </span>
                </p>
            </div>
        </Link>
    );
}

const MILESTONE_MARK: Record<string, string> = {
    completed: 'bg-text-muted border-text-muted',
    completed_late: 'bg-text-muted border-text-muted',
    missed: 'bg-danger border-danger',
    in_progress: 'bg-surface border-text',
    not_started: 'bg-surface border-text',
};

/** "Linimasa" (Agu–Des): project bars, milestones and the today line. */
export function RoadmapPanel({ roadmap }: { roadmap: Roadmap }) {
    const { from, to, today } = roadmap;
    const todayLeft = positionPercent(today, from, to);
    const range = `${roadmap.months[0]?.label ?? ''} – ${roadmap.months[roadmap.months.length - 1]?.label ?? ''} ${to.slice(0, 4)}`;

    return (
        <Panel
            title={
                <>
                    Linimasa
                    <span className="text-[13px] font-normal text-text-muted">
                        {range}
                    </span>
                </>
            }
            aside={
                <ul className="hidden flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-muted xl:flex">
                    <li className="flex items-center gap-1.5">
                        <span className="h-2 w-4 rounded-sm bg-text-muted/60" />{' '}
                        Sudah berjalan
                    </li>
                    <li className="flex items-center gap-1.5">
                        <span className="h-2 w-4 rounded-sm border border-text-muted/60" />{' '}
                        Sisa durasi
                    </li>
                    <li className="flex items-center gap-1.5">
                        <span className="size-2 rotate-45 bg-text-muted" />{' '}
                        Milestone selesai
                    </li>
                    <li className="flex items-center gap-1.5">
                        <span className="size-2 rotate-45 border border-text" />{' '}
                        Akan datang
                    </li>
                    <li className="flex items-center gap-1.5">
                        <span className="size-2 rotate-45 bg-danger" /> Terlewat
                    </li>
                </ul>
            }
        >
            {roadmap.rows.length === 0 ? (
                <p className="p-4 text-[13px] text-text-muted">
                    Belum ada proyek dengan jadwal.
                </p>
            ) : (
                <div className="overflow-x-auto px-4 pt-2 pb-4">
                    <div className="grid min-w-[860px] grid-cols-[240px_minmax(0,1fr)]">
                        <div />
                        <div className="relative h-8 border-b border-border text-[12px] text-text-muted">
                            {roadmap.months.map((month) => (
                                <span
                                    key={month.start}
                                    className="absolute top-2 border-l border-border pl-1.5"
                                    style={{
                                        left: `${positionPercent(month.start, from, to)}%`,
                                    }}
                                >
                                    {month.label}
                                </span>
                            ))}
                            <span
                                className="absolute top-1 z-10 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-primary-foreground"
                                style={{ left: `${todayLeft}%` }}
                            >
                                Hari ini {shortDay(today)}
                            </span>
                        </div>
                        {roadmap.rows.map((row) => {
                            const tone = row.health
                                ? HEALTH_TONES[row.health]
                                : null;
                            const start = row.start_date ?? today;
                            const end = row.target_date ?? today;
                            const left = positionPercent(start, from, to);
                            const right = positionPercent(end, from, to);
                            const elapsed = Math.min(right, todayLeft);

                            return (
                                <div key={row.id} className="contents">
                                    <Link
                                        href={summary.url(row.key)}
                                        className="flex h-10 items-center gap-2 border-b border-border/60 pr-3 text-[13px] hover:underline"
                                    >
                                        <span
                                            className={cn(
                                                'size-2 shrink-0 rounded-full',
                                                tone?.dot ?? 'bg-text-subtle',
                                            )}
                                        />
                                        <span className="w-10 shrink-0 font-mono text-[12px] text-text-muted">
                                            {row.key}
                                        </span>
                                        <span className="truncate text-text">
                                            {row.name}
                                        </span>
                                    </Link>
                                    <div className="relative h-10 border-b border-border/60">
                                        <span
                                            aria-hidden
                                            className="absolute inset-y-0 z-0 w-px bg-primary/70"
                                            style={{ left: `${todayLeft}%` }}
                                        />
                                        <span
                                            className={cn(
                                                'absolute top-3.5 h-3 rounded-sm border',
                                                tone?.track ??
                                                    'border-border-strong',
                                            )}
                                            style={{
                                                left: `${left}%`,
                                                width: `${Math.max(0.5, right - left)}%`,
                                            }}
                                        />
                                        {elapsed > left && (
                                            <span
                                                className={cn(
                                                    'absolute top-3.5 h-3 rounded-l-sm opacity-70',
                                                    tone?.bar ??
                                                        'bg-text-subtle',
                                                )}
                                                style={{
                                                    left: `${left}%`,
                                                    width: `${elapsed - left}%`,
                                                }}
                                            />
                                        )}
                                        {row.milestones.map((milestone) => (
                                            <span
                                                key={milestone.id}
                                                title={`${milestone.name} · ${shortDay(milestone.target_date)}`}
                                                className={cn(
                                                    'absolute top-[15px] z-10 size-2.5 -translate-x-1/2 rotate-45 border',
                                                    MILESTONE_MARK[
                                                        milestone.status
                                                    ],
                                                )}
                                                style={{
                                                    left: `${positionPercent(milestone.target_date, from, to)}%`,
                                                }}
                                            />
                                        ))}
                                        {row.target_date && (
                                            <span
                                                className="absolute top-3 ml-1.5 text-[11px] whitespace-nowrap text-text-muted"
                                                style={{ left: `${right}%` }}
                                            >
                                                {shortDay(row.target_date)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </Panel>
    );
}

/** "Butuh keputusan Anda" + "Perlu perhatian". */
export function DecisionsPanel({
    decisions,
    attention,
    canSteer,
    actions,
    compact = false,
}: {
    decisions: DecisionItem[];
    attention: AttentionItem[];
    canSteer: boolean;
    actions: PortfolioActions;
    compact?: boolean;
}) {
    return (
        <Panel
            id="keputusan"
            title="Butuh keputusan Anda"
            count={
                <span className="rounded-full bg-primary/12 px-1.5 text-primary">
                    {decisions.length}
                </span>
            }
            aside={
                <span className="text-[12px] text-text-muted">
                    {compact
                        ? `${decisions.length} keputusan · ${attention.length} perhatian`
                        : attention.length > 0 &&
                          `+${attention.length} perlu perhatian`}
                </span>
            }
        >
            {decisions.length === 0 && attention.length === 0 ? (
                <p className="flex items-center gap-2 p-4 text-[13px] text-text-muted">
                    <CircleCheck className="size-4 text-success" aria-hidden />
                    Tidak ada keputusan yang menunggu.
                </p>
            ) : (
                <ul className="divide-y divide-border">
                    {decisions.map((item) => {
                        const project = {
                            key: item.project.key,
                            name: item.project.name,
                        };

                        return (
                            <li key={item.id} className="space-y-2 px-4 py-3.5">
                                <div
                                    className={cn(
                                        'flex gap-3',
                                        compact
                                            ? 'flex-col'
                                            : 'items-start justify-between',
                                    )}
                                >
                                    <div className="min-w-0 space-y-1">
                                        <p className="text-[12px] text-text-muted">
                                            <span className="font-mono">
                                                {item.project.key}
                                            </span>{' '}
                                            · Diminta{' '}
                                            {item.author?.name ?? 'PIC'} ·
                                            update{' '}
                                            {shortDay(
                                                item.created_at.slice(0, 10),
                                            )}
                                        </p>
                                        <p className="text-[15px] font-medium text-text md:text-[14px]">
                                            {item.decision}
                                        </p>
                                        <p className="line-clamp-2 text-[13px] text-text-muted">
                                            {item.summary}
                                        </p>
                                    </div>
                                    {canSteer && (
                                        <div
                                            className={cn(
                                                'flex shrink-0 gap-2',
                                                compact && 'grid grid-cols-2',
                                            )}
                                        >
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-11 md:h-8"
                                                onClick={() =>
                                                    actions.openDirection(
                                                        project,
                                                        item.id,
                                                        item.decision,
                                                    )
                                                }
                                            >
                                                Diskusikan
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="h-11 md:h-8"
                                                disabled={
                                                    actions.resolving ===
                                                    item.id
                                                }
                                                onClick={() =>
                                                    actions.resolve(
                                                        project,
                                                        item.id,
                                                    )
                                                }
                                                title="Setujui dan tandai keputusan selesai"
                                            >
                                                Setujui
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            {attention.length > 0 && (
                <div className="border-t border-border">
                    <p className="px-4 pt-3 text-[11px] font-medium tracking-[.04em] text-text-muted uppercase">
                        Perlu perhatian
                    </p>
                    <ul className="divide-y divide-border">
                        {attention.map((item) => {
                            const missed = item.metrics.missed_milestones[0];
                            const parts = [
                                item.metrics.flags.includes('behind')
                                    ? `Tertinggal ${Math.abs(Math.round(item.metrics.variance ?? 0))} poin`
                                    : null,
                                item.metrics.update_age_days === null
                                    ? 'belum ada update'
                                    : item.metrics.flags.includes(
                                            'stale_update',
                                        )
                                      ? `belum ada update ${item.metrics.update_age_days} hari`
                                      : null,
                                !item.metrics.flags.includes('behind') &&
                                item.health === 'off_track'
                                    ? 'Bermasalah menurut PIC'
                                    : null,
                            ].filter(Boolean);

                            return (
                                <li
                                    key={item.project.id}
                                    className={cn(
                                        'flex gap-3 px-4 py-3.5',
                                        compact
                                            ? 'items-center'
                                            : 'items-start justify-between',
                                    )}
                                >
                                    <div className="min-w-0 space-y-1">
                                        <p className="text-[14px] font-medium text-text">
                                            <span className="mr-1.5 font-mono text-[12px] text-text-muted">
                                                {item.project.key}
                                            </span>
                                            {parts.join(', ')}
                                        </p>
                                        {!compact && (
                                            <p className="text-[13px] text-text-muted">
                                                {missed &&
                                                    `Milestone "${missed.name}" (${shortDay(missed.target_date)}) terlewat. `}
                                                PIC {item.lead?.name ?? '–'}
                                                {item.is_sponsor &&
                                                    '; Anda sponsor proyek ini'}
                                                .
                                            </p>
                                        )}
                                    </div>
                                    {canSteer && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-11 shrink-0 md:h-8"
                                            onClick={() =>
                                                actions.openRequest(
                                                    {
                                                        key: item.project.key,
                                                        name: item.project.name,
                                                    },
                                                    item.lead?.name ?? null,
                                                )
                                            }
                                        >
                                            Minta update
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </Panel>
    );
}

/** "Update terbaru dari PIC". */
export function FeedPanel({
    feed,
    canSteer,
    actions,
    compact = false,
}: {
    feed: FeedItem[];
    canSteer: boolean;
    actions: PortfolioActions;
    compact?: boolean;
}) {
    return (
        <Panel title="Update terbaru dari PIC">
            {feed.length === 0 ? (
                <EmptyState
                    icon={MessageSquare}
                    title="Belum ada update"
                    description="Update mingguan PIC akan muncul di sini."
                />
            ) : (
                <ul className="divide-y divide-border">
                    {feed.map((item) => (
                        <li key={item.id} className="space-y-1.5 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <PersonChip
                                    person={item.author}
                                    className="font-medium text-text"
                                />
                                <Link
                                    href={summary.url(item.project.key)}
                                    className="font-mono text-[12px] text-primary hover:underline"
                                >
                                    {item.project.key}
                                </Link>
                                {compact ? (
                                    <span
                                        className={cn(
                                            'size-1.5 rounded-full',
                                            HEALTH_TONES[item.health].dot,
                                        )}
                                    />
                                ) : (
                                    <HealthBadge
                                        health={item.health}
                                        className="h-5"
                                    />
                                )}
                                <span className="ml-auto text-[12px] text-text-muted">
                                    {formatRelative(item.created_at)}
                                </span>
                                {canSteer && !compact && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() =>
                                            actions.openDirection(
                                                {
                                                    key: item.project.key,
                                                    name: item.project.name,
                                                },
                                                item.id,
                                                item.summary,
                                            )
                                        }
                                    >
                                        <MessageSquare aria-hidden />
                                        Balas
                                    </Button>
                                )}
                            </div>
                            <p
                                className={cn(
                                    'text-[14px] text-text md:text-[13px]',
                                    compact && 'line-clamp-2',
                                )}
                            >
                                {item.summary}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

/** The ONE attendance widget, linking to Dashboard HR. */
export function AttendanceWidget({
    attendance,
    compact = false,
}: {
    attendance: AttendanceSummary;
    compact?: boolean;
}) {
    const total = Math.max(1, attendance.total);
    const href = '/dashboard?view=hr';

    if (compact) {
        return (
            <Link
                href={href}
                className="flex min-h-12 items-center gap-2.5 rounded-lg border border-border bg-surface px-4 text-[14px]"
            >
                <MapPin className="size-4 text-text-muted" aria-hidden />
                <span className="text-text-muted">
                    Hadir hari ini{' '}
                    <span className="font-semibold text-text tnum">
                        {attendance.present}/{attendance.total}
                    </span>
                </span>
                {attendance.not_checked_in > 0 && (
                    <span className="text-warning">
                        {attendance.not_checked_in} belum check-in
                    </span>
                )}
                <ChevronRight
                    className="ml-auto size-4 text-text-subtle"
                    aria-hidden
                />
            </Link>
        );
    }

    return (
        <section className="rounded-lg border border-border bg-surface px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                <span className="text-text-muted">Kehadiran hari ini</span>
                <span className="text-text-muted">
                    <span className="text-[15px] font-semibold text-text tnum">
                        {attendance.present}
                    </span>{' '}
                    dari {attendance.total} hadir
                </span>
                <div className="flex h-1.5 min-w-32 flex-1 gap-0.5 overflow-hidden rounded-full bg-surface-2">
                    <span
                        className="bg-success"
                        style={{
                            width: `${(attendance.present / total) * 100}%`,
                        }}
                    />
                    <span
                        className="bg-info"
                        style={{
                            width: `${(attendance.on_leave / total) * 100}%`,
                        }}
                    />
                </div>
                <span className="text-text-muted">
                    {attendance.on_leave} cuti/izin ·{' '}
                    {attendance.not_checked_in} belum check-in
                </span>
            </div>
            <Link
                href={href}
                className="mt-1.5 inline-block text-[13px] text-primary hover:underline"
            >
                Detail di Dashboard HR
            </Link>
        </section>
    );
}

export function PortfolioFootnote() {
    return (
        <p className="flex items-start gap-1.5 text-[12px] text-text-muted">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            Progres = tugas selesai ÷ total tugas. Rencana = waktu berjalan ÷
            durasi proyek. Status ditetapkan PIC; penanda dari sistem.
        </p>
    );
}
