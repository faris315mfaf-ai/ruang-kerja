import type {
    DailyCounts,
    MissingPerson,
    ReportAuthor,
} from '@/features/monitoring/types';
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
    /** "Laporan tim hari ini" (keputusan pemilik 6 Okt 2026). */
    reports: TeamReports;
    /** Deferred: undefined until loaded (skeleton). */
    metrics?: DivisionMetrics;
};

/** Today's daily reports of the team (DashboardController::teamReports). */
export type TeamReports = {
    date: string;
    totals: DailyCounts & { people: number };
    missing: MissingPerson[];
    reports: {
        id: string;
        user: ReportAuthor;
        submitted_at: string | null;
        items_count: number;
        has_blockers: boolean;
    }[];
};
