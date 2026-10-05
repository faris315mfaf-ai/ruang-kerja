import { MessageSquare, Pencil, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    HEALTH_LABELS,
    percent,
    shortDay,
    weekdayDay,
} from '@/features/portfolio/lib';
import type {
    ProjectHealth,
    ProjectSummaryProps,
} from '@/features/portfolio/types';
import type { WorkspaceDetail } from '@/features/workspaces/types';
import { WorkspaceAvatar } from '@/features/workspaces/workspace-avatar';
import { DIRECTION_FIELD_ID } from './directions-box';
import { varianceBadge } from './summary-kpis';
import type { ProjectSummaryActions } from './use-project-summary';

type Props = {
    workspace: WorkspaceDetail;
    props: ProjectSummaryProps;
    actions: ProjectSummaryActions;
};

export const HEALTH_BADGE_TONES: Record<ProjectHealth, BadgeTone> = {
    on_track: 'success',
    at_risk: 'warning',
    off_track: 'danger',
};

/** "● Berisiko · kata PIC" (health is the PIC's own assessment). */
function HealthPill({ health }: { health: ProjectHealth | null }) {
    if (health === null) {
        return (
            <Badge variant="status" className="h-[34px]">
                Belum ada update
            </Badge>
        );
    }

    return (
        <Badge
            variant="status"
            tone={HEALTH_BADGE_TONES[health]}
            dot
            className="h-[34px] px-3.5"
        >
            {HEALTH_LABELS[health]} · kata PIC
        </Badge>
    );
}

/** "1 Sep – 27 Okt 2026". */
function period(start: string | null, target: string | null): string {
    if (!start && !target) {
        return 'Jadwal belum diisi';
    }

    return `${shortDay(start)} – ${shortDay(target)} ${target?.slice(0, 4) ?? ''}`.trim();
}

/** Scrolls to the inline "Arahan untuk PIC" box and focuses its field. */
function focusDirection(fallback: () => void) {
    const field = document.getElementById(DIRECTION_FIELD_ID);

    if (!field) {
        fallback();

        return;
    }

    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field.focus({ preventScroll: true });
}

/** Desktop & tablet header (DProyek). */
export function ProjectHeaderDesktop({ workspace, props, actions }: Props) {
    const { project, project_can: can } = props;
    const flags = project.metrics.flags;

    return (
        <header className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-[18px]">
                <WorkspaceAvatar
                    name={workspace.name}
                    type="project"
                    color={workspace.color}
                    tone="gradient"
                    className="size-[68px] rounded-card text-[28px] shadow-glow"
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-h1 font-extrabold tracking-[-0.025em] lg:text-[38px] lg:leading-[46px]">
                            {workspace.name}
                        </h1>
                        <HealthPill health={project.health} />
                        {flags.includes('stale_update') && (
                            <Badge variant="status" tone="warning">
                                Update kedaluwarsa
                            </Badge>
                        )}
                    </div>
                    <p className="text-[17px] text-text-muted">
                        <span className="font-mono text-[15px] font-semibold">
                            {workspace.key}
                        </span>
                        {project.lead && ` · PIC ${project.lead.name}`}
                        {project.sponsor &&
                            ` · Sponsor ${project.sponsor.name}`}
                        {` · ${period(project.start_date, project.target_date)}`}
                        {` · ${workspace.members_count} anggota`}
                    </p>
                </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
                {can.steer && (
                    <>
                        <Button
                            variant="outline"
                            className="h-12 rounded-[14px]"
                            onClick={actions.openRequest}
                        >
                            <RefreshCw aria-hidden /> Minta update
                        </Button>
                        <Button
                            className="h-12 rounded-[14px] font-bold"
                            onClick={() =>
                                focusDirection(() =>
                                    actions.openDirection(null),
                                )
                            }
                        >
                            <MessageSquare aria-hidden /> Beri arahan
                        </Button>
                    </>
                )}
                {can.manage && (
                    <Button
                        className="h-12 rounded-[14px] font-bold"
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

/** Phone hero (MProyek): gradient card with name, health and progress vs plan. */
export function ProjectHeaderMobile({ workspace, props }: Props) {
    const { project } = props;
    const metrics = project.metrics;
    const badge = varianceBadge(metrics);
    const clamp = (value: number | null) =>
        Math.min(100, Math.max(0, value ?? 0));

    return (
        <header className="flex flex-col gap-3.5 rounded-[26px] bg-primary bg-grad-highlight p-5 text-on-brand shadow-glow">
            <div className="flex items-start justify-between gap-2.5">
                <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[14px] font-bold tracking-[0.05em] uppercase">
                        <span className="font-mono">{workspace.key}</span>
                        {project.lead && ` · PIC ${project.lead.name}`}
                    </span>
                    <h1 className="text-h1 font-extrabold">{workspace.name}</h1>
                </div>
                <Badge
                    variant="status"
                    tone={
                        project.health
                            ? HEALTH_BADGE_TONES[project.health]
                            : 'neutral'
                    }
                    className="h-8 text-[14px] font-extrabold"
                >
                    {project.health
                        ? HEALTH_LABELS[project.health]
                        : 'Belum ada update'}
                </Badge>
            </div>
            <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[16px]">
                    <span>
                        Aktual{' '}
                        <b className="text-[20px] tnum">
                            {percent(metrics.actual)}
                        </b>
                    </span>
                    <span>
                        Rencana{' '}
                        <b className="text-[20px] tnum">
                            {percent(metrics.planned)}
                        </b>
                    </span>
                </div>
                <div
                    role="progressbar"
                    aria-label="Progres aktual"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(clamp(metrics.actual))}
                    aria-valuetext={`${percent(metrics.actual)}, rencana ${percent(metrics.planned)}`}
                    className="relative h-3 rounded-full bg-on-brand/25"
                >
                    <div
                        className="h-full rounded-full bg-on-brand"
                        style={{ width: `${clamp(metrics.actual)}%` }}
                    />
                    {metrics.planned !== null && (
                        <span
                            aria-hidden
                            className="absolute -top-1 h-5 w-[3px] -translate-x-1/2 rounded-[2px] bg-marker"
                            style={{ left: `${clamp(metrics.planned)}%` }}
                        />
                    )}
                </div>
                <span className="text-[15px]">
                    {badge ? `${badge.text} · ` : ''}target{' '}
                    {weekdayDay(project.target_date)}
                </span>
            </div>
        </header>
    );
}
