import { MessageSquare, Pencil, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { weekdayDay } from '@/features/portfolio/lib';
import type { ProjectSummaryProps } from '@/features/portfolio/types';
import { cn } from '@/lib/utils';
import { BurnupPanel } from './burnup-panel';
import { DirectionsBox } from './directions-box';
import { milestoneTaskPercent, MilestonesPanel } from './milestones-panel';
import { RisksPanel } from './risks-panel';
import { SummaryTiles } from './summary-kpis';
import { OverduePanel } from './team-panels';
import { LatestUpdatePanel } from './update-panel';
import type { ProjectSummaryActions } from './use-project-summary';

/** "Milestone berikutnya" card (MProyek). */
function NextMilestone({ props }: { props: ProjectSummaryProps }) {
    const next = props.milestones.find(
        (milestone) =>
            milestone.status === 'in_progress' ||
            milestone.status === 'not_started',
    );

    if (!next) {
        return null;
    }

    const pct = milestoneTaskPercent(next);

    return (
        <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
            <h2 className="text-overline text-text-muted">
                Milestone berikutnya
            </h2>
            <p className="text-title font-bold">{next.name}</p>
            <p className="flex items-center gap-2.5 text-label font-normal text-text-muted">
                {pct !== null && (
                    <Progress
                        value={pct}
                        size="sm"
                        label={`Tugas milestone ${next.name} selesai`}
                        className="flex-1"
                    />
                )}
                <span className="shrink-0">{weekdayDay(next.target_date)}</span>
            </p>
        </section>
    );
}

/** Tab Ringkasan, phone (MProyek / MgPMilestone) with a bottom action bar. */
export function SummaryMobile({
    props,
    actions,
}: {
    props: ProjectSummaryProps;
    actions: ProjectSummaryActions;
}) {
    const can = props.project_can;
    const hasBar = can.steer || can.manage;

    return (
        <div className={cn('flex flex-col gap-3.5', hasBar && 'pb-24')}>
            <SummaryTiles props={props} />
            <NextMilestone props={props} />
            <LatestUpdatePanel
                props={props}
                onWrite={actions.openUpdate}
                onDiscuss={actions.openDirection}
                onResolve={actions.resolve}
                resolving={actions.resolving}
            />
            <MilestonesPanel
                props={props}
                onCreate={() => actions.openMilestone('new')}
                onEdit={actions.openMilestone}
                compact
            />
            <BurnupPanel props={props} compact />
            <RisksPanel
                props={props}
                onCreate={() => actions.openRisk('new')}
                onEdit={actions.openRisk}
            />
            <OverduePanel props={props} compact />
            {!can.steer && <DirectionsBox props={props} />}

            {hasBar && (
                <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 flex gap-2.5 border-t border-border px-4 pt-3.5 pb-3.5">
                    {can.steer ? (
                        <>
                            <Button
                                variant="outline"
                                size="lg"
                                className="flex-1"
                                onClick={actions.openRequest}
                            >
                                <RefreshCw aria-hidden /> Minta update
                            </Button>
                            <Button
                                size="lg"
                                className="flex-[1.2]"
                                onClick={() => actions.openDirection(null)}
                            >
                                <MessageSquare aria-hidden /> Beri arahan
                            </Button>
                        </>
                    ) : (
                        <Button
                            size="lg"
                            className="flex-1"
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
