/**
 * Laporan progres harian (keputusan pemilik 6 Okt 2026). Shapes produced by
 * App\Domain\Reports\Queries\{ReportPresenter, MyDailyReports, ReportTaskOptions,
 * DailyReportFeed}.
 */

export type ReportStatus = 'missing' | 'draft' | 'submitted';

export type TaskCategory =
    | 'backlog'
    | 'todo'
    | 'in_progress'
    | 'review'
    | 'done'
    | 'canceled';

export type ReportPerson = {
    id: string;
    name: string;
    avatar: string | null;
    position: string | null;
    division: string | null;
};

export type ReportItem = {
    id: string;
    /** null = other work, or a task the reader cannot see. */
    task_id: string | null;
    task_key: string | null;
    /** null when the reader cannot see the task (only the key is shown). */
    task_title: string | null;
    is_task: boolean;
    progress_note: string;
    percent: number | null;
    hours: number | null;
    move_status_id: string | null;
    status_category_after: TaskCategory | null;
};

export type DailyReportData = {
    id: string | null;
    date: string;
    status: ReportStatus;
    submitted_at: string | null;
    updated_at: string | null;
    /** Still the report's own office date (until 23.59). */
    editable: boolean;
    summary: string | null;
    blockers: string | null;
    notes: string | null;
    items_count: number;
    hours: number | null;
    items: ReportItem[];
};

/** Beranda card "Laporan hari ini" (MyDailyReports::status). */
export type TodayReportStatus = {
    date: string;
    status: ReportStatus;
    submitted_at: string | null;
    updated_at: string | null;
    items_count: number;
    locks_at: string;
};

export type ReportStatusColumn = {
    id: string;
    name: string;
    category: TaskCategory;
};

export type ReportTaskOption = {
    id: string;
    key: string;
    title: string;
    workspace: { id: string; key: string; name: string; type: string };
    status: ReportStatusColumn;
    due_date: string | null;
    planned_today: boolean;
    can_move: boolean;
    /** Columns of the workspace ("pindahkan ke"), empty when moving is not allowed. */
    statuses: ReportStatusColumn[];
};

export type ReportHistoryRow = {
    id: string;
    date: string;
    status: Exclude<ReportStatus, 'missing'>;
    submitted_at: string | null;
    summary: string | null;
    has_blockers: boolean;
    items_count: number;
    hours: number | null;
    editable: boolean;
};

export type ReportFeed = {
    date: string;
    counts: {
        total: number;
        submitted: number;
        draft: number;
        missing: number;
    };
    people: {
        user: ReportPerson;
        status: ReportStatus;
        report: DailyReportData | null;
    }[];
};

/** Form state of one row ("Pekerjaan hari ini"). */
export type ReportFormItem = {
    /** Client key (stable while editing). */
    key: string;
    task_id: string | null;
    progress_note: string;
    percent: string;
    hours: string;
    move_status_id: string;
};

export type ReportFormState = {
    summary: string;
    blockers: string;
    notes: string;
    items: ReportFormItem[];
};
