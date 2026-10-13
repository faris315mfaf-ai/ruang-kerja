/** Shapes produced by App\Http\Presenters\RequestPresenter and the request controllers. */

export type RequestCategory =
    | 'leave'
    | 'permit'
    | 'sick'
    | 'overtime'
    | 'correction'
    | 'business_trip'
    /** Pengajuan barang (keputusan pemilik 6 Okt 2026). */
    | 'procurement';

export type RequestStatus =
    | 'draft'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'revision_requested'
    | 'canceled';

export type ApprovalStatus =
    | 'queued'
    | 'waiting'
    | 'approved'
    | 'rejected'
    | 'revision_requested'
    | 'skipped';

export type ApproverType = 'direct_manager' | 'division_head' | 'role' | 'user';

export type Person = {
    id: string;
    name: string;
    avatar: string | null;
    position?: string | null;
    division?: string | null;
};

export type LeaveTypeInfo = {
    id: string;
    code: string;
    name: string;
    category: RequestCategory;
    category_label: string;
    description: string | null;
    annual_quota_days: number | null;
    requires_attachment_after_days: number | null;
    allow_half_day: boolean;
    max_backdate_days: number | null;
    is_paid: boolean;
    /*
     * Fitur pengajuan; always sent by RequestPresenter::type(), optional so
     * older fixtures/partial shapes stay valid.
     */
    /** Duration counted in calendar days (Cuti melahirkan). */
    counts_calendar_days?: boolean;
    max_days_per_request?: number | null;
    /** "hari kalender" · "hari kerja" · "hari". */
    day_unit?: string;
    /** Seeded default not yet reviewed by HR ("Bawaan sementara"). */
    is_provisional_default?: boolean;
    /** Locked by HR: cannot be requested (cuti & lembur, keputusan pemilik 6 Okt 2026). */
    locked?: boolean;
    locked_reason?: string | null;
    /*
     * Batas pengajuan di hari-H (keputusan pemilik 14 Okt 2026), only sakit and
     * izin: "HH:MM" office time, null = no cutoff. `submit_closed_today` comes
     * from the server clock.
     */
    submit_cutoff_time?: string | null;
    /** "Batas pengajuan hari ini pukul 12.00". */
    submit_cutoff_label?: string | null;
    submit_closed_today?: boolean;
};

export type BalanceSummary = {
    id: string | null;
    year: number;
    entitled: number;
    carried_over: number;
    /** "Saldo awal" set by HR / import. */
    opening: number;
    /** Σ HR adjustments (may be negative). */
    adjustments: number;
    used: number;
    pending: number;
    total: number;
    available: number;
    remaining: number;
};

export type RequestPayload = {
    half_day?: boolean;
    mode?: 'hours' | 'days';
    date?: string;
    start_time?: string;
    end_time?: string;
    check_in?: string | null;
    check_out?: string | null;
    destination?: string | null;
    /* Pengajuan barang */
    item_name?: string;
    quantity?: number;
    unit?: string;
    /** Estimated unit price, whole rupiah. */
    unit_price?: number;
    /** quantity × unit_price. */
    total?: number;
    reference_url?: string | null;
    urgency?: 'biasa' | 'mendesak';
};

export type ColleagueAbsence = {
    group: string | null;
    size: number;
    people: { id: string; name: string; dates: string[] }[];
};

export type RequestItem = {
    id: string;
    number: string | null;
    status: RequestStatus;
    status_label: string;
    type: LeaveTypeInfo;
    user: Person;
    start_at: string;
    end_at: string;
    days: number | null;
    minutes: number | null;
    payload: RequestPayload;
    round: number;
    step_position: number | null;
    step_count: number;
    waiting: {
        label: string;
        approver: Person | null;
        since: string | null;
    } | null;
    decision_note: {
        status: ApprovalStatus;
        note: string | null;
        by: string | null;
        at: string | null;
    } | null;
    submitted_at: string | null;
    created_at: string | null;
    updated_at: string | null;
    decided_at: string | null;
    /** Approval queue only. */
    colleagues?: ColleagueAbsence | null;
    /** "Sudah diputus" only. */
    my_decision?: {
        status: ApprovalStatus;
        status_label: string;
        note: string | null;
        decided_at: string | null;
    };
};

