import type { Priority, Task } from '../types';
import { endOfWeek } from './due-date';

export type DueFilter = 'overdue' | 'today' | 'week' | 'none';

export type TaskFilters = {
    /** User ids; NO_ASSIGNEE matches unassigned tasks. */
    assignees: string[];
    priorities: Priority[];
    labels: string[];
    due: DueFilter | null;
    q: string;
};

export const NO_ASSIGNEE = 'none';

export const EMPTY_FILTERS: TaskFilters = {
    assignees: [],
    priorities: [],
    labels: [],
    due: null,
    q: '',
};

export const DUE_FILTER_LABELS: Record<DueFilter, string> = {
    overdue: 'Terlambat',
    today: 'Hari ini',
    week: 'Minggu ini',
    none: 'Tanpa tenggat',
};

const DUE_FILTERS = Object.keys(DUE_FILTER_LABELS) as DueFilter[];

export function countActiveFilters(filters: TaskFilters): number {
    return (
        (filters.assignees.length > 0 ? 1 : 0) +
        (filters.priorities.length > 0 ? 1 : 0) +
        (filters.labels.length > 0 ? 1 : 0) +
        (filters.due ? 1 : 0) +
        (filters.q.trim() !== '' ? 1 : 0)
    );
}

/** Lowercase without diacritics, for forgiving text search. */
export function normalizeText(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();
}

type FilterableTask = Pick<
    Task,
    | 'key'
    | 'title'
    | 'description_text'
    | 'priority'
    | 'due_date'
    | 'status_category'
    | 'assignee_ids'
    | 'label_ids'
>;

function matchesDue(
    task: FilterableTask,
    due: DueFilter,
    today: string,
): boolean {
    const closed =
        task.status_category === 'done' || task.status_category === 'canceled';

    switch (due) {
        case 'none':
            return task.due_date === null;
        case 'overdue':
            return task.due_date !== null && task.due_date < today && !closed;
        case 'today':
            return task.due_date === today;
        case 'week':
            return (
                task.due_date !== null &&
                task.due_date >= today &&
                task.due_date <= endOfWeek(today)
            );
    }
}

export function filterTasks<T extends FilterableTask>(
    tasks: T[],
    filters: TaskFilters,
    today: string,
): T[] {
    if (countActiveFilters(filters) === 0) {
        return tasks;
    }

    const query = normalizeText(filters.q.trim());

    return tasks.filter((task) => {
        if (filters.assignees.length > 0) {
            const unassigned =
                task.assignee_ids.length === 0 &&
                filters.assignees.includes(NO_ASSIGNEE);
            const assigned = task.assignee_ids.some((id) =>
                filters.assignees.includes(id),
            );

            if (!unassigned && !assigned) {
                return false;
            }
        }

        if (
            filters.priorities.length > 0 &&
            !filters.priorities.includes(task.priority)
        ) {
            return false;
        }

        if (
            filters.labels.length > 0 &&
            !task.label_ids.some((id) => filters.labels.includes(id))
        ) {
            return false;
        }

        if (filters.due && !matchesDue(task, filters.due, today)) {
            return false;
        }

        if (query !== '') {
            const haystack = normalizeText(
                `${task.key} ${task.title} ${task.description_text ?? ''}`,
            );

            if (!haystack.includes(query)) {
                return false;
            }
        }

        return true;
    });
}

function list(params: URLSearchParams, key: string): string[] {
    return (params.get(key) ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value !== '');
}

/** Reads filters from a query string (?assignee=a,b&priority=1&due=week&q=…). */
export function parseFilters(search: string): TaskFilters {
    const params = new URLSearchParams(search);
    const due = params.get('due');

    return {
        assignees: list(params, 'assignee'),
        priorities: list(params, 'priority')
            .map(Number)
            .filter((value): value is Priority =>
                [0, 1, 2, 3, 4].includes(value),
            ),
        labels: list(params, 'label'),
        due: DUE_FILTERS.includes(due as DueFilter) ? (due as DueFilter) : null,
        q: params.get('q') ?? '',
    };
}

/** Writes filters into `params` (removing empty ones), keeping other keys. */
export function applyFiltersToParams(
    params: URLSearchParams,
    filters: TaskFilters,
): URLSearchParams {
    const next = new URLSearchParams(params);
    const set = (key: string, value: string) => {
        if (value === '') {
            next.delete(key);
        } else {
            next.set(key, value);
        }
    };

    set('assignee', filters.assignees.join(','));
    set('priority', filters.priorities.join(','));
    set('label', filters.labels.join(','));
    set('due', filters.due ?? '');
    set('q', filters.q.trim());

    return next;
}
