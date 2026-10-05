import { usePage } from '@inertiajs/react';
import type { ProjectSummaryProps } from '@/features/portfolio/types';
import {
    BurnupPanel,
    DirectionsBox,
    LatestUpdatePanel,
    MilestonesPanel,
    OverduePanel,
    RisksPanel,
    SummaryKpis,
    TeamLoadPanel,
} from './panels';
import type { ProjectSummaryActions } from './use-project-summary';

/** Tab Ringkasan, desktop (mockup ProyekDetail). */
export function SummaryDesktop({
    props,
    actions,
}: {
    props: ProjectSummaryProps;
    actions: ProjectSummaryActions;
}) {
    const { auth } = usePage().props;

    return (
        <div className="space-y-5">
            <SummaryKpis props={props} />
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
                <div className="min-w-0 space-y-5">
                    <BurnupPanel props={props} />
                    <MilestonesPanel
                        props={props}
                        onCreate={() => actions.openMilestone('new')}
                        onEdit={actions.openMilestone}
                    />
                    <OverduePanel props={props} />
                    <DirectionsBox
                        props={props}
                        currentUser={
                            auth.user
                                ? {
                                      name: auth.user.name,
                                      avatar: auth.user.avatar,
                                  }
                                : null
                        }
                    />
                </div>
                <div className="min-w-0 space-y-5">
                    <LatestUpdatePanel
                        props={props}
                        onWrite={actions.openUpdate}
                        onDiscuss={actions.openDirection}
                        onResolve={actions.resolve}
                        resolving={actions.resolving}
                    />
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
