import type { BadgeTone } from '@/components/ui/badge';
import type {
    CandidateCard,
    CandidateStage,
    ChecklistEntry,
    InterviewQuestion,
    PositionStatus,
    ReviewerRole,
} from './types';

/** Pipeline order (CandidateStage on the server). */
export const STAGES: CandidateStage[] = [
    'applied',
    'screening',
    'interview',
    'assessment',
    'final_review',
    'hired',
    'rejected',
];

export const STAGE_LABELS: Record<CandidateStage, string> = {
    applied: 'Masuk',
    screening: 'Seleksi berkas',
    interview: 'Wawancara',
    assessment: 'Penilaian',
    final_review: 'Keputusan akhir',
    hired: 'Diterima',
    rejected: 'Ditolak',
};

export const STAGE_TONES: Record<CandidateStage, BadgeTone> = {
    applied: 'info',
    screening: 'neutral',
    interview: 'link',
    assessment: 'link',
    final_review: 'warning',
    hired: 'success',
    rejected: 'danger',
};

export const POSITION_STATUS_LABELS: Record<PositionStatus, string> = {
    draft: 'Draf',
    open: 'Dibuka',
    closed: 'Ditutup',
};

export const POSITION_STATUS_TONES: Record<PositionStatus, BadgeTone> = {
    draft: 'neutral',
    open: 'success',
    closed: 'danger',
};

export const ROLE_LABELS: Record<ReviewerRole, string> = {
    hr: 'HR',
    interviewer: 'Pewawancara',
    approver: 'Penyetuju akhir',
};

export const SOURCE_LABELS = {
    google_form: 'Google Form',
    manual: 'Ditambahkan manual',
} as const;

/** Stages HR may pick in "Pindahkan ke…" (Diterima only via the approvers). */
export function manualTargets(current: CandidateStage): CandidateStage[] {
    return STAGES.filter((stage) => stage !== 'hired' && stage !== current);
}

export function isFinal(stage: CandidateStage): boolean {
    return stage === 'hired' || stage === 'rejected';
}

/** Candidates per stage, in pipeline order (board columns, mobile chips). */
export function groupByStage(
    candidates: CandidateCard[],
): Record<CandidateStage, CandidateCard[]> {
    const groups = Object.fromEntries(
        STAGES.map((stage) => [stage, [] as CandidateCard[]]),
    ) as Record<CandidateStage, CandidateCard[]>;

    for (const candidate of candidates) {
        groups[candidate.stage].push(candidate);
    }

    return groups;
}

/**
 * Interview total: sum of the per-question averages over the sum of the
 * maximum points of the questions that have at least one score.
 */
export function scoreTotal(
    questions: InterviewQuestion[],
): { total: number; max: number; scored: number } | null {
    const scored = questions.filter((question) => question.average !== null);

    if (scored.length === 0) {
        return null;
    }

    const total = scored.reduce(
        (sum, question) => sum + (question.average ?? 0),
        0,
    );
    const max = scored.reduce((sum, question) => sum + question.max_score, 0);

    return { total: Math.round(total * 10) / 10, max, scored: scored.length };
}

/** "3,5" (one decimal, Indonesian comma). */
export function formatScore(value: number): string {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(
        value,
    );
}

export type ChecklistGroup = {
    key: string;
    title: string;
    role: ReviewerRole;
    items: ChecklistEntry[];
};

/** HR first, then one group per reviewer (interviewers, then approvers). */
export function groupChecklist(items: ChecklistEntry[]): ChecklistGroup[] {
    const order: ReviewerRole[] = ['hr', 'interviewer', 'approver'];
    const groups = new Map<string, ChecklistGroup>();

    for (const item of [...items].sort(
        (a, b) => order.indexOf(a.role) - order.indexOf(b.role),
    )) {
        const key = `${item.role}:${item.reviewer?.id ?? 'hr'}`;
        const group = groups.get(key) ?? {
            key,
            role: item.role,
            title:
                item.role === 'hr'
                    ? 'HR'
                    : `${item.reviewer?.name ?? 'Pemeriksa'} · ${ROLE_LABELS[item.role]}`,
            items: [],
        };

        group.items.push(item);
        groups.set(key, group);
    }

    return [...groups.values()];
}

export function checklistProgress(items: ChecklistEntry[]): {
    done: number;
    total: number;
} {
    const required = items.filter((item) => item.required);

    return {
        done: required.filter((item) => item.checked_at !== null).length,
        total: required.length,
    };
}

/** Only absolute http(s) links are rendered as anchors. */
export function safeHref(url: string | null | undefined): string | null {
    if (!url) {
        return null;
    }

    try {
        const parsed = new URL(url);

        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
            ? parsed.toString()
            : null;
    } catch {
        return null;
    }
}

export const hiringUrls = {
    index: (filters?: { position?: string | null; q?: string | null }) => {
        const params = new URLSearchParams();

        if (filters?.position) {
            params.set('lowongan', filters.position);
        }

        if (filters?.q) {
            params.set('q', filters.q);
        }

        const query = params.toString();

        return query ? `/hiring?${query}` : '/hiring';
    },
    candidate: (id: string, tab?: string) =>
        `/hiring/kandidat/${id}${tab ? `?tab=${tab}` : ''}`,
    candidates: '/hiring/kandidat',
    stage: (id: string) => `/hiring/kandidat/${id}/tahap`,
    answer: (id: string, question: string) =>
        `/hiring/kandidat/${id}/jawaban/${question}`,
    score: (id: string, question: string) =>
        `/hiring/kandidat/${id}/poin/${question}`,
    checklist: (id: string) => `/hiring/kandidat/${id}/checklist`,
    checklistItem: (item: string) => `/hiring/checklist/${item}`,
    notes: (id: string) => `/hiring/kandidat/${id}/notulensi`,
    note: (note: string) => `/hiring/notulensi/${note}`,
    decision: (id: string) => `/hiring/kandidat/${id}/keputusan`,
    positions: '/hiring/lowongan',
    position: (id: string) => `/hiring/lowongan/${id}`,
    webhook: (id: string) => `/hiring/lowongan/${id}/webhook`,
    questions: (id: string) => `/hiring/lowongan/${id}/pertanyaan`,
    reorder: (id: string) => `/hiring/lowongan/${id}/urutan-pertanyaan`,
    question: (id: string) => `/hiring/pertanyaan/${id}`,
    settings: '/hiring/pengaturan',
} as const;
