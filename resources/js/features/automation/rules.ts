import type {
    AutomationRule,
    LabelRef,
    Person,
    RoleKey,
    RuleAction,
    RuleCondition,
    RuleTarget,
    RuleTrigger,
    WorkspaceRef,
} from '@/features/automation/types';
import type { StatusCategory } from '@/features/tasks/types';

/** Lookup tables the sentence needs (ids → names). */
export type RuleContext = {
    workspaces: WorkspaceRef[];
    labels: LabelRef[];
    people: Person[];
};

export const CATEGORY_LABELS: Record<StatusCategory, string> = {
    backlog: 'Backlog',
    todo: 'Todo',
    in_progress: 'Sedang dikerjakan',
    review: 'Review',
    done: 'Selesai',
    canceled: 'Dibatalkan',
};

export const CATEGORY_ORDER: StatusCategory[] = [
    'backlog',
    'todo',
    'in_progress',
    'review',
    'done',
    'canceled',
];

export const ROLE_LABELS: Record<RoleKey, string> = {
    kepala_divisi: 'Kepala Divisi',
    hr: 'HR',
    direksi: 'Direksi',
    anggota: 'semua anggota workspace',
};

export const PRIORITY_NAMES: Record<1 | 2 | 3 | 4, string> = {
    1: 'Urgent',
    2: 'Tinggi',
    3: 'Sedang',
    4: 'Rendah',
};

export const TRIGGER_OPTIONS: { value: RuleTrigger['type']; label: string }[] =
    [
        { value: 'task_moved', label: 'Tugas pindah kolom' },
        { value: 'task_overdue', label: 'Tugas lewat tenggat' },
        {
            value: 'task_created_with_label',
            label: 'Tugas dibuat berlabel',
        },
    ];

export const CONDITION_OPTIONS: {
    value: RuleCondition['type'];
    label: string;
}[] = [
    { value: 'priority', label: 'Prioritas adalah…' },
    { value: 'assignee', label: 'Penanggung jawab adalah…' },
];

export const ACTION_OPTIONS: { value: RuleAction['type']; label: string }[] = [
    { value: 'notify', label: 'Beri tahu' },
    { value: 'assign', label: 'Tugaskan ke' },
    { value: 'add_label', label: 'Tambah label' },
    { value: 'move_status', label: 'Pindahkan ke kolom' },
];

export const MAX_ACTIONS = 3;

const BLANK = '…';

function personName(ctx: RuleContext, id: string | null): string {
    return ctx.people.find((p) => p.id === id)?.name ?? BLANK;
}

function labelName(ctx: RuleContext, id: string | null): string {
    const label = ctx.labels.find((l) => l.id === id);

    return label ? `"${label.name}"` : BLANK;
}

function categoryName(category: StatusCategory | null): string {
    return category ? CATEGORY_LABELS[category] : BLANK;
}

export function targetName(
    ctx: RuleContext,
    target: RuleTarget | null,
): string {
    if (!target) {
        return BLANK;
    }

    switch (target.kind) {
        case 'user':
            return personName(ctx, target.id);
        case 'role':
            return ROLE_LABELS[target.role];
        case 'assignees':
            return 'penanggung jawab tugas';
        case 'watchers':
            return 'pengamat tugas';
    }
}

/** Encodes a target for a <Select> value and back. */
export function encodeTarget(target: RuleTarget | null): string {
    if (!target) {
        return '';
    }

    switch (target.kind) {
        case 'user':
            return `user:${target.id}`;
        case 'role':
            return `role:${target.role}`;
        default:
            return target.kind;
    }
}

export function decodeTarget(value: string): RuleTarget | null {
    if (value === 'assignees' || value === 'watchers') {
        return { kind: value };
    }

    const [kind, id] = value.split(':');

    if (kind === 'user' && id) {
        return { kind: 'user', id };
    }

    if (kind === 'role' && id && id in ROLE_LABELS) {
        return { kind: 'role', role: id as RoleKey };
    }

    return null;
}

function describeTrigger(ctx: RuleContext, trigger: RuleTrigger): string {
    switch (trigger.type) {
        case 'task_moved':
            return `pindah ke kolom ${categoryName(trigger.category)}`;
        case 'task_overdue':
            return 'lewat tenggat';
        case 'task_created_with_label':
            return `dibuat dengan label ${labelName(ctx, trigger.label_id)}`;
    }
}

function describeCondition(ctx: RuleContext, condition: RuleCondition): string {
    switch (condition.type) {
        case 'priority':
            return `prioritasnya ${condition.priority ? PRIORITY_NAMES[condition.priority] : BLANK}`;
        case 'assignee':
            return `penanggung jawabnya ${personName(ctx, condition.user_id)}`;
    }
}

export function describeAction(ctx: RuleContext, action: RuleAction): string {
    switch (action.type) {
        case 'notify':
            return `beri tahu ${targetName(ctx, action.target)}`;
        case 'assign':
            return `tugaskan ke ${personName(ctx, action.user_id)}`;
        case 'add_label':
            return `tambah label ${labelName(ctx, action.label_id)}`;
        case 'move_status':
            return `pindahkan ke kolom ${categoryName(action.category)}`;
    }
}

