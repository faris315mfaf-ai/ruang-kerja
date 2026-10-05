import type {
    Person,
    StatusCategory,
    WorkspaceRef,
} from '@/features/tasks/types';

/** Props of /portofolio and the project summary (app/Domain/Projects). */

export type ProjectHealth = 'on_track' | 'at_risk' | 'off_track';

export type ProjectStatus =
    | 'planned'
    | 'active'
    | 'on_hold'
    | 'completed'
    | 'canceled';

export type ProjectFlag = 'behind' | 'missed_milestone' | 'stale_update';

export type MilestoneStatus =
    | 'not_started'
    | 'in_progress'
    | 'completed'
    | 'completed_late'
    | 'missed';

export type MilestoneRef = {
    id: string;
    name: string;
    target_date: string;
    status: MilestoneStatus;
};

export type ProjectMetrics = {
    /** Percent 0–100, null without tasks. */
    actual: number | null;
    planned: number | null;
    variance: number | null;
    uses_estimates: boolean;
    flags: ProjectFlag[];
    overdue: number;
    scope: number;
    done: number;
    update_age_days: number | null;
    days_left: number | null;
    milestones_total: number;
    milestones_done: number;
    missed_milestones: { id: string; name: string; target_date: string }[];
    milestones: MilestoneRef[];
};

export type ProjectRow = WorkspaceRef & {
    division: string | null;
    lead: Person | null;
    sponsor: Person | null;
    start_date: string | null;
    target_date: string | null;
    project_status: ProjectStatus;
    health: ProjectHealth | null;
    last_update_at: string | null;
    completed_at: string | null;
    metrics: ProjectMetrics;
    next_milestone: MilestoneRef | null;
};

export type DatedRef = { key: string; name: string; target_date: string };

export type PortfolioKpis = {
    active: {
        count: number;
        health: Record<ProjectHealth | 'none', number>;
    };
    upcoming_milestones: { count: number; items: DatedRef[] };
    missed_milestones: { count: number; items: DatedRef[] };
    overdue_tasks: {
        count: number;
        projects: number;
        total_projects: number;
        top: { key: string; count: number } | null;
    };
};

export type RoadmapRow = {
    id: string;
    key: string;
    name: string;
    health: ProjectHealth | null;
    start_date: string | null;
    target_date: string | null;
    milestones: MilestoneRef[];
};

export type Roadmap = {
    from: string;
    to: string;
    today: string;
    months: { start: string; label: string }[];
    rows: RoadmapRow[];
};

export type DecisionItem = {
    id: string;
    project: WorkspaceRef;
    decision: string;
    summary: string;
    author: Person | null;
    created_at: string;
    can_resolve: boolean;
};

export type AttentionItem = {
    project: WorkspaceRef;
    lead: Person | null;
    is_sponsor: boolean;
    health: ProjectHealth | null;
    metrics: ProjectMetrics;
};

export type FeedItem = {
    id: string;
    project: WorkspaceRef;
    author: Person | null;
    health: ProjectHealth;
    summary: string;
    created_at: string;
};

export type AttendanceSummary = {
    present: number;
    total: number;
    on_leave: number;
    not_checked_in: number;
};

export type PortfolioFilters = {
    periode: 'kuartal' | 'bulan' | 'semua';
    divisi: string | null;
    status: ProjectHealth | null;
    arsip: boolean;
};

export type Option<T extends string = string> = { value: T; label: string };

export type PortfolioProps = {
    as_of: string;
    period_label: string;
    filters: PortfolioFilters;
    division_options: Option[];
    can: { steer: boolean };
    kpis: PortfolioKpis;
    projects: ProjectRow[];
    completed: (WorkspaceRef & {
        completed_at: string | null;
        quarter: string | null;
    })[];
    roadmap: Roadmap;
    decisions: DecisionItem[];
    attention: AttentionItem[];
    feed: FeedItem[];
    attendance: AttendanceSummary | null;
};

/* Project summary (tab Ringkasan). */

export type TaskRef = {
    id: string;
    code: string;
    title: string;
    status_category: StatusCategory;
    status_color: string | null;
};

export type MilestoneDetail = MilestoneRef & {
    description: string | null;
    completed_at: string | null;
    tasks: TaskRef[];
};

export type Direction = {
    id: string;
    body: string;
    author: Person | null;
    project_update_id: string | null;
    created_at: string;
};

export type ProjectUpdateItem = {
    id: string;
    health: ProjectHealth;
    summary: string;
    blockers: string | null;
    decision_needed: string | null;
    decision_resolved_at: string | null;
    decision_resolved_by: string | null;
    progress_snapshot: number | null;
    planned_snapshot: number | null;
    author: Person | null;
    created_at: string;
    directions: Direction[];
};

export type RiskLevel = 'high' | 'medium' | 'low';

export type RiskItem = {
    id: string;
    title: string;
    level: RiskLevel;
    status: 'open' | 'resolved';
    resolved_at: string | null;
    owner: Person | null;
    task: TaskRef | null;
};

export type BurnupPoint = {
    date: string;
    scope: number | null;
    done: number | null;
};

export type Burnup = {
    start_date: string | null;
    target_date: string | null;
    today: string;
    points: BurnupPoint[];
    initial_scope: number | null;
    recent_pace: number | null;
    required_pace: number | null;
    milestones: MilestoneRef[];
};

export type ProjectSummaryProps = {
    project: ProjectRow & { member_divisions: string[] };
    status_counts: Record<StatusCategory, number>;
    milestones: MilestoneDetail[];
    burnup: Burnup;
    updates: ProjectUpdateItem[];
    risks: RiskItem[];
    overdue_tasks: (TaskRef & {
        due_date: string | null;
        assignee: Person | null;
    })[];
    team_load: {
        members: { person: Person | null; open: number }[];
        idle: number;
        open_total: number;
    };
    directions: Direction[];
    task_options: TaskRef[];
    project_can: { manage: boolean; steer: boolean };
    health_options: Option<ProjectHealth>[];
    risk_level_options: Option<RiskLevel>[];
    today: string;
};
