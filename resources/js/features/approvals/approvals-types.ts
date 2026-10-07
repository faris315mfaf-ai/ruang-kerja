import type { RequestDetail, RequestItem } from '@/types/requests';
import type { DelegationProps } from './delegation-dialog';

/** `disetujui`: approved requests HR may cancel (requests.cancel_approved). */
export type ApprovalTab = 'menunggu' | 'diputus' | 'disetujui';

export type ApprovalsProps = {
    tab: ApprovalTab;
    counts: { menunggu: number; diputus: number };
    /** Shows the "Disetujui" tab (HR / Super Admin). */
    can_cancel_approved?: boolean;
    items: RequestItem[];
    selected: RequestDetail | null;
    scope: string;
    delegations: DelegationProps;
};

/** Tabs shown to the viewer, in order. */
export function approvalTabs(
    canCancelApproved: boolean | undefined,
): ApprovalTab[] {
    return canCancelApproved
        ? ['menunggu', 'diputus', 'disetujui']
        : ['menunggu', 'diputus'];
}

export const APPROVAL_TAB_LABELS: Record<ApprovalTab, string> = {
    menunggu: 'Menunggu',
    diputus: 'Sudah diputus',
    disetujui: 'Disetujui',
};
