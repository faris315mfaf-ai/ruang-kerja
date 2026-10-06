/**
 * Props of /manajemen (App\Http\Controllers\Management\DashboardController,
 * App\Domain\Analytics\Queries\ManagementDashboard).
 */
import type { ActionNote } from '@/features/monitoring/types';
import type { WorkloadRow } from '@/types/dashboard';

export type PeriodKey = 'harian' | 'mingguan' | 'bulanan';

export const PERIOD_KEYS: readonly PeriodKey[] = [
    'harian',
    'mingguan',
    'bulanan',
] as const;

export type DateRange = {
    /** First day, "Y-m-d". */
    from: string;
    /** Last day (inclusive), "Y-m-d". */
    to: string;
    /** "28 Sep – 2 Okt 2026". */
    label: string;
};

export type TodayAttendanceKpi = {
    kind: 'today';
    present: number;
    scheduled: number;
    rate: number | null;
    late: number;
    not_checked_in: number;
};

export type AverageAttendanceKpi = {
    kind: 'average';
    attended: number;
    scheduled: number;
    rate: number | null;
};

export type ChartColumn = {
    key: string;
    /** Axis label: division, "Sen 28", "Mg 40". */
    label: string;
    /** Screen-reader label: "Senin, 28 Sep 2026". */
    full_label: string;
    planned: number;
    done: number;
};

export type OnTimeKpi = {
    value: number | null;
    numerator: number;
    denominator: number;
    previous: number | null;
    delta: number | null;
    previous_range: DateRange;
};

export type PeriodBlock = {
    range: DateRange;
    attendance: TodayAttendanceKpi | AverageAttendanceKpi;
    /** Tasks due in the period (canceled left out) and how many are done. */
    tasks: { done: number; planned: number; rate: number | null };
    /** Harian only: overdue tasks now. */
    overdue: {
        count: number;
        top_division: { name: string; count: number } | null;
    } | null;
    /** Mingguan / bulanan only. */
    on_time: OnTimeKpi | null;
    chart: ChartColumn[];
};

export type AttendanceToday = {
    date: string;
    counts: {
        scheduled: number;
        present: number;
        on_time: number;
        late: number;
        away: number;
        not_checked_in: number;
        absent: number;
    };
    divisions: {
        id: string | null;
        name: string;
        scheduled: number;
        present: number;
    }[];
};

export type ManagementSummary = {
    generated_at: string;
    attendance: AttendanceToday;
    periods: Record<PeriodKey, PeriodBlock>;
};

export type ProjectHealth = 'on_track' | 'at_risk' | 'off_track';

export type ProjectRow = {
    id: string;
    key: string;
    name: string;
    color: string;
    url: string;
    division: string | null;
    lead: string | null;
    health: ProjectHealth | null;
    actual: number | null;
    planned: number | null;
    flags: string[];
    attention: boolean;
    milestone: {
        name: string;
        target_date: string;
        missed: boolean;
        /** Days from today to the target (negative = past). */
        days_left: number;
    } | null;
};

export type MilestoneState = 'done' | 'missed' | 'next' | 'todo';

export type MilestoneItem = {
    id: string;
    name: string;
    target_date: string;
    project: { key: string; name: string; url: string };
    state: MilestoneState;
};

export type ManagementPortfolio = {
    generated_at: string;
    /** Active projects in the viewer's portfolio scope. */
    total: number;
    projects: ProjectRow[];
    attention: {
        count: number;
        items: { key: string; name: string; reason: string }[];
    };
    milestones: {
        /** "Oktober". */
        month: string;
        from: string;
        to: string;
        done: number;
        total: number;
        items: MilestoneItem[];
    };
};

/**
 * Meeting agenda (module "Rapat & notulen", PRD Fase 2). Always empty until
 * that module exists; typed so it can be filled without touching the page.
 */
export type AgendaItem = {
    id: string;
    starts_at: string;
    title: string;
    place: 'meet' | 'zoom' | 'room' | 'client';
    meta: string | null;
    join_url: string | null;
};

/** Meeting minutes (module "Rapat & notulen", PRD Fase 2). */
export type NoteItem = {
    id: string;
    title: string;
    url: string;
    status: 'draft' | 'final';
    meta: string;
    actions_done: number;
    actions_total: number;
};

export type ManagementProps = {
    /** Company short name for the badge ("SPKD"). */
    company: string;
    /** Office date, "Y-m-d". */
    today: string;
    can: { portfolio: boolean };
    agenda: AgendaItem[];
    /** Meeting minutes (module "Rapat & notulen"); empty until it exists. */
    minutes: NoteItem[];
    /** The viewer's own "catatan tindakan" (keputusan pemilik 6 Okt 2026). */
    notes: ActionNote[];
    /** Deferred: undefined until loaded (skeleton). */
    workload?: ManagementWorkload;
    /** Deferred: undefined until loaded (skeleton). */
    summary?: ManagementSummary;
    /** Deferred: undefined until loaded (skeleton). */
    portfolio?: ManagementPortfolio;
};

/** "Beban kerja" (ManagementDashboard::workload). */
export type ManagementWorkload = {
    total: { open: number; overdue: number; people: number };
    divisions: {
        id: string | null;
        name: string;
        open: number;
        overdue: number;
        estimate_hours: number | null;
        people: WorkloadRow[];
    }[];
};
