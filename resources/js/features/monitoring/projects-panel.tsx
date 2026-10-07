import { Link } from '@inertiajs/react';
import { ChevronRight, FolderKanban } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Panel, PanelLink } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkspaceAvatar } from '@/features/workspaces/workspace-avatar';
import { formatDate, formatNumber } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { HEALTH, variancePoints } from './lib';
import type { MonitoredProject, ProjectMonitoring } from './types';

function HealthBadge({ project }: { project: MonitoredProject }) {
    const health = HEALTH[project.health ?? 'none'];

    return (
        <Badge variant="status" tone={health.tone} dot className="h-7 shrink-0">
            {health.label}
        </Badge>
    );
}

function ProgressLine({ project }: { project: MonitoredProject }) {
    const { actual, planned } = project.metrics;
    const gap = variancePoints(project);

    return (
        <span className="flex min-w-0 flex-col gap-1.5">
            <Progress
                value={actual ?? 0}
                marker={planned ?? undefined}
                markerLabel="rencana"
                label={`Progres ${project.name}`}
                size="sm"
            />
            <span className="text-meta text-text-muted tnum">
                {actual !== null ? `${Math.round(actual)}%` : '–'} aktual ·{' '}
                {planned !== null ? `${Math.round(planned)}%` : '–'} rencana
                {gap !== null && gap !== 0 && (
                    <span
                        className={cn(
                            'font-semibold',
                            gap < 0 ? 'text-danger' : 'text-success',
                        )}
                    >
                        {' '}
                        ({gap > 0 ? '+' : '−'}
                        {Math.abs(gap)} poin)
                    </span>
                )}
            </span>
        </span>
    );
}

function WeekActivity({ project }: { project: MonitoredProject }) {
    const { week } = project;

    if (week.reports === 0) {
        return (
            <span className="text-meta text-text-muted">Belum ada laporan</span>
        );
    }

    return (
        <span className="text-meta text-text-muted tnum">
            <span className="font-bold text-text">{week.reports}</span> laporan
            · {week.people} orang
            {week.hours !== null && ` · ${formatNumber(week.hours)} jam`}
        </span>
    );
}

function Milestone({ project }: { project: MonitoredProject }) {
    const next = project.next_milestone;

    if (!next) {
        return (
            <span className="text-meta text-text-muted">
                Tidak ada milestone
            </span>
        );
    }

    return (
        <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-medium">
                {next.name}
            </span>
            <span
                className={cn(
                    'text-meta',
                    next.status === 'missed'
                        ? 'font-semibold text-danger'
                        : 'text-text-muted',
                )}
            >
                {next.status === 'missed' ? 'Terlewat · ' : ''}
                {formatDate(next.target_date)}
            </span>
        </span>
    );
}

/**
 * Monitoring per proyek (keputusan pemilik 6 Okt 2026): open projects of the
 * portfolio with the PIC's health, actual vs planned progress, next
 * milestone and how much this week's daily reports touched them. Rows link
 * to the project summary; the full portfolio stays at /portofolio.
 */
