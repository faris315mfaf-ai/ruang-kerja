/**
 * Props of the F2-4 screens. Otomasi, tugas berulang, template and Kinerja
 * saya come from the controllers in app/Http/Controllers/Automation
 * (App\Domain\Automation\Queries); WhatsApp is still a preview on
 * sample data (held). Field names follow docs/DATABASE.md (snake_case, ULID
 * ids, `YYYY-MM-DD` dates, UTC ISO timestamps).
 */
import type { StatusCategory } from '@/features/tasks/types';
import type { PaletteColor } from '@/lib/palette';

export type Person = {
    id: string;
    name: string;
    /** Position shown under the name ("Kepala Divisi Operasional"). */
    title?: string | null;
};

export type WorkspaceRef = {
    id: string;
    key: string;
    name: string;
    color: PaletteColor;
    type?: 'personal' | 'team' | 'division' | 'project';
    /** Owner/admin: may manage rules and workspace templates here. */
    can_manage?: boolean;
    /** Member (not viewer): may create tasks and recurring tasks here. */
    can_edit_tasks?: boolean;
    /** Active members (for assignee / notify pickers). */
    member_ids?: string[];
};

export type LabelRef = {
    id: string;
    name: string;
    color: PaletteColor;
    /** Workspace of a real label; absent on template labels (matched by name). */
    workspace_id?: string;
};

/** Global roles (spatie) that can receive a rule notification. */
export type RoleKey = 'kepala_divisi' | 'hr' | 'direksi' | 'anggota';

// ---------------------------------------------------------------------------
// WhatsApp channel (Fase 2 · notification_preferences.channel = whatsapp)
// ---------------------------------------------------------------------------

export type WhatsappStatus = 'disconnected' | 'verifying' | 'connected';

/** Same keys as NotificationEvent (notification_preferences.event). */
export type NotificationEventKey =
    | 'task.assigned'
    | 'mention'
    | 'task.commented'
    | 'task.due_soon'
    | 'task.overdue'
    | 'request.pending'
    | 'request.decided'
    | 'attendance.check_in_reminder'
    | 'attendance.check_out_reminder'
    | 'digest.daily';

export type EventCategory = 'tasks' | 'requests' | 'attendance' | 'digest';

export type WhatsappEvent = {
    event: NotificationEventKey;
    category: EventCategory;
    label: string;
    description: string;
    /** Current in-app / email preference (read-only here). */
    in_app: boolean;
    email: boolean;
    /** WhatsApp opt-in (notification_preferences row, channel whatsapp). */
    whatsapp: boolean;
    /** High-priority events still go out during quiet hours. */
    high_priority: boolean;
};

export type WhatsappTemplate = {
    event: NotificationEventKey;
    /** Template name registered with the provider. */
    name: string;
    /** Body with {{1}}… placeholders (provider template syntax). */
    body: string;
    /** Sample values for the placeholders, in order. */
    sample: string[];
    /** Quick-reply / URL button label. */
    button: string | null;
};

export type WhatsappSettings = {
    status: WhatsappStatus;
    /** E.164, e.g. +6281234567890; null when not connected. */
    phone: string | null;
    connected_at: string | null;
    quiet_hours: {
        enabled: boolean;
        /** "HH:MM" office time. */
        start: string;
        end: string;
        /** Let high-priority events through during quiet hours. */
        allow_high_priority: boolean;
    };
    events: WhatsappEvent[];
    templates: WhatsappTemplate[];
    provider: {
        /** null = not decided yet (PRD M6, open question 2). */
        name: string | null;
        options: string[];
        sender: string | null;
        daily_limit: number | null;
    };
};

// ---------------------------------------------------------------------------
// Automation rules ("jika … maka …")
// ---------------------------------------------------------------------------

export type RuleTrigger =
    | { type: 'task_moved'; category: StatusCategory | null }
    | { type: 'task_overdue' }
    | { type: 'task_created_with_label'; label_id: string | null };

export type RuleCondition =
    | { type: 'priority'; priority: 1 | 2 | 3 | 4 | null }
    | { type: 'assignee'; user_id: string | null };

export type RuleAction =
    | { type: 'notify'; target: RuleTarget | null }
    | { type: 'assign'; user_id: string | null }
    | { type: 'add_label'; label_id: string | null }
    | { type: 'move_status'; category: StatusCategory | null };

/** Who gets notified: a person or everyone holding a role/position. */
export type RuleTarget =
    | { kind: 'user'; id: string }
    | { kind: 'role'; role: RoleKey }
    | { kind: 'assignees' }
    | { kind: 'watchers' };

export type AutomationRule = {
    id: string;
    name: string;
    workspace_id: string;
    trigger: RuleTrigger;
    condition: RuleCondition | null;
    actions: RuleAction[];
    is_active: boolean;
    last_run_at: string | null;
    run_count: number;
    created_by: string | null;
    /** Owner/admin of the rule's workspace. */
    can_manage: boolean;
};

