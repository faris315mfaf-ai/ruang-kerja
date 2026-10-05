import type { PaletteColor } from '@/lib/palette';

export type StatusCategory =
    | 'backlog'
    | 'todo'
    | 'in_progress'
    | 'review'
    | 'done'
    | 'canceled';

/** tasks.priority: 0 none · 1 urgent · 2 high · 3 medium · 4 low. */
export type Priority = 0 | 1 | 2 | 3 | 4;

export type WorkspaceType = 'personal' | 'team' | 'division' | 'project';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export type TaskStatus = {
    id: string;
    name: string;
    category: StatusCategory;
    color: PaletteColor;
    position: string;
};

export type Label = {
    id: string;
    name: string;
    color: PaletteColor;
};

export type Person = {
    id: string;
    name: string;
    avatar: string | null;
};

export type WorkspaceMember = Person & {
    role: WorkspaceRole;
};

/** Small workspace reference used on cross-workspace rows. */
export type WorkspaceRef = {
    id: string;
    key: string;
    name: string;
    type: WorkspaceType;
    color: PaletteColor;
};

export type ChecklistProgress = {
    done: number;
    total: number;
};

/** A task as sent to board, list and calendar views (normalized ids). */
export type Task = {
    id: string;
    workspace_id: string;
    number: number;
    /** Display id, e.g. "PLQ-21". */
    key: string;
    title: string;
    description_text: string | null;
    status_id: string;
    status_category: StatusCategory;
    priority: Priority;
    position: string;
    start_date: string | null;
    due_date: string | null;
    estimate_hours: number | null;
    parent_id: string | null;
    parent_key: string | null;
    assignee_ids: string[];
    label_ids: string[];
    checklist: ChecklistProgress | null;
    created_by: string | null;
    created_at: string;
    completed_at: string | null;
};

/** A task on cross-workspace screens (Tugas saya) with resolved relations. */
export type TaskRow = Task & {
    workspace: WorkspaceRef;
    status: TaskStatus;
    labels: Label[];
    assignees: Person[];
};

/** Everything the task form needs for one workspace. */
export type WorkspaceTaskOptions = WorkspaceRef & {
    statuses: TaskStatus[];
    labels: Label[];
    members: WorkspaceMember[];
};

export type TaskViewMode = 'board' | 'list' | 'calendar';

/** Row of "Tugas saya" (TaskRowResource). */
export type MyTaskRow = TaskRow & {
    done_status_id: string | null;
};

/** Saved view of a workspace (SavedViewResource). `filters.assignees` may contain "me". */
export type SavedView = {
    id: string;
    name: string;
    layout: TaskViewMode;
    filters: {
        assignees: string[];
        priorities: Priority[];
        labels: string[];
        due: 'overdue' | 'today' | 'week' | 'none' | null;
        q: string;
    };
    is_shared: boolean;
    mine: boolean;
    owner: string | null;
};
