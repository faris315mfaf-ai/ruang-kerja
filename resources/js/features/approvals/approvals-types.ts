import type { RequestDetail, RequestItem } from '@/types/requests';
import type { DelegationProps } from './delegation-dialog';

export type ApprovalTab = 'menunggu' | 'diputus';

export type ApprovalsProps = {
    tab: ApprovalTab;
    counts: Record<ApprovalTab, number>;
    items: RequestItem[];
    selected: RequestDetail | null;
    scope: string;
    delegations: DelegationProps;
};
