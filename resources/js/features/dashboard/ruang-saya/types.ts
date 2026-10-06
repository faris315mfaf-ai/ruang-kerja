import type { StatusCategory } from '@/features/tasks/types';

/** Lanes of "Ruang saya" (task_plans.bucket). */
export type Lane = 'today' | 'week' | 'later';

type PlannerTaskBase = {
    id: string;
    /** "OPS-142". */
    key: string;
    number: number;
    title: string;
    /** Full-screen detail /w/{KEY}/tasks/{n}. */
    url: string;
    workspace: { name: string; key: string; type: string };
    due_date: string | null;
    days_late: number;
    priority: number;
};

/** A task assigned by someone else that has not been accepted yet. */
export type IncomingItem = PlannerTaskBase & {
    assigned_by: string | null;
    assigned_at: string;
};

export type PlannerItem = PlannerTaskBase & {
    status: { id: string; name: string; category: StatusCategory };
    is_personal: boolean;
    checklist: { done: number; total: number } | null;
    lane: Lane;
    /** Placed by due date (no plan of the user's own). */
    auto: boolean;
    /** A "today" plan made on an earlier day. */
    carried: boolean;
    /** Completed today (struck through at the bottom of its lane). */
    done: boolean;
    completed_at: string | null;
    can_complete: boolean;
    /** Where the checkbox moves it: Review first, else Done. */
    completes_to: 'review' | 'done' | null;
    complete_hint: string | null;
    /** Client-only: optimistic row waiting for the server. */
    pending?: boolean;
};

/** PersonalPlanner payload (prop `planner`, JSON of /ruang-saya). */
export type Planner = {
    today: string;
    incoming: IncomingItem[];
    lanes: Record<Lane, PlannerItem[]>;
    counts: Record<Lane | 'incoming', number>;
    progress: { done: number; total: number };
};
