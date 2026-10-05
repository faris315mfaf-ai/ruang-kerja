/**
 * Dashboard (Sprint 9 part A) payloads as sent by
 * App\Http\Controllers\Dashboard\DashboardController and
 * App\Domain\Analytics\Queries\*. Percentages are 0–100, dates "YYYY-MM-DD"
 * (office calendar), instants ISO-8601 UTC.
 */
import type { AttendanceStatus } from '@/types/attendance';
import type { RequestItem } from '@/types/requests';

export type DashboardViewKey = 'saya' | 'divisi' | 'hr';

export type PeriodPresetKey = 'minggu' | 'bulan' | 'kuartal' | 'kustom';

export type MetricKey =
    | 'completion_rate'
    | 'on_time_rate'
    | 'overdue_tasks'
    | 'workload'
    | 'lead_time'
    | 'attendance_discipline'
    | 'average_lateness';

export type MetricDefinition = {
    label: string;
    definition: string;
    unit: 'percent' | 'count' | 'days' | 'minutes';
};

export type MetricDefinitions = Record<MetricKey, MetricDefinition>;

/** One metric for the current period compared with the previous one. */
export type ComparedMetric = {
    value: number | null;
    numerator: number;
    denominator: number;
    previous: number | null;
    /** Difference of the displayed values (percentage points for rates). */
    delta: number | null;
};

export type PeriodInfo = {
    preset: PeriodPresetKey;
    from: string;
    to: string;
    label: string;
    previous_label: string;
};

export type ComparedPeriods = {
    current: PeriodInfo;
    previous: PeriodInfo;
};

export type PickerItem = {
    key: DashboardViewKey | 'direksi';
    label: string;
    href: string;
    active: boolean;
};

export type DashboardFilterState = {
    periode: PeriodPresetKey;
    dari: string | null;
    sampai: string | null;
    divisi: string | null;
    tim: string | null;
    period: PeriodInfo;
    presets: { value: PeriodPresetKey; label: string }[];
    divisions: { id: string; name: string }[];
    teams: { id: string; name: string; division_id: string }[];
};

export type DashboardSharedProps = {
    view: DashboardViewKey;
    views: PickerItem[];
    filters: DashboardFilterState;
    scope: { label: string; member_count: number };
    definitions: MetricDefinitions;
    today: string;
    exportUrl: string;
};

export type PersonRef = {
    id: string;
    name: string;
    avatar: string | null;
};

export type TaskSummary = {
    id: string;
    key: string;
    title: string;
    url: string;
    workspace: string;
    status_category:
        | 'backlog'
        | 'todo'
        | 'in_progress'
        | 'review'
        | 'done'
        | 'canceled';
    priority: number;
    due_date: string | null;
    days_late: number;
    checklist: { done: number; total: number } | null;
    assignees: PersonRef[];
};

export type TrendPoint = {
    week_start: string;
    label: string;
    value: number | null;
    numerator: number;
    denominator: number;
};

/* ---------------------------------------------------------------- Saya */

export type PersonalMetrics = {
    period: PeriodInfo;
    compared: ComparedPeriods;
    kpis: {
        open_tasks: { value: number; overdue: number };
        completed: ComparedMetric;
        on_time_rate: ComparedMetric;
        completion_rate: ComparedMetric;
        lead_time: ComparedMetric;
    };
    attendance: {
        days: {
            items: {
                date: string;
                status: AttendanceStatus;
                label: string;
                late_minutes: number;
            }[];
            counts: {
                present: number;
                late: number;
                absent: number;
                away: number;
            };
            workdays: number;
        };
        attendance_discipline: ComparedMetric;
        average_lateness: ComparedMetric;
    };
};

export type PersonalLive = {
    profile: { position: string | null; manager: string | null };
    leave_balance: { type: string; remaining: number; year: number } | null;
    requests: RequestItem[];
    /** Live (not cached): "Fokus hari ini". */
    focus: { total: number; items: TaskSummary[] };
    /** Live (not cached): "Minggu ini". */
    week: {
        total: number;
        days: {
            date: string;
            weekday: string;
            day: number;
            count: number;
            open: number;
            is_today: boolean;
        }[];
    };
};

/* ------------------------------------------------- attendance (today) */

export type TodayState =
    | 'present'
    | 'late'
    | 'away'
    | 'not_checked_in'
    | 'absent';

export type TodayPerson = {
    user: PersonRef & { division_id: string | null; division: string | null };
    state: TodayState;
    status: AttendanceStatus | null;
    status_label: string | null;
    late_minutes: number;
    check_in_at: string | null;
    request_type: string | null;
    is_suspicious: boolean;
};

export type TodayCounts = {
    scheduled: number;
    /** Attended, including the late ones. */
    present: number;
    late: number;
    away: number;
    not_checked_in: number;
    absent: number;
    leave: number;
    permit: number;
    sick: number;
    business_trip: number;
};

export type TodayAttendance = {
    date: string;
    counts: TodayCounts;
    shifts: { name: string; count: number }[];
    people: TodayPerson[];
};

/* --------------------------------------------------------------- Divisi */

export type WorkloadRow = {
    user: PersonRef;
    open: number;
    overdue: number;
    estimate_hours: number | null;
};

export type ProjectAtRisk = {
    id: string;
    key: string;
    name: string;
    url: string;
    health: 'on_track' | 'at_risk' | 'off_track' | null;
    health_label: string | null;
    last_update_at: string | null;
    stale: boolean;
    target_date: string | null;
    lead: string | null;
};

export type DivisionMetrics = {
    period: PeriodInfo;
    compared: ComparedPeriods;
    kpis: {
        completion_rate: ComparedMetric;
        on_time_rate: ComparedMetric;
        overdue_tasks: { value: number; people: number; top_person: number };
        lead_time: ComparedMetric;
        attendance_discipline: ComparedMetric;
        average_lateness: ComparedMetric;
    };
    trend: TrendPoint[];
    workload: WorkloadRow[];
    overdue: { total: number; items: TaskSummary[] };
    projects: ProjectAtRisk[];
};

export type ApprovalSummary = { count: number; items: RequestItem[] };

/* ------------------------------------------------------------------- HR */

export type DivisionAttendanceRow = {
    id: string | null;
    name: string;
    scheduled: number;
    present: number;
    late: number;
    away: number;
    not_checked_in: number;
    absent: number;
};

export type HrToday = TodayAttendance & { divisions: DivisionAttendanceRow[] };

export type ReviewItem = {
    id: string;
    user: PersonRef & { division: string | null };
    type: 'check_in' | 'check_out';
    method_label: string;
    occurred_at: string;
    location: string | null;
    accuracy_m: number | null;
    distance_m: number | null;
    flags: { key: string; label: string }[];
    selfie_url: string | null;
};

export type MissingCheckOut = {
    date: string;
    count: number;
    items: {
        id: string;
        user: PersonRef;
        shift: string | null;
        check_in_at: string | null;
        status: AttendanceStatus;
    }[];
};

export type HrRecap = {
    period: PeriodInfo;
    compared: ComparedPeriods;
    kpis: {
        attendance_discipline: ComparedMetric;
        average_lateness: ComparedMetric;
        absent_days: ComparedMetric;
        late_days: ComparedMetric;
    };
    trend: TrendPoint[];
};
