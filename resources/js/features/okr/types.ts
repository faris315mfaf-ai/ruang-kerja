/**
 * OKR per division per quarter (Fase 3, docs/DATABASE.md §8 `objectives` /
 * `key_results` / `key_result_checkins` / `key_result_tasks`). Props sent by
 * App\Domain\Okr\Queries\{OkrIndex,ObjectiveDetail} (OkrPresenter).
 */

import type { StatusCategory } from '@/features/tasks/types';

export type PersonRef = { id: string; name: string };

export type DivisionRef = { id: string; name: string; code: string };

/** "2026-Q4". */
export type QuarterKey = `${number}-Q${1 | 2 | 3 | 4}`;

/** Computed status (progress vs share of the quarter passed). */
export type OkrStatus = 'on_track' | 'at_risk' | 'behind';

/** Life cycle of an objective (closed = read-only). */
export type ObjectiveStatus = 'draft' | 'active' | 'closed';

export type KrUnit = 'number' | 'percent' | 'currency' | 'days';

/** Weekly progress check-in of a key result (append-only). */
export type KrCheckin = {
    id: string;
    key_result_id: string;
    /** Office date of the check-in (ISO "2026-10-05"). */
    date: string;
    value: number;
    /** 1–10, how sure the owner is the target will be reached. */
    confidence: number | null;
    note: string | null;
    author: PersonRef;
};

/** Task linked to a key result (`key_result_tasks`). */
export type LinkedTask = {
    id: string;
    /** "SIM-388". */
    key: string;
    title: string;
    status_category: StatusCategory;
    assignee: PersonRef | null;
    due_date: string | null;
    /** "/w/OPS/tasks/12". */
    url?: string;
};

export type KeyResultAbilities = {
    update: boolean;
    checkin: boolean;
    link_task: boolean;
    delete: boolean;
};

export type KeyResult = {
    id: string;
    objective_id: string;
    title: string;
    unit: KrUnit;
    /** Unit label shown after numbers ("skenario", "%", "hari"). */
    unit_label: string;
    start_value: number;
    target_value: number;
    current_value: number;
    /** Relative weight in the objective (1–100). */
    weight: number;
    owner: PersonRef;
    /** Detail page only (empty on the list). Only tasks the viewer can see. */
    tasks: LinkedTask[];
    /** Detail page only (empty on the list), oldest first. */
    checkins: KrCheckin[];
    /** Detail page only. */
    can?: KeyResultAbilities;
};

export type ObjectiveAbilities = {
    update: boolean;
    close: boolean;
    add_key_result: boolean;
};

export type Objective = {
    id: string;
    company_id: string;
    division: DivisionRef;
    quarter: QuarterKey;
    title: string;
    description: string | null;
    owner: PersonRef;
    status: ObjectiveStatus;
    key_results: KeyResult[];
    created_at: string;
    updated_at: string;
    /** Detail page only. */
    can?: ObjectiveAbilities;
};

/** Person offered as owner in the "Objective baru" form. */
export type OwnerOption = PersonRef & { division_id: string | null };

/** What the "Objective baru" form needs (null = cannot create). */
export type ObjectiveCreateOptions = {
    divisions: DivisionRef[];
    people: OwnerOption[];
    /** Next, current, previous quarter. */
    quarters: QuarterKey[];
};

/** Props of /okr. */
export type OkrIndexProps = {
    /** Office date "2026-10-05". */
    today: string;
    /** Quarter tabs, newest first. */
    quarters: QuarterKey[];
    current_quarter: QuarterKey;
    /** division: a division id or 'all'. */
    filters: { quarter: QuarterKey; division: string };
    divisions: DivisionRef[];
    /** Objectives of the filtered quarter / division. */
    objectives: Objective[];
    create: ObjectiveCreateOptions | null;
};

/** Props of /okr/{objective}. */
export type ObjectiveDetailProps = {
    today: string;
    objective: Objective;
    /** Possible owners (objective & key result) in the division. */
    people: PersonRef[];
    /** Quarters offered by the edit form. */
    quarters: QuarterKey[];
};
