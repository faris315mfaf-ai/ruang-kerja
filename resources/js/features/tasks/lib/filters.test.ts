import { describe, expect, it } from 'vite-plus/test';

import type { Task } from '../types';
import {
    EMPTY_FILTERS,
    NO_ASSIGNEE,
    applyFiltersToParams,
    countActiveFilters,
    filterTasks,
    parseFilters,
} from './filters';

const TODAY = '2026-10-05';

function task(overrides: Partial<Task>): Task {
    return {
        id: overrides.id ?? 't',
        workspace_id: 'w',
        number: 1,
        key: 'OPS-1',
        title: 'Tugas',
        description_text: null,
        status_id: 's',
        status_category: 'todo',
        priority: 0,
        position: 'V',
        start_date: null,
        due_date: null,
        estimate_hours: null,
        parent_id: null,
        parent_key: null,
        assignee_ids: [],
        label_ids: [],
        checklist: null,
        created_by: null,
        created_at: '2026-10-01T00:00:00Z',
        completed_at: null,
        ...overrides,
    };
}

const tasks = [
    task({
        id: 'a',
        key: 'OPS-127',
        title: 'Verifikasi tagihan vendor',
        due_date: '2026-10-04',
        assignee_ids: ['dimas'],
        label_ids: ['keu'],
        priority: 2,
    }),
    task({
        id: 'b',
        key: 'OPS-140',
        title: 'Tinjau laporan kinerja',
        due_date: TODAY,
        assignee_ids: ['rizky'],
        priority: 3,
    }),
    task({
        id: 'c',
        key: 'PLQ-22',
        title: 'Siapkan materi présentasi',
        due_date: '2026-10-08',
        priority: 1,
    }),
    task({
        id: 'd',
        key: 'GDG-61',
        title: 'Usulan tata letak rak',
        status_category: 'done',
        due_date: '2026-10-01',
    }),
];

const ids = (list: Task[]) => list.map((item) => item.id);

describe('filterTasks', () => {
    it('returns everything without filters', () => {
        expect(filterTasks(tasks, EMPTY_FILTERS, TODAY)).toBe(tasks);
    });

    it('filters by assignee, including unassigned', () => {
        expect(
            ids(
                filterTasks(
                    tasks,
                    { ...EMPTY_FILTERS, assignees: ['dimas', NO_ASSIGNEE] },
                    TODAY,
                ),
            ),
        ).toEqual(['a', 'c', 'd']);
    });

    it('filters by priority and label', () => {
        expect(
            ids(
                filterTasks(
                    tasks,
                    { ...EMPTY_FILTERS, priorities: [1, 3] },
                    TODAY,
                ),
            ),
        ).toEqual(['b', 'c']);
        expect(
            ids(
                filterTasks(
                    tasks,
                    { ...EMPTY_FILTERS, labels: ['keu'] },
                    TODAY,
                ),
            ),
        ).toEqual(['a']);
    });

    it('filters by due window; closed tasks are never overdue', () => {
        const due = (value: 'overdue' | 'today' | 'week' | 'none') =>
            ids(filterTasks(tasks, { ...EMPTY_FILTERS, due: value }, TODAY));

        expect(due('overdue')).toEqual(['a']);
        expect(due('today')).toEqual(['b']);
        expect(due('week')).toEqual(['b', 'c']);
        expect(due('none')).toEqual([]);
    });

    it('searches key, title and description without diacritics', () => {
        expect(
            ids(
                filterTasks(
                    tasks,
                    { ...EMPTY_FILTERS, q: 'presentasi' },
                    TODAY,
                ),
            ),
        ).toEqual(['c']);
        expect(
            ids(filterTasks(tasks, { ...EMPTY_FILTERS, q: 'ops-1' }, TODAY)),
        ).toEqual(['a', 'b']);
    });
});

describe('query string round trip', () => {
    it('parses and serializes filters, keeping other params', () => {
        const filters = parseFilters(
            '?view=list&assignee=a,b&priority=1,9&label=x&due=week&q=rak',
        );

        expect(filters).toEqual({
            assignees: ['a', 'b'],
            priorities: [1],
            labels: ['x'],
            due: 'week',
            q: 'rak',
        });
        expect(countActiveFilters(filters)).toBe(5);

        const params = applyFiltersToParams(
            new URLSearchParams('view=list&q=old'),
            { ...EMPTY_FILTERS, labels: ['y'] },
        );

        expect(params.toString()).toBe('view=list&label=y');
    });

    it('ignores unknown due values', () => {
        expect(parseFilters('?due=kapan').due).toBeNull();
    });
});