export type TimelineStep = {
    id: string;
    round: number;
    current_round: boolean;
    step_order: number;
    label: string;
    approver_type: ApproverType;
    status: ApprovalStatus;
    status_label: string;
    approver: Person | null;
    delegated_from: Person | null;
    note: string | null;
    activated_at: string | null;
    decided_at: string | null;
};

export type RequestAttachment = {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    url: string;
};

export type RequestDetail = RequestItem & {
    reason: string;
    /** Sick request seen by a substitute approver: reason & attachments withheld. */
    health_details_hidden?: boolean;
    substitute: Person | null;
    attachments: RequestAttachment[];
    timeline: TimelineStep[];
    balance: {
        year: number;
        before: number;
        after: number;
        summary: BalanceSummary;
    } | null;
    colleagues: ColleagueAbsence | null;
    /** Set when the status is `canceled`. */
    cancellation?: RequestCancellation | null;
    /** What canceling this approved request changes (HR with `can.cancel_approved` only). */
    cancel_preview?: CancelPreview | null;
    can: {
        edit: boolean;
        cancel: boolean;
        decide: boolean;
        /** HR / Super Admin may void this approved request. */
        cancel_approved?: boolean;
    };
};

export type RequestCancellation = {
    by: Person | null;
    by_requester: boolean;
    at: string | null;
    /** HR's reason (null when canceled by the requester or hidden for health privacy). */
    reason: string | null;
    after_approval: boolean;
};

export type CancelPreview = {
    /** Days given back to the leave balance (null: type without a quota). */
    refund_days: number | null;
    balance_year: number | null;
    attendance: {
        /** Absence rows without a check-in that are removed (Y-m-d). */
        removed_dates: string[];
        /** Days worked anyway: kept as ordinary attendance. */
        unlinked_dates: string[];
        overtime_date: string | null;
        correction_date: string | null;
        blocker: string | null;
    };
    /** Touched dates that already passed (closed again: no check-in = Alpha). */
    past_dates: string[];
    /** Why the cancel would be refused (corrected day changed since). */
    blocker: string | null;
    reason_min: number;
    reason_max: number;
};

export type PlannedStep = {
    step_order: number;
    approver_type: ApproverType;
    label: string;
    role: string | null;
    status: ApprovalStatus;
    approver: Person | null;
    delegated_from: Person | null;
    note: string | null;
};

export type RequestPreview = {
    period: {
        start_at: string;
        end_at: string;
        days: number | null;
        minutes: number | null;
        work_dates: string[];
    } | null;
    errors: Record<string, string> | null;
    /** Why sending is refused (same-day cutoff); a draft can still be saved. */
    send_blocked?: string | null;
    balance: {
        year: number;
        summary: BalanceSummary;
        before: number;
        after: number;
        enough: boolean;
    } | null;
    overlap: string | null;
    colleagues: ColleagueAbsence | null;
    flow: PlannedStep[];
    attachment_required: boolean;
};

export type FormLeaveType = LeaveTypeInfo & {
    eligible: boolean;
    balance: BalanceSummary | null;
};

export type FormCategory = {
    value: RequestCategory;
    label: string;
    slug: string;
    types: FormLeaveType[];
};

export type BalanceCard = {
    type: LeaveTypeInfo;
    kind: 'balance' | 'ineligible' | 'info';
    year: number;
    balance: BalanceSummary | null;
    pending_request: {
        id: string;
        start_at: string;
        end_at: string;
        days: number | null;
    } | null;
};

export type Delegation = {
    id: string;
    delegate: Person;
    starts_on: string;
    ends_on: string;
    reason: string | null;
    active: boolean;
};
