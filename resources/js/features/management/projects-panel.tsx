import { paletteGradient } from '@/lib/palette';
import { Link } from '@inertiajs/react';
import { FolderKanban } from 'lucide-react';
import { cn, focusRing } from '@/lib/utils';
import {
    clampPercent,
    healthPill,
    milestoneWhen,
    progressFill,
    projectOwner,
    TONE_PILL,
    TONE_TEXT,
} from './lib';
import { Panel, PanelLink } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import type { ManagementPortfolio, ProjectRow } from './types';

const GRID =
    'grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_124px] gap-4';

function CodeBadge({
    project,
    small = false,
}: {
    project: ProjectRow;
    small?: boolean;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex shrink-0 items-center justify-center font-extrabold text-on-brand',
                small
                    ? 'size-[34px] rounded-[10px] text-[11px]'
                    : 'size-10 rounded-control text-[12px]',
                paletteGradient(project.color),
            )}
        >
            {project.key}
        </span>
    );
}

/** Actual progress bar with the planned-progress marker. */
function ProgressBar({
    project,
    thin = false,
}: {
    project: ProjectRow;
    thin?: boolean;
}) {
    const actual = clampPercent(project.actual);
    const planned = clampPercent(project.planned);

    return (
        <span
            aria-hidden
            className={cn(
                'relative block rounded-full bg-surface-2',
                thin ? 'h-1.5' : 'h-2.5',
            )}
        >
            {actual !== null && (
                <span
                    className={cn(
                        'absolute inset-y-0 left-0 rounded-full',
                        progressFill(project.health),
                    )}
                    style={{ width: `${actual}%` }}
                />
            )}
            {!thin && planned !== null && (
                <span
                    className="absolute -top-1 h-[18px] w-[3px] -translate-x-1/2 rounded-[2px] bg-marker"
                    style={{ left: `${planned}%` }}
                />
            )}
        </span>
    );
}

function StatusPill({ project }: { project: ProjectRow }) {
    const pill = healthPill(project.health);

    return (
        <span
            className={cn(
                'inline-flex h-[30px] items-center justify-self-start rounded-full px-3 text-[14px] font-extrabold whitespace-nowrap',
                TONE_PILL[pill.tone],
            )}
        >
            {pill.label}
        </span>
    );
}

function MilestoneCell({ project }: { project: ProjectRow }) {
    if (!project.milestone) {
        return (
            <span className="text-[15px] text-text-muted">
                Belum ada milestone
            </span>
        );
    }

    const when = milestoneWhen(project.milestone);

    return (
        <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-bold">
                {project.milestone.name}
            </span>
            <span
                className={cn(
                    'text-[14px] font-semibold',
                    when.late ? 'text-danger' : 'text-text-muted',
                )}
            >
                {when.text}
            </span>
        </span>
    );
}

