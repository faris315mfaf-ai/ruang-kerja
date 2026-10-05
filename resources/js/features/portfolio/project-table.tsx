import { Link } from '@inertiajs/react';
import { MetricInfo } from '@/features/dashboard/metric-info';
import { WorkspaceAvatar } from '@/features/workspaces/workspace-avatar';
import { cn, focusRing } from '@/lib/utils';
import { summary } from '@/routes/projects';
import { DEFINITIONS } from './kpi-row';
import {
    daysBetween,
    dueLabel,
    flagSummary,
    HEALTH_LABELS,
    HEALTH_TONES,
    percent,
    shortDay,
    updateAgeLabel,
    weekdayDay,
} from './lib';
import { FlagPill, HealthBadge, PersonChip, ProgressMeter } from './parts';
import type { ProjectRow } from './types';

const TH = 'px-4 py-3 text-[14px] font-bold text-text-muted';

/** Desktop project table (DPortofolio "Proyek aktif"). */
export function ProjectTable({
    projects,
    today,
}: {
    projects: ProjectRow[];
    today: string;
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-left">
                <thead className="bg-background">
                    <tr>
                        <th scope="col" className={cn(TH, 'w-[250px] pl-7')}>
                            Proyek
                        </th>
                        <th scope="col" className={TH}>
                            PIC
                        </th>
                        <th scope="col" className={TH}>
                            Status
                        </th>
                        <th scope="col" className={TH}>
                            <span className="inline-flex items-center gap-1.5">
                                Progres
                                <MetricInfo definition={DEFINITIONS.progress} />
                            </span>
                        </th>
                        <th scope="col" className={TH}>
                            Milestone berikutnya
                        </th>
                        <th scope="col" className={TH}>
                            Target
                        </th>
                        <th scope="col" className={cn(TH, 'text-right')}>
                            Telat
                        </th>
                        <th scope="col" className={cn(TH, 'pr-7')}>
                            Update terakhir
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                    {projects.map((project) => {
                        const stale =
                            project.metrics.flags.includes('stale_update');
                        const next = project.next_milestone;
                        const flags = flagSummary(project.metrics);

                        return (
                            <tr
                                key={project.id}
                                className="group transition-colors duration-120 ease-brand hover:bg-background"
                            >
                                <td className="py-3.5 pr-4 pl-7">
                                    <Link
                                        href={summary.url(project.key)}
                                        prefetch
                                        className={cn(
                                            'flex min-h-14 items-center gap-3.5 rounded-control',
                                            focusRing,
                                        )}
                                    >
                                        <WorkspaceAvatar
                                            name={project.name}
                                            type="project"
                                            color={project.color}
                                            className="size-11 rounded-[13px] text-[17px]"
                                        />
                                        <span className="flex min-w-0 flex-col">
                                            <span className="text-[17px] font-bold group-hover:underline">
                                                {project.name}
                                            </span>
                                            <span className="text-[14px] text-text-muted">
                                                <span className="font-mono font-semibold">
                                                    {project.key}
                                                </span>
                                                {project.division &&
                                                    ` · ${project.division}`}
                                            </span>
                                        </span>
                                    </Link>
                                </td>
                                <td className="px-4 py-3.5 text-[16px] font-medium">
                                    <PersonChip person={project.lead} />
                                </td>
                                <td className="max-w-56 px-4 py-3.5">
                                    <span className="flex flex-col items-start gap-1.5">
                                        <HealthBadge health={project.health} />
                                        {flags && <FlagPill>{flags}</FlagPill>}
                                    </span>
                                </td>
                                <td className="w-52 px-4 py-3.5">
                                    <p className="mb-2 text-[15px] whitespace-nowrap text-text-muted tnum">
                                        <b className="text-[18px] text-text">
                                            {percent(project.metrics.actual)}
                                        </b>{' '}
                                        · rencana{' '}
                                        {percent(project.metrics.planned)}
                                    </p>
                                    <ProgressMeter
                                        actual={project.metrics.actual}
                                        planned={project.metrics.planned}
                                        health={project.health}
                                    />
                                </td>
                                <td className="px-4 py-3.5">
                                    {next ? (
                                        <span className="flex flex-col">
                                            <span className="text-[16px] font-semibold">
                                                {next.name}
                                            </span>
                                            <span className="text-[14px] whitespace-nowrap text-text-muted">
                                                {weekdayDay(next.target_date)} ·{' '}
                                                {dueLabel(
                                                    daysBetween(
                                                        today,
                                                        next.target_date,
                                                    ),
                                                )}
                                            </span>
                                        </span>
                                    ) : (
                                        <span className="text-text-muted">
                                            –
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3.5">
                                    <span className="flex flex-col">
                                        <span className="text-[16px] font-semibold whitespace-nowrap">
                                            {weekdayDay(project.target_date)}
                                        </span>
                                        <span className="text-[14px] whitespace-nowrap text-text-muted">
                                            {dueLabel(
                                                project.metrics.days_left,
                                            )}
                                        </span>
                                    </span>
                                </td>
                                <td
                                    className={cn(
                                        'px-4 py-3.5 text-right text-[18px] font-bold tnum',
                                        project.metrics.overdue > 0
                                            ? 'text-danger'
                                            : 'text-text-muted',
                                    )}
                                >
                                    {project.metrics.overdue}
                                </td>
                                <td className="py-3.5 pr-7 pl-4">
                                    <span className="flex flex-col">
                                        <span
                                            className={cn(
                                                'text-[16px] font-semibold whitespace-nowrap',
                                                stale && 'text-warning',
                                            )}
                                        >
                                            {updateAgeLabel(
                                                project.metrics.update_age_days,
                                            )}
                                        </span>
                                        {project.last_update_at && (
                                            <span className="text-[14px] whitespace-nowrap text-text-muted">
                                                {weekdayDay(
                                                    project.last_update_at.slice(
                                                        0,
                                                        10,
                                                    ),
                                                )}
                                            </span>
                                        )}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

const RING: Record<string, string> = {
    on_track: 'var(--success)',
    at_risk: 'var(--fill-warning)',
    off_track: 'var(--fill-danger)',
};

/**
 * Phone project card (PDirutPortofolio): progress ring, name, next
 * milestone and the status line (health + system flags).
 */
export function ProjectCard({ project }: { project: ProjectRow }) {
    const { metrics } = project;
    const pct = Math.round(metrics.actual ?? 0);
    const flags = flagSummary(metrics);
    const ring = project.health ? RING[project.health] : 'var(--accent-blue)';

    return (
        <Link
            href={summary.url(project.key)}
            prefetch
            className={cn(
                'flex items-center gap-3.5 rounded-card border border-border bg-surface px-3.5 py-3 active:bg-surface-2',
                focusRing,
            )}
        >
            <span
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label={`Progres ${percent(metrics.actual)}, rencana ${percent(metrics.planned)}`}
                className="flex size-14 shrink-0 items-center justify-center rounded-full"
                style={{
                    background: `conic-gradient(${ring} 0 ${pct}%, var(--surface-2) ${pct}% 100%)`,
                }}
            >
                <span className="flex size-11 items-center justify-center rounded-full bg-surface text-[14px] font-extrabold tnum">
                    {metrics.actual === null ? '–' : `${pct}%`}
                </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-baseline gap-2">
                    <span className="truncate text-[16px] font-extrabold">
                        {project.name}
                    </span>
                    <span className="shrink-0 font-mono text-[13px] font-semibold text-text-muted">
                        {project.key}
                    </span>
                </span>
                <span className="truncate text-meta font-normal text-text-muted">
                    {project.next_milestone
                        ? `Berikutnya: ${project.next_milestone.name} · ${shortDay(project.next_milestone.target_date)}`
                        : `Target ${shortDay(project.target_date)}`}
                    {` · rencana ${percent(metrics.planned)}`}
                </span>
                <span
                    className={cn(
                        'truncate text-meta font-extrabold',
                        project.health
                            ? HEALTH_TONES[project.health].text
                            : 'text-text-muted',
                    )}
                >
                    {project.health
                        ? HEALTH_LABELS[project.health]
                        : 'Belum ada update'}
                    {flags && <span className="text-danger"> · {flags}</span>}
                    {metrics.overdue > 0 && (
                        <span className="text-danger">
                            {' '}
                            · {metrics.overdue} terlambat
                        </span>
                    )}
                </span>
            </span>
        </Link>
    );
}