function joinAnd(parts: string[]): string {
    if (parts.length <= 1) {
        return parts.join('');
    }

    return `${parts.slice(0, -1).join(', ')} dan ${parts[parts.length - 1]}`;
}

/**
 * Plain-language sentence of a rule: "Jika tugas di Operasional pindah ke
 * kolom Selesai dan prioritasnya Urgent, maka beri tahu Dimas Pratama dan
 * tambah label "Ditinjau"." Missing pieces render as "…".
 */
export function describeRule(
    ctx: RuleContext,
    rule: Pick<
        AutomationRule,
        'workspace_id' | 'trigger' | 'condition' | 'actions'
    >,
): string {
    const workspace = ctx.workspaces.find((w) => w.id === rule.workspace_id);
    const where = workspace ? ` di ${workspace.name}` : '';
    const condition = rule.condition
        ? ` dan ${describeCondition(ctx, rule.condition)}`
        : '';
    const actions =
        rule.actions.length === 0
            ? BLANK
            : joinAnd(
                  rule.actions.map((action) => describeAction(ctx, action)),
              );

    return `Jika tugas${where} ${describeTrigger(ctx, rule.trigger)}${condition}, maka ${actions}.`;
}

export type RuleDraft = Pick<
    AutomationRule,
    'name' | 'workspace_id' | 'trigger' | 'condition' | 'actions'
>;

export type RuleErrors = {
    name?: string;
    workspace_id?: string;
    trigger?: string;
    condition?: string;
    /** Per action index. */
    actions?: Record<number, string>;
    actionsList?: string;
};

function actionComplete(action: RuleAction): boolean {
    switch (action.type) {
        case 'notify':
            return action.target !== null;
        case 'assign':
            return action.user_id !== null;
        case 'add_label':
            return action.label_id !== null;
        case 'move_status':
            return action.category !== null;
    }
}

/** Validation of the "Aturan baru" form. Empty object = valid. */
export function validateRule(draft: RuleDraft): RuleErrors {
    const errors: RuleErrors = {};

    if (draft.name.trim() === '') {
        errors.name = 'Beri nama aturan.';
    } else if (draft.name.trim().length > 80) {
        errors.name = 'Nama maksimal 80 karakter.';
    }

    if (draft.workspace_id === '') {
        errors.workspace_id = 'Pilih workspace.';
    }

    if (
        draft.trigger.type === 'task_moved' &&
        draft.trigger.category === null
    ) {
        errors.trigger = 'Pilih kategori kolom.';
    }

    if (
        draft.trigger.type === 'task_created_with_label' &&
        draft.trigger.label_id === null
    ) {
        errors.trigger = 'Pilih label.';
    }

    if (draft.condition) {
        const empty =
            draft.condition.type === 'priority'
                ? draft.condition.priority === null
                : draft.condition.user_id === null;

        if (empty) {
            errors.condition = 'Lengkapi kondisi atau hapus.';
        }
    }

    if (draft.actions.length === 0) {
        errors.actionsList = 'Tambahkan minimal satu aksi.';
    } else if (draft.actions.length > MAX_ACTIONS) {
        errors.actionsList = `Maksimal ${MAX_ACTIONS} aksi per aturan.`;
    }

    const actionErrors: Record<number, string> = {};

    draft.actions.forEach((action, index) => {
        if (!actionComplete(action)) {
            actionErrors[index] = 'Pilih tujuan aksi.';
        }
    });

    // A rule that moves the task into the column it reacts to would loop.
    draft.actions.forEach((action, index) => {
        if (
            action.type === 'move_status' &&
            draft.trigger.type === 'task_moved' &&
            action.category !== null &&
            action.category === draft.trigger.category
        ) {
            actionErrors[index] =
                'Aksi ini memicu aturan yang sama lagi. Pilih kolom lain.';
        }
    });

    if (Object.keys(actionErrors).length > 0) {
        errors.actions = actionErrors;
    }

    return errors;
}

export function hasErrors(errors: RuleErrors): boolean {
    return Object.keys(errors).length > 0;
}

/** Fresh action of a type with nothing chosen yet. */
export function emptyAction(type: RuleAction['type']): RuleAction {
    switch (type) {
        case 'notify':
            return { type, target: null };
        case 'assign':
            return { type, user_id: null };
        case 'add_label':
            return { type, label_id: null };
        case 'move_status':
            return { type, category: null };
    }
}

export function emptyTrigger(type: RuleTrigger['type']): RuleTrigger {
    switch (type) {
        case 'task_moved':
            return { type, category: null };
        case 'task_overdue':
            return { type };
        case 'task_created_with_label':
            return { type, label_id: null };
    }
}

export function emptyCondition(type: RuleCondition['type']): RuleCondition {
    return type === 'priority'
        ? { type, priority: null }
        : { type, user_id: null };
}
