import type {
    ApprovalSummary,
    DashboardSharedProps,
    DivisionMetrics,
    TodayAttendance,
} from '@/types/dashboard';

export type DivisionProps = DashboardSharedProps & {
    channels: string[];
    attendance: TodayAttendance;
    approvals: ApprovalSummary;
    /** Deferred: undefined until loaded (skeleton). */
    metrics?: DivisionMetrics;
};
