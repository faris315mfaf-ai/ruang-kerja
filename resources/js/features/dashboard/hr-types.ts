import type {
    ApprovalSummary,
    DashboardSharedProps,
    HrRecap,
    HrToday,
    MissingCheckOut,
    ReviewItem,
} from '@/types/dashboard';

export type HrProps = DashboardSharedProps & {
    channels: string[];
    attendance: HrToday;
    review: { count: number; items: ReviewItem[] };
    pending: ApprovalSummary;
    missingCheckOut: MissingCheckOut;
    /** Deferred: undefined until loaded (skeleton). */
    recap?: HrRecap;
};
