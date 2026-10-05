import { describe, expect, it } from 'vite-plus/test';

import type { Task, TaskStatus } from '../types';
import {
    adjacentStatusId,
    buildColumns,
    compareRank,
    findColumn,
    insertionIndex,
    moveInColumns,
    removeFromColumns,
    upsertInColumns,
} from './board';

const statuses: TaskStatus[] = [
    {
        id: 'todo',
        name: 'Todo',
        category: 'todo',
        color: 'slate',
        position: 'G',
    },
    {
        id: 'doing',
        name: 'Sedang dikerjakan',
        category: 'in_progress',
        color: 'amber',
        position: 'V',
    },
    {
        id: 'done',
        name: 'Selesai',
        category: 'done',
        color: 'teal',
        position: 'k',
    },
];

function task(id: string, status: string, position: string, number = 1) {
    return { id, status_id: status, position, number } as Task;
}

describe('compareRank', () => {
    it('compares byte-wise (digits < upper < lower)', () => {
        expect(compareRank('9', 'A')).toBe(-1);
        expect(compareRank('Z', 'a')).toBe(-1);
        expect(compareRank('V', 'V1')).toBe(-1);
        expect(compareRank('b', 'b')).toBe(0);
    });
});

describe('buildColumns', () => {
    it('orders tasks by rank and ignores unknown statuses', () => {
        const columns = buildColumns(
            [
                task('b', 'todo', 'a'),
                task('a', 'todo', 'Z'),
                task('c', 'doing', 'V'),
                task('x', 'gone', 'V'),
            ],
            statuses,
        );

        expect(columns).toEqual({ todo: ['a', 'b'], doing: ['c'], done: [] });
    });

    it('breaks rank ties by task number', () => {
        expect(
            buildColumns(
                [task('b', 'todo', 'V', 2), task('a', 'todo', 'V', 1)],
                statuses,
            ).todo,
        ).toEqual(['a', 'b']);
    });
});

describe('moveInColumns', () => {
    const columns = { todo: ['a', 'b', 'c'], doing: ['d'], done: [] };

    it('moves across columns and reports the neighbours', () => {
        const move = moveInColumns(columns, 'b', 'doing', 1);

        expect(move.columns).toEqual({
            todo: ['a', 'c'],
            doing: ['d', 'b'],
            done: [],
        });
        expect(move.afterId).toBe('d');
        expect(move.beforeId).toBeNull();
    });

    it('reorders inside a column without mutating the input', () => {
        const move = moveInColumns(columns, 'c', 'todo', 0);

        expect(move.columns.todo).toEqual(['c', 'a', 'b']);
        expect(move.afterId).toBeNull();
        expect(move.beforeId).toBe('a');
        expect(columns.todo).toEqual(['a', 'b', 'c']);
    });

    it('clamps the index into an empty column', () => {
        const move = moveInColumns(columns, 'a', 'done', 9);

        expect(move.columns.done).toEqual(['a']);
        expect(move.afterId).toBeNull();
        expect(move.beforeId).toBeNull();
    });

    it('finds the column of a task', () => {
        expect(findColumn(columns, 'd')).toBe('doing');
        expect(findColumn(columns, 'zz')).toBeUndefined();
    });
});

describe('adjacentStatusId', () => {
    it('returns the neighbouring column or null at the edges', () => {
        expect(adjacentStatusId(statuses, 'todo', 1)).toBe('doing');
        expect(adjacentStatusId(statuses, 'todo', -1)).toBeNull();
        expect(adjacentStatusId(statuses, 'done', 1)).toBeNull();
        expect(adjacentStatusId(statuses, 'missing', 1)).toBeNull();
    });
});

describe('insertionIndex', () => {
    it('maps visible neighbours to an index in the full column', () => {
        const ids = ['a', 'hidden', 'b', 'c'];

        expect(insertionIndex(ids, 'b', 'c')).toBe(3);
        expect(insertionIndex(ids, null, 'b')).toBe(2);
        expect(insertionIndex(ids, 'missing', 'a')).toBe(0);
        expect(insertionIndex(ids, null, null)).toBe(0);
        expect(insertionIndex(ids, 'c', null)).toBe(4);
    });
});

describe('upsertInColumns (realtime)', () => {
    const byId = {
        a: task('a', 'todo', 'G'),
        b: task('b', 'todo', 'V'),
        c: task('c', 'doing', 'V'),
    };
    const columns = { todo: ['a', 'b'], doing: ['c'], done: [] };

    it('moves a task to its new column in rank order', () => {
        expect(upsertInColumns(columns, byId, task('a', 'doing', 'Z'))).toEqual(
            { todo: ['b'], doing: ['c', 'a'], done: [] },
        );
    });

    it('inserts a new task and reorders within the same column', () => {
        expect(
            upsertInColumns(columns, byId, task('n', 'todo', 'A')).todo,
        ).toEqual(['n', 'a', 'b']);
        expect(
            upsertInColumns(columns, byId, task('b', 'todo', '1')).todo,
        ).toEqual(['b', 'a']);
    });

    it('drops tasks of unknown columns and removes deleted ones', () => {
        expect(upsertInColumns(columns, byId, task('a', 'gone', 'A'))).toEqual({
            todo: ['b'],
            doing: ['c'],
            done: [],
        });
        expect(removeFromColumns(columns, 'c')).toEqual({
            todo: ['a', 'b'],
            doing: [],
            done: [],
        });
    });
});
