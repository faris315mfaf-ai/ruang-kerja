/**
 * Props of Ruang HR (/hr, keputusan pemilik 20 Okt 2026) in the shapes of
 * App\Http\Controllers\HrHub\HrHubController and App\Domain\HrHub\Queries\*
 * (docs/fitur/ruang-hr.md).
 */
import type { BriefingCardData } from '@/features/briefings/types';
import type { ManagementWorkload } from '@/features/management/types';
import type { DailyMonitoring } from '@/features/monitoring/types';
import type { Note } from '@/features/notes/types';
import type { PersonRef, TodayCounts } from '@/types/dashboard';

export type HubTab =
    | 'ringkasan'
    | 'absensi'
    | 'monitoring'
    | 'penugasan'
    | 'jadwal'
    | 'catatan';

export type HubWorkspace = { id: string; key: string; name: string };

/** Header shared by the six tabs. */
export type Hub = {
    tab: HubTab;
    /** Office date (Y-m-d). */
    today: string;
    /** "Selasa, 20 Oktober 2026". */
    today_label: string;
    workspaces: {
        team: HubWorkspace | null;
        assignments: HubWorkspace | null;
    };
    features: { meetings: boolean; notes: boolean };
};

export type EventKind = 'meeting' | 'interview' | 'leave' | 'holiday';

/** One calendar entry (HrCalendar). */
export type HrEvent = {
    id: string;
    kind: EventKind;
    date: string;
    /** Last day of a multi-day leave, else null. */
    end_date: string | null;
    /** "HH.mm" office time, null = all day. */
    time: string | null;
    title: string;
    subtitle: string | null;
    href: string | null;
};

export type AssignmentStatus =
    | 'not_started'
    | 'in_progress'
    | 'overdue'
    | 'done';

/** One task of "Penugasan HR" (HrAssignments::row). */
export type AssignmentRow = {
    id: string;
    key: string;
    title: string;
    url: string;
    assignees: {
        id: string;
        name: string;
        initials: string;
        avatar: string | null;
    }[];
    assignee_count: number;
    due_date: string | null;
    status: AssignmentStatus;
    status_label: string;
    overdue_days: number;
    checklist: { done: number; total: number };
    completed_at: string | null;
};

export type ActionKind = 'request' | 'password_reset' | 'correction' | 'hiring';

export type ActionItem = {
    kind: ActionKind;
    title: string;
    subtitle: string | null;
    href: string;
    waiting_since: string | null;
};

export type HrSummaryData = {
    kpis: {
        present: number;
        total_scheduled: number;
        late: number;
        not_checked_in: number;
        pending_requests: number;
        pending_requests_overdue: number;
        reports_submitted: number;
        reports_scheduled: number;
        reports_draft: number;
        assignments_open: number;
        assignments_overdue: number;
        agenda_count: number;
    };
    actions: { total: number; items: ActionItem[] };
    agenda: HrEvent[];
    divisions: {
        id: string | null;
        name: string;
        present: number;
        late: number;
        scheduled: number;
    }[];
    assignments: AssignmentRow[];
    notes: {
        id: string;
        title: string;
        updated_by: string | null;
        updated_at: string | null;
    }[];
};

export type HrSummaryProps = {
    hub: Hub;
    channels: string[];
    summary: HrSummaryData;
    briefing: BriefingCardData | null;
};

export type AttendanceDivision = {
    id: string | null;
    name: string;
    scheduled: number;
    present: number;
    late: number;
    away: number;
    not_checked_in: number;
    absent: number;
};

export type HrAttendanceData = {
    date: string;
    counts: TodayCounts;
    shifts: { name: string; count: number }[];
    divisions: AttendanceDivision[];
    review_count: number;
    missing_check_out: {
        date: string;
        count: number;
        items: {
            id: string;
            user: PersonRef;
            shift: string | null;
            check_in_at: string | null;
            status: string;
            can_correct: boolean;
        }[];
    };
    month: {
        from: string;
        needs_correction: number;
        absent: number;
        late: number;
    };
    not_checked_in: {
        count: number;
        items: {
            user: PersonRef & {
                division_id?: string | null;
                division?: string | null;
            };
            shift: string;
            scheduled_start: string;
            minutes_late: number;
        }[];
    };
};

export type PayrollSummary = {
    month: string;
    total: number;
    paid_days: number;
    href: string;
};

export type HrAttendanceProps = {
    hub: Hub;
    channels: string[];
    attendance: HrAttendanceData;
    /** Deferred (undefined while loading); null without payroll.view. */
    payroll?: PayrollSummary | null;
};

export type MonitoringView = 'laporan' | 'beban';

export type HrMonitoringProps = {
    hub: Hub;
    monitoring: {
        date: string;
        today: string;
        view: MonitoringView;
        can_remind: boolean;
    };
    /** Deferred group `laporan`. */
    daily?: DailyMonitoring;
    /** Deferred group `beban`. */
    workload?: ManagementWorkload;
};

export type AssignmentPickers = {
    people: { id: string; name: string; division: string | null }[];
    divisions: { id: string; name: string; people: number }[];
    teams: {
        id: string;
        name: string;
        division: string | null;
        people: number;
    }[];
};

export type HrAssignmentsProps = {
    hub: Hub;
    assignments: {
        workspace: HubWorkspace | null;
        status: AssignmentStatus | null;
        counts: Record<AssignmentStatus | 'all', number>;
        rows: AssignmentRow[];
    };
    /** Deferred group `pemilih`. */
    pickers?: AssignmentPickers;
    limits: { recipients: number; checklist: number };
};

export type HrScheduleProps = {
    hub: Hub;
    calendar: {
        /** "2026-10". */
        month: string;
        from: string;
        to: string;
        today: string;
        days: Record<string, HrEvent[]>;
        week: HrEvent[];
    };
};

export type HrNotesProps = {
    hub: Hub;
    notes: {
        enabled: boolean;
        workspace: HubWorkspace | null;
        items: Note[];
        can_create: boolean;
    };
};
