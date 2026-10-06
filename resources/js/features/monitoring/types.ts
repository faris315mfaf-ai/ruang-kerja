/**
 * Props of the Direksi dashboard (/dashboard/direksi, keputusan pemilik
 * 6 Okt 2026) — App\Domain\Monitoring\Queries\* — and of the "catatan
 * tindakan" shared with /manajemen.
 */
import type { DashboardSharedProps } from '@/types/dashboard';

export type ReportItem = {
    id: string;
    /** Null when the task is not visible to the reader (or work outside a task). */
    task_id: string | null;
    /** Copied task key ("KEU-12"); null for work outside a task. */
    key: string | null;
    /** Only for tasks the reader may see. */
    title: string | null;
    url: string | null;
    workspace: string | null;
    progress_note: string;
    percent: number | null;
    hours: number | null;
    status_category_after: string | null;
};

export type ReportAuthor = {
    id: string;
    name: string;
    avatar: string | null;
    division: string | null;
};

export type MonitoredReport = {
    id: string;
    date: string;
    user: ReportAuthor;
    submitted_at: string | null;
    summary: string | null;
    blockers: string | null;
    items_count: number;
    hours: number | null;
    items: ReportItem[];
    /** Detail endpoint only. */
    notes?: string | null;
};

export type DailyCounts = {
    scheduled: number;
    reported: number;
    draft: number;
    missing: number;
};

export type DailyDivision = DailyCounts & {
    id: string | null;
    name: string;
    people: number;
};

export type MissingPerson = {
    id: string;
    name: string;
    avatar: string | null;
    division: string | null;
    /** Started a report but did not send it. */
    draft: boolean;
};

export type DailyMonitoring = {
    date: string;
    is_today: boolean;
    totals: DailyCounts & { people: number };
    divisions: DailyDivision[];
    missing: MissingPerson[];
    reports: MonitoredReport[];
};

export type DayState = 'reported' | 'draft' | 'missing' | 'off' | 'future';

export type WeekCell = {
    date: string;
    state: DayState;
    items: number;
    hours: number | null;
    report_id: string | null;
};

export type WeekPerson = {
    user: { id: string; name: string; avatar: string | null };
    days: WeekCell[];
    reported_days: number;
    scheduled_days: number;
    hours: number | null;
};

export type WeekDivision = {
    id: string | null;
    name: string;
    expected: number;
    reported: number;
    people: WeekPerson[];
};

export type TopTask = {
    task_id: string;
    key: string | null;
    title: string;
    url: string;
    workspace: string;
    mentions: number;
    people: number;
    hours: number | null;
    last_percent: number | null;
};

export type WeekBlocker = {
    report_id: string;
    date: string;
    user: ReportAuthor;
    text: string;
};

export type WeeklyMonitoring = {
    week: {
        start: string;
        end: string;
        label: string;
        is_current: boolean;
        previous: string;
        /** Null for the running week (no future weeks). */
        next: string | null;
    };
    days: {
        date: string;
        label: string;
        is_today: boolean;
        is_future: boolean;
    }[];
    totals: {
        expected: number;
        reported: number;
        hours: number;
        people_reported: number;
    };
    divisions: WeekDivision[];
    top_tasks: TopTask[];
    blockers: WeekBlocker[];
};

export type ProjectHealth = 'on_track' | 'at_risk' | 'off_track';

export type MonitoredProject = {
    id: string;
    key: string;
    name: string;
    type: string;
    color: string;
    url: string;
    division: string | null;
    lead: { id: string; name: string; avatar: string | null } | null;
    target_date: string | null;
    health: ProjectHealth | null;
    last_update_at: string | null;
    metrics: {
        actual: number | null;
        planned: number | null;
        variance: number | null;
        flags: string[];
        overdue: number;
        update_age_days: number | null;
        days_left: number | null;
    };
    next_milestone: {
        id: string;
        name: string;
        target_date: string;
        status: string;
    } | null;
    week: {
        reports: number;
        people: number;
        tasks: number;
        hours: number | null;
    };
};

export type ProjectMonitoring = {
    total: number;
    projects: MonitoredProject[];
};

export type ActionNote = {
    id: string;
    body: string;
    due_on: string | null;
    done: boolean;
    done_at: string | null;
    overdue: boolean;
    created_at: string | null;
};

export type WorkspaceKind = 'project' | 'division' | 'team';

export type DirectoryWorkspace = {
    id: string;
    key: string;
    name: string;
    type: WorkspaceKind;
    type_label: string;
    color: string;
    url: string;
    members_count: number;
    open_tasks_count: number;
    /** Not a member: read only (keputusan pemilik 6 Okt 2026). */
    view_only: boolean;
    health: ProjectHealth | null;
};

export type DireksiProps = DashboardSharedProps & {
    monitoring: { date: string; week: string; today: string };
    /** Deferred: undefined until loaded (skeleton). */
    daily?: DailyMonitoring;
    weekly?: WeeklyMonitoring;
    projects?: ProjectMonitoring;
    notes: ActionNote[];
    workspaces: DirectoryWorkspace[];
};
