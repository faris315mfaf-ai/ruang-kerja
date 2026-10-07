import type {
    ApprovalSummary,
    DashboardSharedProps,
    TodayCounts,
} from '@/types/dashboard';

/**
 * "Absensi hari ini" card of the HR dashboard (HrDashboard::attendanceSummary):
 * numbers only — the lists live in Absensi › Hari ini (keputusan pemilik
 * 6 Okt 2026).
 */
export type HrAttendanceSummary = {
    date: string;
    counts: TodayCounts;
    shifts: { name: string; count: number }[];
    /** Unusual check-ins of the last 7 days not reviewed yet. */
    review_count: number;
    missing_check_out_count: number;
};

export type HrProps = DashboardSharedProps & {
    channels: string[];
    attendance: HrAttendanceSummary;
    pending: ApprovalSummary;
    /** "/hiring" once the Hiring module exists, else null. */
    hiring: string | null;
};
