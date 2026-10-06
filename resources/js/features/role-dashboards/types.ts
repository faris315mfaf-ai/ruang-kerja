/**
 * SPKD role dashboards (design RoleDesk / RolePhone + Peran*, PeranM*, P*).
 * One data-driven template: every role is a {@link RoleDashboard} config.
 * When the backend lands, a controller sends the same shape as page props.
 */

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
    value: string;
    note: string;
    tone: KpiTone;
};

/** Row of the main list ("Butuh keputusan Anda", "Tiket klien"). */
export type RoleRow = {
    /** Short code shown in the leading tile ("DEP", "P1", "LBR"). */
    tag: string;
    title: string;
    meta: string;
    badge: string;
    tone: Tone;
};

/** Horizontal bar ("Portofolio proyek", "Kapasitas divisi"). */
export type RoleBar = {
    name: string;
    sub: string;
    /** 0–100. */
    value: number;
    /** Planned position 0–100, null when the bar has no plan marker. */
    plan: number | null;
    note: string;
    tone: Exclude<Tone, 'info'>;
};

export type MeetingPlace = 'Meet' | 'Zoom' | 'Ruang' | 'Klien' | 'Tenggat';

export type RoleScheduleItem = {
    time: string;
    day: string;
    title: string;
    place: MeetingPlace;
    meta: string;
};

/** Primary interactive flow of a role (one P* screen each). */
export type RoleFlowKey =
    | 'decision'
    | 'approvals'
    | 'leave-review'
    | 'disposition'
    | 'material-review'
    | 'bug-progress'
    | 'ticket-update'
    | 'uat-run';

export type RoleDashboard = {
    key: RoleKey;
    /** Picker label ("Direktur Utama"). */
    label: string;
    /** Short picker label for phones ("Dirut"). */
    shortLabel: string;
    person: string;
    unit: string;
    title: string;
    greeting: string;
    /** Phone greeting ("Pagi, Pak Hendra"). */
    greetingShort: string;
    subtitle: string;
    /** Attendance chip in the menu bar ("Masuk 07.55"). */
    status: string;
    primaryAction: string;
    secondaryAction: string;
    flow: RoleFlowKey;
    /** Index of the list row that opens the flow (same item), if any. */
    flowRow?: number;
    kpis: RoleKpi[];
    list: { title: string; link: string; rows: RoleRow[] };
    bars: { title: string; note: string; items: RoleBar[] };
    schedule: RoleScheduleItem[];
    side: {
        title: string;
        warm: boolean;
        items: { title: string; meta: string }[];
    };
    phone: {
        hero: { label: string; value: string; note: string };
        tiles: { label: string; value: string; note: string; tone: Tone }[];
        /** [primary flow label, secondary label]. */
        actions: [string, string];
        listTitle: string;
        rows: RoleRow[];
        next: RoleScheduleItem;
    };
};

// ---- Flow data (P* screens) ----

export type DecisionOption = { id: string; title: string; detail: string };

export type DecisionFlow = {
    position: string;
    title: string;
    requester: string;
    submitted: string;
    actual: number;
    planned: number;
    context: string;
    options: DecisionOption[];
};

export type ApprovalItem = {
    id: string;
    tag: string;
    title: string;
    meta: string;
    tone: Tone;
};

export type LeaveCheck = { title: string; meta: string; ok: boolean };

export type LeaveReviewFlow = {
    employee: string;
    role: string;
    month: string;
    /** ISO dates (Mon–Sun weeks) shown in the mini calendar. */
    days: string[];
    leaveDays: string[];
    highlight: string;
    range: string;
    checks: LeaveCheck[];
};

export type DispositionFlow = {
    number: string;
    title: string;
    received: string;
    deadline: string;
    recipients: string[];
    instructions: string[];
    defaultRecipients: number[];
    defaultInstructions: number[];
    note: string;
};

export type ReviewComment = {
    id: string;
    text: string;
    author: string;
    /** Pin position over the preview, % of width/height. */
    x: number;
    y: number;
};

export type MaterialReviewFlow = {
    title: string;
    version: string;
    eyebrow: string;
    headline: string;
    comments: ReviewComment[];
};

export type BugStep = { title: string; meta: string };

export type BugFlow = {
    key: string;
    severity: string;
    title: string;
    steps: BugStep[];
    buttons: string[];
    footers: string[];
    start: number;
    facts: { label: string; value: string; danger?: boolean }[];
};

export type TicketFlow = {
    priority: string;
    number: string;
    title: string;
    meta: string;
    statuses: string[];
    start: number;
    photos: string[];
    log: { time: string; text: string }[];
};

export type UatScenario = { title: string; steps: string[]; expected: string };

export type UatFlow = {
    title: string;
    meta: string;
    total: number;
    passed: number;
    failed: number;
    target: number;
    scenarios: UatScenario[];
};