export type RunResult = 'success' | 'failed' | 'skipped';

export type RuleRun = {
    id: string;
    rule_id: string;
    /** Task the rule ran on ("OPS-112"). */
    task_key: string;
    task_title: string;
    /** null once the task was deleted. */
    task_id?: string | null;
    result: RunResult;
    /** Short Indonesian summary of what happened. */
    detail: string;
    ran_at: string;
};

export type AutomationProps = {
    rules: AutomationRule[];
    /** Runs of the last 7 days (newest first, capped). */
    runs: RuleRun[];
    /** Counts over exactly the last 7 days. */
    stats: { runs_7d: number; success_7d: number; failed_7d: number };
    workspaces: WorkspaceRef[];
    labels: LabelRef[];
    people: Person[];
    /** Server time, ISO (relative times). */
    now: string;
};

// ---------------------------------------------------------------------------
// Recurring tasks
// ---------------------------------------------------------------------------

/** ISO weekday: 1 = Senin … 7 = Minggu (same as shift_assignments.weekdays). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type RecurrencePattern =
    | { kind: 'daily'; weekdays_only: boolean }
    | { kind: 'weekly'; weekdays: Weekday[] }
    | { kind: 'monthly'; day_of_month: number }
    | { kind: 'every_n_weeks'; interval: number; weekdays: Weekday[] };

export type RecurrenceRule = {
    pattern: RecurrencePattern;
    /** YYYY-MM-DD, office date. */
    starts_on: string;
    ends_on: string | null;
};

export type RecurringTask = RecurrenceRule & {
    id: string;
    title: string;
    workspace_id: string;
    assignee_id: string | null;
    priority: 0 | 1 | 2 | 3 | 4;
    is_active: boolean;
    created_count: number;
    last_created_on: string | null;
    /** Creator (still a member) or owner/admin of the workspace. */
    can_manage: boolean;
};

export type RecurringProps = {
    recurring: RecurringTask[];
    workspaces: WorkspaceRef[];
    labels: LabelRef[];
    people: Person[];
    /** Office date today, YYYY-MM-DD. */
    today: string;
};

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type TaskTemplate = {
    id: string;
    /** null = for every workspace of the company. */
    workspace_id: string | null;
    name: string;
    description: string;
    title: string;
    priority: 0 | 1 | 2 | 3 | 4;
    estimate_hours: number | null;
    checklist: string[];
    labels: LabelRef[];
    used_count: number;
    can_manage: boolean;
};

export type TemplateStatus = {
    name: string;
    category: StatusCategory;
    color: PaletteColor;
};

export type WorkspaceTemplate = {
    id: string;
    name: string;
    description: string;
    type: 'team' | 'project';
    statuses: TemplateStatus[];
    labels: LabelRef[];
    used_count: number;
    /** May create a workspace of this type. */
    can_use: boolean;
    can_delete: boolean;
};

export type TemplatesProps = {
    task_templates: TaskTemplate[];
    workspace_templates: WorkspaceTemplate[];
    workspaces: WorkspaceRef[];
    can_create_company_template: boolean;
    /** Workspace types the user may create (team / project). */
    workspace_types: ('team' | 'project')[];
};

// ---------------------------------------------------------------------------
// Kinerja saya (PRD M7 metrics, personal scope)
// ---------------------------------------------------------------------------

export type PeriodKey = '8w' | 'month' | 'quarter';

/** Counts of one period; percentages are derived in performance.ts. */
export type PeriodCounts = {
    label: string;
    /** Tasks with a due date in the period (non-canceled). */
    due: number;
    /** …of which done. */
    done_of_due: number;
    /** Done tasks that had a due date. */
    done_with_due: number;
    /** …of which completed on or before the due date. */
    on_time: number;
    /** Median lead time in days (one decimal); null without done tasks. */
    lead_time: number | null;
    lead_time_samples: number;
    /** Division median lead time (days) for context. */
    division_lead_time: number | null;
    /** Scheduled work days and on-time days. */
    scheduled_days: number;
    on_time_days: number;
    attendance_label: string;
};

export type WeekBucket = {
    /** Monday of the week, YYYY-MM-DD. */
    week_start: string;
    on_time: number;
    late: number;
};

export type OverdueTask = {
    key: string;
    title: string;
    due_date: string;
    url?: string;
};

export type PerformanceProps = {
    person: {
        id: string;
        name: string;
        title: string | null;
        is_self: boolean;
    };
    period: PeriodKey;
    /** "1–7 Okt 2026". */
    period_label: string;
    counts: PeriodCounts;
    /** Monday weeks covering the period. */
    weeks: WeekBucket[];
    by_workspace: { workspace: WorkspaceRef; done: number }[];
    /** Overdue tasks the viewer may open (max 10). */
    overdue: OverdueTask[];
    /** All overdue tasks of the person (also hidden ones). */
    overdue_count: number;
    attendance: {
        label: string;
        on_time_rate: number | null;
        average_check_in: string | null;
    };
};
