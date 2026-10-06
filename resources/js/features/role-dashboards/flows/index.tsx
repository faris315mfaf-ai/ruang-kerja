import type { ComponentType } from 'react';
import type { RoleFlowKey } from '../types';
import { ApprovalsFlowSheet } from './approvals-flow';
import { BugFlowSheet } from './bug-flow';
import { DecisionFlowSheet } from './decision-flow';
import { DispositionFlowSheet } from './disposition-flow';
import { LeaveReviewFlowSheet } from './leave-review-flow';
import { MaterialReviewFlowSheet } from './material-review-flow';
import type { FlowProps } from './surface';
import { TicketFlowSheet } from './ticket-flow';
import { UatFlowSheet } from './uat-flow';

/** Primary task flow per role (one P* screen each). */
export const ROLE_FLOWS: Record<RoleFlowKey, ComponentType<FlowProps>> = {
    decision: DecisionFlowSheet,
    approvals: ApprovalsFlowSheet,
    'leave-review': LeaveReviewFlowSheet,
    disposition: DispositionFlowSheet,
    'material-review': MaterialReviewFlowSheet,
    'bug-progress': BugFlowSheet,
    'ticket-update': TicketFlowSheet,
    'uat-run': UatFlowSheet,
};
