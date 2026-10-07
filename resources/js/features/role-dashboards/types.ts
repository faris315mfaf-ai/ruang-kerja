/**
 * Dashboard per jabatan (F3, /peran/{role}; design RoleDesk / RolePhone).
 * One data-driven template filled by App\Domain\RoleDashboards\Queries\RoleDashboardPresenter.
 * Values are raw (numbers, ISO dates) and formatted with lib/format.ts.
 */
import type { RequestDetail, RequestItem } from '@/types/requests';

export const ROLE_KEYS = [
    'dirut',
    'direktur',
    'hr',
    'corsec',
    'marketing',
    'programming',
    'implementer',
    'analis',
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

/** Semantic tone of a row/bar/badge (maps to Arus status tokens). */
export type Tone = 'late' | 'warn' | 'info' | 'ok' | 'neutral';

export type KpiTone = 'highlight' | 'warm' | 'plain';

export type RoleKpi = {
    label: string;
    /** null = not measurable yet (no data). */
    value: number | null;
    /** "25 / 47": shown as a suffix when set. */
    total: number | null;
    unit: 'count' | 'percent';
    note: string;
    tone: KpiTone;
};

/** Row of the main list ("Butuh keputusan Anda", "Tugas terlambat"). */
export type RoleRow = {
    id: string;
    /** Short code in the leading tile ("DEP", "CUT"). */
    tag: string;
    title: string;
    meta: string;
    badge: string;
    tone: Tone;
    /** Link of the row (task, project), when it has no flow. */
    href: string | null;
    /** The row opens the job's task flow for this item. */
    flow: boolean;
    /** Date appended to the meta: relative ("2 hari lalu") or a date. */
    at: { value: string; style: 'relative' | 'date' } | null;
};

/** Horizontal bar ("Portofolio proyek", "Beban kerja tim"). */
export type RoleBar = {
    id: string;
    name: string;
    sub: string;
    /** 0–100. */
    value: number;
    /** Planned position 0–100, null without a plan marker. */
    plan: number | null;
    note: string;
    tone: Exclude<Tone, 'info'>;
    href: string | null;
};

export type ScheduleKind = 'task' | 'milestone' | 'leave';

export type RoleScheduleItem = {
    id: string;
    /** "Y-m-d" (office date). */
    date: string;
    title: string;
    kind: ScheduleKind;
    meta: string;
    href: string | null;
};

export type RoleLink = { label: string; href: string };

/** Primary/secondary action: a link, or (flow = true) the job's task flow. */
export type RoleAction = { label: string; href: string | null; flow: boolean };

export type RoleFlowKey = 'decision' | 'approvals' | 'leave-review';

export type RoleSideItem = { title: string; meta: string; href: string | null };

export type RoleDashboard = {
    role: RoleKey;
    /** Job label ("Direktur Utama"). */
    label: string;
    /** The viewer's own position name. */
    position: string | null;
    /** Division / unit on screen ("Direksi", "Programming"). */
    unit: string;
    subtitle: string;
    flow: RoleFlowKey | null;
    primary: RoleAction | null;
    secondary: RoleAction | null;
    kpis: RoleKpi[];
    list: {
        title: string;
        link: RoleAction | null;
        empty: string;
        rows: RoleRow[];
    };
    bars: { title: string; note: string; empty: string; items: RoleBar[] };
    schedule: {
        title: string;
        link: RoleAction | null;
        empty: string;
        items: RoleScheduleItem[];
    };
    side: {
        title: string;
        warm: boolean;
        empty: string;
        items: RoleSideItem[];
    };
    /** The job's design flow that waits for a new module ("Ditahan"). */
    held: { title: string; description: string } | null;
};

export type RoleOption = { value: RoleKey; label: string; short: string };

export type DivisionOption = { value: string; label: string };

// ---- Flow data (live closure `flow`) ----

export type DecisionItem = {
    id: string;
    project: {
        key: string;
        name: string;
        url: string;
        health: 'on_track' | 'at_risk' | 'off_track' | null;
        health_label: string | null;
        actual: number | null;
        planned: number | null;
        target_date: string | null;
    };
    decision: string;
    summary: string;
    blockers: string | null;
    author: { id: string; name: string; avatar: string | null } | null;
    created_at: string;
    can_resolve: boolean;
};

export type DecisionFlowData = {
    kind: 'decision';
    total: number;
    items: DecisionItem[];
};

export type ApprovalsFlowData = {
    kind: 'approvals';
    total: number;
    items: RequestItem[];
};

export type LeaveReviewFlowData = {
    kind: 'leave-review';
    total: number;
    selected: RequestDetail | null;
    items: RequestItem[];
};

export type RoleFlowData =
    | DecisionFlowData
    | ApprovalsFlowData
    | LeaveReviewFlowData;

export type RoleDashboardPageProps = {
    role: RoleKey;
    roles: RoleOption[];
    divisions: DivisionOption[];
    division: string | null;
    /** Deferred: undefined while loading. */
    dashboard?: RoleDashboard;
    flow: RoleFlowData | null;
};
