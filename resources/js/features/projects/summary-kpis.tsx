import { useId } from 'react';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/ui/kpi-card';
import {
    percent,
    shortDay,
    updateAgeLabel,
    weekdayDay,
} from '@/features/portfolio/lib';
import type {
    ProjectMetrics,
    ProjectSummaryProps,
} from '@/features/portfolio/types';
import { cn } from '@/lib/utils';

/** "Tertinggal 13 poin" · "Unggul 4 poin" · "Sesuai rencana" (null without data). */
export function varianceBadge(metrics: ProjectMetrics) {
    if (metrics.variance === null) {
        return null;
    }

    const rounded = Math.round(metrics.variance);

    if (rounded === 0) {
        return { text: 'Sesuai rencana', tone: 'success' as const };
    }

    return rounded < 0
        ? {
              text: `Tertinggal ${Math.abs(rounded)} poin`,
              tone: metrics.flags.includes('behind')
                  ? ('danger' as const)
                  : ('warning' as const),
          }
        : { text: `Unggul ${rounded} poin`, tone: 'success' as const };
}

const RING = { outer: 56, inner: 40 };

/** Two rings: outer = actual (gradient merek), inner = plan (marker). */
function ProgressRing({ actual, planned }: ProjectMetrics) {
    const gradient = useId();
    const outer = 2 * Math.PI * RING.outer;
    const inner = 2 * Math.PI * RING.inner;
    const clamp = (value: number | null) =>
        Math.min(100, Math.max(0, value ?? 0)) / 100;

    return (
        <div className="relative size-[132px] shrink-0">
            <svg
                width="132"
                height="132"
                viewBox="0 0 132 132"
                aria-hidden
                className="-rotate-90"
            >
                <defs>
                    <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="var(--fill-teal)" />
                        <stop offset="1" stopColor="var(--accent-blue)" />
                    </linearGradient>
                </defs>
                <circle
                    cx="66"
                    cy="66"
                    r={RING.outer}
                    fill="none"
                    strokeWidth="14"
                    className="stroke-surface-2"
                />
                {actual !== null && actual > 0 && (
                    <circle
                        cx="66"
                        cy="66"
                        r={RING.outer}
                        fill="none"
                        stroke={`url(#${gradient})`}
                        strokeWidth="14"
                        strokeLinecap="round"
                        strokeDasharray={`${clamp(actual) * outer} ${outer}`}
                    />
                )}
                <circle
                    cx="66"
                    cy="66"
                    r={RING.inner}
                    fill="none"
                    strokeWidth="6"
                    className="stroke-surface-2"
                />
                {planned !== null && planned > 0 && (
                    <circle
                        cx="66"
                        cy="66"
                        r={RING.inner}
                        fill="none"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${clamp(planned) * inner} ${inner}`}
                        className="stroke-marker"
                    />
                )}
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[30px] leading-[34px] font-extrabold tnum">
                    {percent(actual)}
                </span>
                <span className="text-[13px] font-bold text-text-muted">
                    aktual
                </span>
            </span>
        </div>
    );
}

/** "Progres aktual vs rencana" card with the double ring (DProyek). */
export function ProgressCard({
    props,
    className,
}: {
    props: ProjectSummaryProps;
    className?: string;
}) {
    const { metrics } = props.project;
    const counts = props.status_counts;
    const badge = varianceBadge(metrics);

    return (
        <section
            aria-label="Progres aktual vs rencana"
            className={cn(
                'flex min-w-0 flex-wrap items-center gap-6 rounded-panel border border-border bg-surface p-6 shadow-card',
                className,
            )}
        >
            <ProgressRing {...metrics} />
            <div className="flex min-w-0 flex-1 basis-48 flex-col gap-2">
                <h3 className="text-[16px] font-semibold text-text-muted">
                    Progres aktual vs rencana
                </h3>
                <p className="text-title font-normal">
                    <b>{percent(metrics.actual)}</b> aktual ·{' '}
                    <b>{percent(metrics.planned)}</b> rencana
                </p>
                {badge && (
                    <Badge
                        variant="status"
                        tone={badge.tone}
                        className="h-[30px] text-[15px]"
                    >
                        {badge.text}
                    </Badge>
                )}
                <p className="text-label font-normal text-text-muted">
                    {metrics.done} dari {metrics.scope} tugas selesai
                    {metrics.uses_estimates &&
                        ' (berbobot jam estimasi)'} ·{' '}
                    {counts.review} review · {counts.in_progress} dikerjakan ·{' '}
                    {counts.todo} todo · {counts.backlog} backlog. Cincin luar =
                    aktual, cincin dalam = rencana.
                </p>
            </div>
        </section>
    );
}

/** Milestone terlewat · Tugas terlambat · Sisa waktu (DProyek KPI row). */
export function SummaryKpis({
    props,
    cardClassName,
}: {
    props: ProjectSummaryProps;
    cardClassName?: string;
}) {
    const { project } = props;
    const metrics = project.metrics;
    const missed = metrics.missed_milestones;
    const open = Math.max(0, metrics.scope - metrics.done);

    return (
        <>
            <KpiCard
                className={cardClassName}
                label="Milestone terlewat"
                value={missed.length}
                valueClassName={missed.length > 0 ? 'text-danger' : undefined}
                note={
                    missed.length > 0
                        ? `${missed.map((item) => item.name).join(', ')}, sejak ${shortDay(missed[0].target_date)}`
                        : `${metrics.milestones_done} dari ${metrics.milestones_total} milestone selesai`
                }
            />
            <KpiCard
                className={cardClassName}
                label="Tugas terlambat"
                value={metrics.overdue}
                valueClassName={metrics.overdue > 0 ? 'text-danger' : undefined}
                note={`dari ${open} tugas terbuka`}
            />
            <KpiCard
                className={cardClassName}
                label="Sisa waktu"
                value={
                    metrics.days_left === null
                        ? '–'
                        : Math.max(0, metrics.days_left)
                }
                suffix={metrics.days_left === null ? undefined : 'hari'}
                note={`target ${weekdayDay(project.target_date)} · update ${updateAgeLabel(metrics.update_age_days).toLowerCase()}`}
            />
        </>
    );
}

/** 2×2 tiles on the phone (MProyek "Milestone terlewat · Tugas terlambat"). */
export function SummaryTiles({ props }: { props: ProjectSummaryProps }) {
    const metrics = props.project.metrics;
    const tiles = [
        {
            label: 'Milestone terlewat',
            value: metrics.missed_milestones.length,
            alarm: metrics.missed_milestones.length > 0,
        },
        {
            label: 'Tugas terlambat',
            value: metrics.overdue,
            alarm: metrics.overdue > 0,
        },
        {
            label: 'Tugas selesai',
            value: `${metrics.done}/${metrics.scope}`,
            alarm: false,
        },
        {
            label: 'Sisa waktu',
            value:
                metrics.days_left === null
                    ? '–'
                    : `${Math.max(0, metrics.days_left)} hari`,
            alarm: false,
        },
    ];

    return (
        <dl className="grid grid-cols-2 gap-2.5">
            {tiles.map((tile) => (
                <div
                    key={tile.label}
                    className="flex flex-col gap-0.5 rounded-[18px] border border-border bg-surface p-3.5"
                >
                    <dt className="text-meta font-semibold text-text-muted">
                        {tile.label}
                    </dt>
                    <dd
                        className={cn(
                            'text-kpi font-extrabold tnum',
                            tile.alarm && 'text-danger',
                        )}
                    >
                        {tile.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
