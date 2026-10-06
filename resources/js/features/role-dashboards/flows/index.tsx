import type { RoleFlowData, RoleKey } from '../types';
import { ApprovalsFlowSheet } from './approvals-flow';
import { DecisionFlowSheet } from './decision-flow';
import { LeaveReviewFlowSheet } from './leave-review-flow';
import type { FlowProps } from './surface';

/**
 * The job's task flow (one P* screen each). Only three jobs have one today:
 * Dirut (project decisions), Direktur (approvals) and HR (leave review). The
 * other jobs' flows wait for new modules and show a "Ditahan" card instead.
 */
export function RoleFlowSheet({
    role,
    flow,
    selectedId,
    loading,
    onSelect,
    ...props
}: FlowProps & {
    role: RoleKey;
    flow: RoleFlowData;
    selectedId: string | null;
    loading: boolean;
    onSelect: (id: string) => void;
}) {
    switch (flow.kind) {
        case 'decision':
            return (
                <DecisionFlowSheet
                    {...props}
                    role={role}
                    data={flow}
                    selectedId={selectedId}
                    onSelect={onSelect}
                />
            );
        case 'approvals':
            return <ApprovalsFlowSheet {...props} role={role} data={flow} />;
        case 'leave-review':
            return (
                <LeaveReviewFlowSheet
                    {...props}
                    role={role}
                    data={flow}
                    loading={loading}
                    onSelect={onSelect}
                />
            );
    }
}
