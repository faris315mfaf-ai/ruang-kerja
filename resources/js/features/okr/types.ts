/**
 * OKR per division per quarter (Fase 3, docs/DATABASE.md §8 `objectives` /
 * `key_results`). Shapes mirror the future tables so a controller can send
 * the same props; check-ins are a planned `key_result_checkins` table.
 */

import type { StatusCategory } from '@/features/tasks/types';

export type PersonRef = { id: string; name: string };

export type DivisionRef = { id: string; name: string; code: string };

/** "2026-Q4". */
export type QuarterKey = `${number}-Q${1 | 2 | 3 | 4}`;

export type OkrStatus = 'on_track' | 'at_risk' | 'behind';

export type KrUnit = 'number' | 'percent' | 'currency' | 'days';

/** Weekly progress check-in of a key result (planned table). */
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

/** Task linked to a key result (`key_results` ↔ `tasks`). */
export type LinkedTask = {
    id: string;
    /** "SIM-388". */
    key: string;
    title: string;
    status_category: StatusCategory;
    assignee: PersonRef | null;
    due_date: string | null;
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
    tasks: LinkedTask[];
    checkins: KrCheckin[];
};

export type Objective = {
    id: string;
    company_id: string;
    division: DivisionRef;
    quarter: QuarterKey;
    title: string;
    description: string | null;
    owner: PersonRef;
    key_results: KeyResult[];
    created_at: string;
    updated_at: string;
};

/** Props of /okr (same shape a controller would send). */
export type OkrIndexProps = {
    today: string;
    quarters: QuarterKey[];
    current_quarter: QuarterKey;
    divisions: DivisionRef[];
    objectives: Objective[];
};
