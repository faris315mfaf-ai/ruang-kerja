import type { ProjectSummaryProps } from '@/features/portfolio/types';
import { BurnupPanel } from './burnup-panel';
import { DirectionsBox } from './directions-box';
import { MilestonesPanel } from './milestones-panel';
import { RisksPanel } from './risks-panel';
import { ProgressCard, SummaryKpis } from './summary-kpis';
import { OverduePanel, TeamLoadPanel } from './team-panels';
import { LatestUpdatePanel } from './update-panel';
import type { ProjectSummaryActions } from './use-project-summary';

/**
 * Tab Ringkasan, desktop & tablet (DProyek / TfProyek): flex-wrap rows, so
 * on a tablet the 2:1 columns stack by themselves.
 */
export function SummaryDesktop({
    props,
    actions,
}: {
    props: ProjectSummaryProps;
    actions: ProjectSummaryActions;
}) {
    return (
        <div className="flex flex-col gap-6">
            <section aria-label="Ringkasan" className="flex flex-wrap gap-5">
                <ProgressCard props={props} className="flex-[1.6_1_360px]" />
                <SummaryKpis props={props} cardClassName="flex-[1_1_200px]" />
            </section>
            <div className="flex flex-wrap items-start gap-5">
                <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-5">
                    <BurnupPanel props={props} />
                    <MilestonesPanel
                        props={props}
                        onCreate={() => actions.openMilestone('new')}
                        onEdit={actions.openMilestone}
                    />
                    <OverduePanel props={props} />
                </div>
                <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
                    <LatestUpdatePanel
                        props={props}
                        onWrite={actions.openUpdate}
                        onDiscuss={actions.openDirection}
                        onResolve={actions.resolve}
                        resolving={actions.resolving}
                    />
                    <DirectionsBox props={props} />
                    <RisksPanel
                        props={props}
                        onCreate={() => actions.openRisk('new')}
                        onEdit={actions.openRisk}
                    />
                    <TeamLoadPanel props={props} />
                </div>
            </div>
        </div>
    );
}
