import { STATUS_CATEGORY_LABELS } from '@/components/status-icon';
import { PRIORITY_LABELS, PRIORITY_ORDER } from '@/components/priority-icon';
import type { DueGroup } from '../lib/due-date';
import {
    addDays,
    DUE_GROUPS,
    dueGroup,
    endOfWeek,
    formatDayRange,
    formatShortDate,
} from '../lib/due-date';
import { prioritySortWeight } from '../lib/priority';
import type { MyTaskRow, StatusCategory } from '../types';

export type GroupMode = 'due' | 'workspace' | 'priority' | 'status';

export const GROUP_MODES: { value: GroupMode; label: string }[] = [
    { value: 'due', label: 'Tenggat' },
    { value: 'workspace', label: 'Workspace' },
    { value: 'priority', label: 'Prioritas' },
    { value: 'status', label: 'Status' },
];

export type RowGroup = {
    id: string;
    label: string;
    hint?: string;
    tone?: 'danger' | 'warning';
    dueGroup?: DueGroup;
    items: MyTaskRow[];
};

const DUE_LABELS: Record<DueGroup, string> = {
    overdue: 'Terlambat',
    today: 'Hari ini',
    week: 'Minggu ini',
    later: 'Nanti',
    none: 'Tanpa tenggat',
};

const CATEGORY_ORDER: StatusCategory[] = [
    'in_progress',
    'review',
    'todo',
    'backlog',
    'done',
    'canceled',
];

function byPriority(a: MyTaskRow, b: MyTaskRow): number {
    return (
        prioritySortWeight(a.priority) - prioritySortWeight(b.priority) ||
        a.number - b.number
    );
}

function byDue(a: MyTaskRow, b: MyTaskRow): number {
    return (
        (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') ||
        byPriority(a, b)
    );
}

/** Groups for "Tugas saya" (mockup TugasSaya: Terlambat, Hari ini, Minggu ini, Nanti, Tanpa tenggat). */
export function groupRows(
    rows: MyTaskRow[],
    mode: GroupMode,
    today: string,
): RowGroup[] {
    if (mode === 'workspace') {
        const map = new Map<string, MyTaskRow[]>();

        for (const row of rows) {
            map.set(row.workspace.id, [
                ...(map.get(row.workspace.id) ?? []),
                row,
            ]);
        }

        return [...map.values()]
            .map((items) => ({
                id: items[0].workspace.id,
                label:
                    items[0].workspace.type === 'personal'
                        ? 'Pribadi'
                        : items[0].workspace.name,
                items: items.sort(byDue),
            }))
            .sort((a, b) => a.label.localeCompare(b.label, 'id'));
    }

    if (mode === 'priority') {
        return PRIORITY_ORDER.map((priority) => ({
            id: `p${priority}`,
            label: PRIORITY_LABELS[priority],
            items: rows.filter((row) => row.priority === priority).sort(byDue),
        })).filter((group) => group.items.length > 0);
    }

    if (mode === 'status') {
        return CATEGORY_ORDER.map((category) => ({
            id: category,
            label: STATUS_CATEGORY_LABELS[category],
            items: rows
                .filter((row) => row.status_category === category)
                .sort(byDue),
        })).filter((group) => group.items.length > 0);
    }

    return DUE_GROUPS.map((group) => ({
        id: group,
        dueGroup: group,
        label: DUE_LABELS[group],
        tone:
            group === 'overdue'
                ? ('danger' as const)
                : group === 'today'
                  ? ('warning' as const)
                  : undefined,
        hint:
            group === 'today'
                ? formatShortDate(today)
                : group === 'week' && addDays(today, 1) <= endOfWeek(today)
                  ? formatDayRange(addDays(today, 1), endOfWeek(today))
                  : undefined,
        items: rows
            .filter((row) => dueGroup(row.due_date, today) === group)
            .sort(byDue),
    })).filter((group) => group.items.length > 0);
}

/** "9 tugas aktif di 3 workspace · 1 terlambat · 2 jatuh tempo hari ini" parts. */
export function summarize(rows: MyTaskRow[], today: string) {
    const open = rows.filter(
        (row) =>
            row.status_category !== 'done' &&
            row.status_category !== 'canceled',
    );

    return {
        open: open.length,
        workspaces: new Set(open.map((row) => row.workspace.id)).size,
        overdue: open.filter(
            (row) => row.due_date !== null && row.due_date < today,
        ).length,
        today: open.filter((row) => row.due_date === today).length,
        closed: rows.length - open.length,
    };
}

/** "Tunda": move the due date to the day after (today when already late). */
export function postponedDue(due: string | null, today: string): string {
    return addDays(due !== null && due > today ? due : today, 1);
}