export function ProjectsPanel({
    projects,
    weekLabel,
    compact = false,
    className,
}: {
    projects?: ProjectMonitoring;
    weekLabel?: string;
    compact?: boolean;
    className?: string;
}) {
    return (
        <Panel
            title={
                <>
                    Monitoring per proyek
                    {projects && (
                        <Badge variant="status" tone="neutral" className="h-7">
                            {projects.total}
                        </Badge>
                    )}
                </>
            }
            action={<PanelLink href="/portofolio">Portofolio</PanelLink>}
            flush={!compact}
            className={cn(compact ? 'py-5' : 'pb-3', className)}
            bodyClassName="gap-3"
        >
            {!projects ? (
                <div
                    className={cn(
                        'flex flex-col gap-3',
                        !compact && 'px-6 md:px-7',
                    )}
                    aria-busy
                >
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                </div>
            ) : projects.projects.length === 0 ? (
                <div className={cn(!compact && 'px-6 md:px-7')}>
                    <EmptyState
                        size="sm"
                        icon={FolderKanban}
                        title="Belum ada proyek aktif"
                    >
                        Proyek berjalan beserta progres dan laporan tim tampil
                        di sini.
                    </EmptyState>
                </div>
            ) : compact ? (
                <ul className="flex flex-col divide-y divide-divider">
                    {projects.projects.map((project) => (
                        <li key={project.id}>
                            <Link
                                href={project.url}
                                className={cn(
                                    'flex flex-col gap-2.5 py-3.5',
                                    focusRing,
                                )}
                            >
                                <span className="flex items-center gap-3">
                                    <WorkspaceAvatar
                                        name={project.name}
                                        type="project"
                                        color={project.color}
                                        tone="gradient"
                                        className="size-9 rounded-[10px] text-[14px]"
                                    />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-[17px] font-semibold">
                                            {project.name}
                                        </span>
                                        <span className="truncate text-meta text-text-muted">
                                            {project.key}
                                            {project.lead &&
                                                ` · PIC ${project.lead.name}`}
                                        </span>
                                    </span>
                                    <HealthBadge project={project} />
                                </span>
                                <ProgressLine project={project} />
                                <span className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                                    <WeekActivity project={project} />
                                    {project.next_milestone && (
                                        <span className="text-meta text-text-muted">
                                            {project.next_milestone.name} ·{' '}
                                            {formatDate(
                                                project.next_milestone
                                                    .target_date,
                                            )}
                                        </span>
                                    )}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="relative overflow-x-auto [contain:inline-size]">
                    <table className="w-full min-w-[860px] text-left">
                        <caption className="sr-only">
                            Proyek berjalan
                            {weekLabel ? `, laporan ${weekLabel}` : ''}
                        </caption>
                        <thead className="bg-background text-[14px] font-bold text-text-muted">
                            <tr>
                                <th scope="col" className="px-6 py-2.5 md:px-7">
                                    Proyek
                                </th>
                                <th scope="col" className="px-3 py-2.5">
                                    Status PIC
                                </th>
                                <th scope="col" className="w-60 px-3 py-2.5">
                                    Progres
                                </th>
                                <th scope="col" className="px-3 py-2.5">
                                    Milestone berikutnya
                                </th>
                                <th scope="col" className="px-3 py-2.5">
                                    Laporan {weekLabel ? 'minggu ini' : ''}
                                </th>
                                <th scope="col" className="w-10 px-3 py-2.5">
                                    <span className="sr-only">Buka</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-divider">
                            {projects.projects.map((project) => (
                                <tr
                                    key={project.id}
                                    className="hover:bg-surface-2/60"
                                >
                                    <th
                                        scope="row"
                                        className="px-6 py-3 font-normal md:px-7"
                                    >
                                        <Link
                                            href={project.url}
                                            className={cn(
                                                'flex min-w-0 items-center gap-3 rounded-sm',
                                                focusRing,
                                            )}
                                        >
                                            <WorkspaceAvatar
                                                name={project.name}
                                                type="project"
                                                color={project.color}
                                                tone="gradient"
                                                className="size-9 rounded-[10px] text-[14px]"
                                            />
                                            <span className="flex min-w-0 flex-col">
                                                <span className="truncate text-[16px] font-semibold">
                                                    {project.name}
                                                </span>
                                                <span className="truncate text-meta text-text-muted">
                                                    <span className="font-mono">
                                                        {project.key}
                                                    </span>
                                                    {project.lead &&
                                                        ` · PIC ${project.lead.name}`}
                                                </span>
                                            </span>
                                        </Link>
                                    </th>
                                    <td className="px-3 py-3">
                                        <HealthBadge project={project} />
                                    </td>
                                    <td className="px-3 py-3">
                                        <ProgressLine project={project} />
                                    </td>
                                    <td className="max-w-56 px-3 py-3">
                                        <Milestone project={project} />
                                    </td>
                                    <td className="px-3 py-3">
                                        <WeekActivity project={project} />
                                    </td>
                                    <td className="px-3 py-3">
                                        <Link
                                            href={project.url}
                                            aria-label={`Buka ringkasan ${project.name}`}
                                            className={cn(
                                                'flex size-9 items-center justify-center rounded-full text-text-subtle hover:bg-surface-2 hover:text-text',
                                                focusRing,
                                            )}
                                        >
                                            <ChevronRight
                                                className="size-5"
                                                aria-hidden
                                            />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Panel>
    );
}
