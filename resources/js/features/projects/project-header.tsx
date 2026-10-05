import { CalendarDays, MessageSquare, Pencil, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    dueLabel,
    flagSummary,
    shortDay,
    weekdayDay,
} from '@/features/portfolio/lib';
import { FlagPill, HealthBadge, PersonChip } from '@/features/portfolio/parts';
import type { ProjectSummaryProps } from '@/features/portfolio/types';
import type { WorkspaceDetail } from '@/features/workspaces/types';
import { WorkspaceAvatar } from '@/features/workspaces/workspace-avatar';
import type { ProjectSummaryActions } from './use-project-summary';

type Props = {
    workspace: WorkspaceDetail;
    props: ProjectSummaryProps;
    actions: ProjectSummaryActions;
};

/** Desktop header (mockup ProyekDetail). */
export function ProjectHeaderDesktop({ workspace, props, actions }: Props) {
    const { project, project_can: can } = props;
    const metrics = project.metrics;

    return (
        <header className="flex flex-wrap items-start gap-3">
            <WorkspaceAvatar
                name={workspace.name}
                type="project"
                color={workspace.color}
                className="size-10 rounded-lg text-lg"
            />
            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl leading-7 font-semibold text-text">
                        {workspace.name}
                    </h1>
                    <span className="rounded border border-border px-1.5 font-mono text-[12px] text-text-muted">
                        {workspace.key}
                    </span>
                    <HealthBadge health={project.health} />
                    {metrics.flags.includes('missed_milestone') && (
                        <FlagPill>Milestone terlewat</FlagPill>
                    )}
                    {metrics.flags.includes('behind') && (
                        <FlagPill>
                            Tertinggal{' '}
                            {Math.abs(Math.round(metrics.variance ?? 0))} poin
                        </FlagPill>
                    )}
                    {metrics.flags.includes('stale_update') && (
                        <FlagPill>Update kedaluwarsa</FlagPill>
                    )}
                </div>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-muted">
                    <span className="inline-flex items-center gap-1.5">
                        Sponsor{' '}
                        <PersonChip
                            person={project.sponsor}
                            className="text-text"
                        />
                    </span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1.5">
                        PIC{' '}
                        <PersonChip
                            person={project.lead}
                            className="text-text"
                        />
                    </span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1.5 text-text">
                        <CalendarDays
                            className="size-3.5 text-text-muted"
                            aria-hidden
                        />
                        {shortDay(project.start_date)}{' '}
                        {project.start_date?.slice(0, 4)} →{' '}
                        {shortDay(project.target_date)}{' '}
                        {project.target_date?.slice(0, 4)}
                    </span>
                    {metrics.days_left !== null && (
                        <>
                            <span aria-hidden>·</span>
                            <span className="text-text">
                                {dueLabel(metrics.days_left)}
                            </span>
                        </>
                    )}
                </p>
                <p className="text-[13px] text-text-muted">
                    {workspace.members_count} anggota
                    {project.member_divisions.length > 0 &&
                        ` · ${project.member_divisions.join(', ')}`}
                </p>
            </div>
            <div className="flex shrink-0 gap-2">
                {can.steer && (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={actions.openRequest}
                        >
                            <RefreshCw aria-hidden /> Minta update
                        </Button>
                        <Button
                            size="sm"
                            className="h-9"
                            onClick={() => actions.openDirection(null)}
                        >
                            <MessageSquare aria-hidden /> Beri arahan
                        </Button>
                    </>
                )}
                {can.manage && (
                    <Button
                        size="sm"
                        className="h-9"
                        variant={can.steer ? 'outline' : 'default'}
                        onClick={actions.openUpdate}
                    >
                        <Pencil aria-hidden /> Update proyek
                    </Button>
                )}
            </div>
        </header>
    );
}

/** Mobile header (mockup MProyekDetail): name, badges and the info grid. */
export function ProjectHeaderMobile({ workspace, props }: Props) {
    const { project } = props;
    const metrics = project.metrics;
    const latest = props.updates[0];

    return (
        <header className="-mt-2 space-y-3">
            <div className="flex items-center gap-3">
                <WorkspaceAvatar
                    name={workspace.name}
                    type="project"
                    color={workspace.color}
                    className="size-10 rounded-lg text-lg"
                />
                <div className="min-w-0">
                    <h1 className="text-[20px] leading-7 font-semibold text-text">
                        {workspace.name}
                    </h1>
                    <p className="truncate text-[13px] text-text-muted">
                        {project.division ?? 'Proyek'} ·{' '}
                        {workspace.members_count} anggota dari{' '}
                        {workspace.divisions_count} divisi
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                <HealthBadge health={project.health} />
                {metrics.flags.includes('missed_milestone') && (
                    <FlagPill>Milestone terlewat</FlagPill>
                )}
                {metrics.flags.length > 0 &&
                    !metrics.flags.includes('missed_milestone') && (
                        <FlagPill>{flagSummary(metrics)}</FlagPill>
                    )}
                {latest && (
                    <span className="text-text-muted">
                        Status dari PIC ·{' '}
                        {shortDay(latest.created_at.slice(0, 10))}
                    </span>
                )}
            </div>
            <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-surface text-[14px]">
                <div className="border-r border-b border-border p-3">
                    <dt className="text-[13px] text-text-muted">Sponsor</dt>
                    <dd className="mt-1 text-text">
                        <PersonChip person={project.sponsor} />
                    </dd>
                </div>
                <div className="border-b border-border p-3">
                    <dt className="text-[13px] text-text-muted">PIC</dt>
                    <dd className="mt-1 text-text">
                        <PersonChip person={project.lead} />
                    </dd>
                </div>
                <div className="border-r border-border p-3">
                    <dt className="text-[13px] text-text-muted">Target</dt>
                    <dd className="mt-1 text-text">
                        {shortDay(project.target_date)} ·{' '}
                        <span className="text-text-muted">
                            {dueLabel(metrics.days_left)}
                        </span>
                    </dd>
                </div>
                <div className="p-3">
                    <dt className="text-[13px] text-text-muted">Mulai</dt>
                    <dd className="mt-1 text-text">
                        {weekdayDay(project.start_date)}
                    </dd>
                </div>
            </dl>
        </header>
    );
}