/** Desktop/tablet: the "Tracking per proyek" table (rows link to the project summary). */
export function ProjectsPanel({
    portfolio,
    canSeePortfolio,
    className,
}: {
    portfolio: ManagementPortfolio;
    /** HR may not open /portofolio: no dead-end link. */
    canSeePortfolio: boolean;
    className?: string;
}) {
    return (
        <Panel
            title="Tracking per proyek"
            action={
                canSeePortfolio ? (
                    <PanelLink href="/portofolio">Semua proyek</PanelLink>
                ) : undefined
            }
            className={cn('pb-2', className)}
            flush
        >
            {portfolio.projects.length === 0 ? (
                <div className="px-6 pb-4 md:px-7">
                    <EmptyState
                        size="sm"
                        icon={FolderKanban}
                        title="Belum ada proyek aktif"
                    >
                        Proyek berjalan yang bisa Anda lihat akan tampil di
                        sini.
                    </EmptyState>
                </div>
            ) : (
                <>
                    <div
                        aria-hidden
                        className={cn(
                            GRID,
                            'bg-background px-6 py-2.5 text-[14px] font-bold text-text-muted md:px-7',
                        )}
                    >
                        <span>Proyek</span>
                        <span>Progres vs rencana</span>
                        <span>Milestone berikutnya</span>
                        <span>Status</span>
                    </div>
                    <ul className="flex flex-col">
                        {portfolio.projects.map((project) => (
                            <li key={project.id}>
                                <Link
                                    href={project.url}
                                    prefetch
                                    className={cn(
                                        GRID,
                                        'items-center border-t border-divider px-6 py-3.5 text-text transition-colors duration-120 ease-brand hover:bg-surface-2/60 md:px-7',
                                        focusRing,
                                        'focus-visible:ring-offset-0 focus-visible:ring-inset',
                                    )}
                                >
                                    <span className="flex min-w-0 items-center gap-3">
                                        <CodeBadge project={project} />
                                        <span className="flex min-w-0 flex-col">
                                            <span className="line-clamp-2 text-[16px] leading-[22px] font-bold">
                                                <span className="sr-only">
                                                    {project.key},{' '}
                                                </span>
                                                {project.name}
                                            </span>
                                            <span className="truncate text-[14px] text-text-muted">
                                                {projectOwner(project)}
                                            </span>
                                        </span>
                                    </span>
                                    <span className="flex min-w-0 flex-col gap-1.5">
                                        <span className="text-[15px] font-extrabold">
                                            <span className="sr-only">
                                                Progres{' '}
                                            </span>
                                            {project.actual === null
                                                ? '–'
                                                : `${clampPercent(project.actual)}%`}{' '}
                                            <span className="font-semibold text-text-muted">
                                                · rencana{' '}
                                                {project.planned === null
                                                    ? '–'
                                                    : `${clampPercent(project.planned)}%`}
                                            </span>
                                        </span>
                                        <ProgressBar project={project} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="sr-only">
                                            Milestone berikutnya:{' '}
                                        </span>
                                        <MilestoneCell project={project} />
                                    </span>
                                    <StatusPill project={project} />
                                </Link>
                            </li>
                        ))}
                    </ul>
                    {portfolio.total > portfolio.projects.length && (
                        <p className="border-t border-divider px-6 pt-3 pb-2 text-[15px] text-text-muted md:px-7">
                            {portfolio.total - portfolio.projects.length} proyek
                            aktif lainnya
                            {canSeePortfolio
                                ? ' ada di Portofolio.'
                                : ' tidak ditampilkan.'}
                        </p>
                    )}
                </>
            )}
        </Panel>
    );
}

/** Phone: compact project list (MgPDashboard "Proyek"). */
export function ProjectsList({
    portfolio,
    canSeePortfolio,
}: {
    portfolio: ManagementPortfolio;
    canSeePortfolio: boolean;
}) {
    return (
        <Panel
            title="Proyek"
            action={
                canSeePortfolio ? (
                    <PanelLink
                        href="/portofolio"
                        label={`Semua proyek (${portfolio.total})`}
                    >
                        Semua {portfolio.total}
                    </PanelLink>
                ) : undefined
            }
            className="py-4"
            bodyClassName="px-4 md:px-4"
        >
            {portfolio.projects.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={FolderKanban}
                    title="Belum ada proyek aktif"
                />
            ) : (
                <ul className="flex flex-col">
                    {portfolio.projects.map((project) => {
                        const pill = healthPill(project.health);

                        return (
                            <li key={project.id}>
                                <Link
                                    href={project.url}
                                    prefetch
                                    className={cn(
                                        'flex min-h-[60px] items-center gap-3 border-t border-divider py-2 text-text',
                                        focusRing,
                                    )}
                                >
                                    <CodeBadge project={project} small />
                                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                                        <span className="flex items-baseline justify-between gap-2">
                                            <span className="truncate text-[16px] font-bold">
                                                {project.name}
                                            </span>
                                            <span
                                                className={cn(
                                                    'text-[15px] font-extrabold',
                                                    TONE_TEXT[pill.tone],
                                                )}
                                            >
                                                {project.actual === null
                                                    ? '–'
                                                    : `${clampPercent(project.actual)}%`}
                                                <span className="sr-only">
                                                    , {pill.label}
                                                </span>
                                            </span>
                                        </span>
                                        <ProgressBar project={project} thin />
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}

export function ProjectsPanelSkeleton({ className }: { className?: string }) {
    return (
        <Panel
            title="Tracking per proyek"
            className={className}
            bodyClassName="gap-3"
        >
            {[0, 1, 2, 3, 4].map((key) => (
                <div key={key} className="flex items-center gap-3">
                    <Skeleton className="size-10" />
                    <Skeleton className="h-10 flex-1" />
                </div>
            ))}
        </Panel>
    );
}
