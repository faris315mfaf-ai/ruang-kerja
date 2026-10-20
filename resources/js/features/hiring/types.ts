/**
 * Props of the Hiring pages (shape of app/Domain/Hiring/Queries/* and the
 * Hiring controllers). Keep in sync with the PHP side.
 */

export type CandidateStage =
    | 'applied'
    | 'screening'
    | 'interview'
    | 'assessment'
    | 'final_review'
    | 'hired'
    | 'rejected';

export type PositionStatus = 'draft' | 'open' | 'closed';

export type CandidateSource = 'google_form' | 'manual';

export type ReviewerRole = 'hr' | 'interviewer' | 'approver';

export type Person = {
    id: string;
    name: string;
    avatar: string | null;
    position: string | null;
};

/** Header of every Hiring page and the card on /workspace. */
export type HiringOverview = {
    can_manage: boolean;
    counts: {
        open_positions: number;
        new_candidates: number;
        awaiting_decision: number;
    };
};

export type PositionOption = {
    id: string;
    title: string;
    status: PositionStatus;
};

export type CandidateCard = {
    id: string;
    full_name: string;
    email: string | null;
    position: { id: string; title: string };
    stage: CandidateStage;
    source: CandidateSource;
    applied_at: string;
    has_cv: boolean;
    checklist: { done: number; total: number };
    awaiting_me: boolean;
};

export type CandidatesPageProps = {
    hiring: HiringOverview;
    positions: PositionOption[];
    candidates: CandidateCard[];
    truncated: boolean;
    filters: { position: string | null; q: string | null };
};

export type ScoreEntry = {
    interviewer: Person | null;
    score: number;
    note: string | null;
};

export type InterviewQuestion = {
    id: string;
    prompt: string;
    guidance: string | null;
    max_score: number;
    answer: string | null;
    my_score: { score: number; note: string | null } | null;
    /** null when the viewer may only see their own points. */
    scores: ScoreEntry[] | null;
    average: number | null;
};

export type ChecklistEntry = {
    id: string;
    label: string;
    role: ReviewerRole;
    required: boolean;
    reviewer: Person | null;
    checked_at: string | null;
    checked_by: Person | null;
    note: string | null;
    can_check: boolean;
    can_delete: boolean;
};

export type NoteEntry = {
    id: string;
    body: string;
    author: Person | null;
    created_at: string | null;
    edited_at: string | null;
    can_edit: boolean;
};

export type DecisionEntry = {
    approver: Person | null;
    decision: 'approve' | 'reject' | null;
    note: string | null;
    decided_at: string | null;
};

export type CandidateInterview = {
    /** UTC ISO, null = not scheduled. */
    at: string | null;
    /** Office time "Y-m-d H:i" (form value). */
    local: string | null;
    location: string | null;
    /** HR / Super Admin while the candidate is before Keputusan akhir. */
    can_schedule: boolean;
};

export type CandidateDetail = {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    cv_url: string | null;
    attachments: { label: string; url: string }[];
    form_answers: { question: string; answer: string }[];
    stage: CandidateStage;
    rejected_reason: string | null;
    source: CandidateSource;
    applied_at: string;
    decided_at: string | null;
    /** Jadwal wawancara (Ruang HR, keputusan pemilik 20 Okt 2026). */
    interview: CandidateInterview;
    position: {
        id: string;
        title: string;
        status: PositionStatus;
        division: string | null;
    };
};

export type CandidateProfileProps = {
    hiring: HiringOverview;
    candidate: CandidateDetail;
    questions: InterviewQuestion[];
    checklist: ChecklistEntry[];
    notes: NoteEntry[];
    decisions: DecisionEntry[];
    reviewers: { interviewers: Person[]; approvers: Person[] };
    can: {
        manage: boolean;
        score: boolean;
        decide: boolean;
        see_all_scores: boolean;
    };
    blockers: { before_final: number; my_approval: number };
    initialTab: string | null;
};

export type PositionRow = {
    id: string;
    title: string;
    status: PositionStatus;
    division: string | null;
    description: string | null;
    opened_at: string | null;
    closed_at: string | null;
    candidates_count: number;
    open_candidates_count: number;
    hired_count: number;
    interviewers_count: number;
    approvers_count: number;
    my_roles: ('interviewer' | 'approver')[];
};

export type DivisionOption = { id: string; name: string };

export type PositionsPageProps = {
    hiring: HiringOverview;
    positions: PositionRow[];
    divisions: DivisionOption[];
};

export type FieldMap = Partial<
    Record<'full_name' | 'email' | 'phone' | 'cv_url', string>
>;

export type PositionSettingsProps = {
    hiring: HiringOverview;
    position: {
        id: string;
        title: string;
        division_id: string | null;
        description: string | null;
        status: PositionStatus;
        interviewer_ids: string[];
        final_approver_ids: string[];
        field_map: FieldMap;
        webhook_url: string;
        candidates_count: number;
    };
    questions: {
        id: string;
        prompt: string;
        guidance: string | null;
        max_score: number;
        locked: boolean;
    }[];
    employees: Person[];
    divisions: DivisionOption[];
};

export type ChecklistTemplateItem = { label: string; required: boolean };

export type ChecklistTemplate = Record<ReviewerRole, ChecklistTemplateItem[]>;

export type HiringSettingsProps = {
    hiring: HiringOverview;
    settings: {
        default_final_approver_ids: string[];
        checklist_template: ChecklistTemplate;
    };
    employees: Person[];
};
