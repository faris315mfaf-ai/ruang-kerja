import { MessageSquare, Pencil, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { percent, pointsLabel } from '@/features/portfolio/lib';
import { ProgressMeter } from '@/features/portfolio/parts';
import type { ProjectSummaryProps } from '@/features/portfolio/types';
import { cn } from '@/lib/utils';
import {
    BurnupPanel,
    LatestUpdatePanel,
    MilestonesPanel,
    OverduePanel,
    RisksPanel,
    StatusLegend,
    StatusStack,
} from './panels';
import type { ProjectSummaryActions } from './use-project-summary';

/** Tab Ringkasan, mobile (mockup MProyekDetail) with a bottom action bar. */
export function SummaryMobile({
    props,
    actions,
}: {
    props: ProjectSummaryProps;
    actions: ProjectSummaryActions;
}) {
    const { project, project_can: can, status_counts: counts } = props;
    const metrics = project.metrics;
    const hasBar = can.steer || can.manage;

    return (
        <div className={cn('space-y-5', hasBar && 'pb-20')}>
            <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between text-[13px] text-text-muted">
                    <span>Progres aktual</span>
                    <span className="flex items-center gap-1.5">
                        <span
                            aria-hidden
                            className="h-3.5 w-0.5 rounded-full bg-text"
                        />{' '}
                        Rencana {percent(metrics.planned)}
                    </span>
                </div>
                <p className="flex items-center gap-3">
                    <span className="text-[36px] leading-none font-semibold text-text tnum">
                        {percent(metrics.actual)}
                    </span>
                    {metrics.variance !== null && (
                        <span
                            className={cn(
                                'rounded-md px-2 py-0.5 text-[13px]',
                                metrics.variance < 0
                                    ? 'bg-warning/12 text-warning'
                                    : 'bg-success/12 text-success',
                            )}
                        >
                            {pointsLabel(metrics.variance)} dari rencana
                        </span>
                    )}
                </p>
                <ProgressMeter
                    actual={metrics.actual}
                    planned={metrics.planned}
                    health={project.health}
                    className="h-2"
                />
                <dl className="grid grid-cols-3 gap-2 text-[13px]">
                    <div>
                        <dt className="text-text-muted">Tugas selesai</dt>
                        <dd className="text-[17px] font-semibold text-text tnum">
                            {metrics.done}/{metrics.scope}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-text-muted">Terlambat</dt>
                        <dd
                            className={cn(
                                'text-[17px] font-semibold tnum',
                                metrics.overdue > 0
                                    ? 'text-danger'
                                    : 'text-text',
                            )}
                        >
                            {metrics.overdue}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-text-muted">Menuju target</dt>
                        <dd className="text-[17px] font-semibold text-text tnum">
                            {metrics.days_left === null
                                ? '–'
                                : `${Math.max(0, metrics.days_left)} hari`}
                        </dd>
                    </div>
                </dl>
                <StatusStack counts={counts} />
                <StatusLegend counts={counts} />
            </section>

            <BurnupPanel props={props} compact />
            <MilestonesPanel
                props={props}
                onCreate={() => actions.openMilestone('new')}
                onEdit={actions.openMilestone}
                compact
            />
            <LatestUpdatePanel
                props={props}
                onWrite={actions.openUpdate}
                onDiscuss={actions.openDirection}
                onResolve={actions.resolve}
                resolving={actions.resolving}
                compact
            />
            <RisksPanel
                props={props}
                onCreate={() => actions.openRisk('new')}
                onEdit={actions.openRisk}
            />
            <OverduePanel props={props} compact />

            {hasBar && (
                <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 flex gap-3 border-t border-border px-4 py-3">
                    {can.steer ? (
                        <>
                            <Button
                                variant="outline"
                                className="h-12 flex-1 text-[15px]"
                                onClick={actions.openRequest}
                            >
                                <RefreshCw aria-hidden /> Minta update
                            </Button>
                            <Button
                                className="h-12 flex-1 text-[15px]"
                                onClick={() => actions.openDirection(null)}
                            >
                                <MessageSquare aria-hidden /> Beri arahan
                            </Button>
                        </>
                    ) : (
                        <Button
                            className="h-12 flex-1 text-[15px]"
                            onClick={actions.openUpdate}
                        >
                            <Pencil aria-hidden /> Update proyek
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
