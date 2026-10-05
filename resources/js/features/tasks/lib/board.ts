import type { Task, TaskStatus } from '../types';

/** Ordered task ids per status id. */
export type BoardColumns = Record<string, string[]>;

/**
 * Byte-wise comparison, matching PHP strcmp() and PostgreSQL COLLATE "C"
 * for the base-62 rank keys (localeCompare would not).
 */
export function compareRank(a: string, b: string): number {
    if (a === b) {
        return 0;
    }

    return a < b ? -1 : 1;
}

export function compareTasks(
    a: Pick<Task, 'position' | 'number'>,
    b: Pick<Task, 'position' | 'number'>,
): number {
    return compareRank(a.position, b.position) || a.number - b.number;
}

export function buildColumns(
    tasks: Task[],
    statuses: TaskStatus[],
): BoardColumns {
    const columns: BoardColumns = Object.fromEntries(
        statuses.map((status) => [status.id, [] as string[]]),
    );

    for (const task of [...tasks].sort(compareTasks)) {
        columns[task.status_id]?.push(task.id);
    }

    return columns;
}

export function findColumn(
    columns: BoardColumns,
    taskId: string,
): string | undefined {
    return Object.keys(columns).find((statusId) =>
        columns[statusId].includes(taskId),
    );
}

export type BoardMove = {
    columns: BoardColumns;
    /** Neighbours in the target column, sent to PATCH /tugas/{id}/move. */
    afterId: string | null;
    beforeId: string | null;
};

/**
 * Moves a task to `toIndex` of `toStatusId` (index within the target column
 * after removing the task from its current place).
 */
export function moveInColumns(
    columns: BoardColumns,
    taskId: string,
    toStatusId: string,
    toIndex: number,
): BoardMove {
    const next: BoardColumns = {};

    for (const [statusId, ids] of Object.entries(columns)) {
        next[statusId] = ids.filter((id) => id !== taskId);
    }

    const target = next[toStatusId] ?? [];
    const index = Math.max(0, Math.min(toIndex, target.length));

    target.splice(index, 0, taskId);
    next[toStatusId] = target;

    return {
        columns: next,
        afterId: target[index - 1] ?? null,
        beforeId: target[index + 1] ?? null,
    };
}

/** Status left (-1) or right (+1) of `statusId`, or null at the edge. */
export function adjacentStatusId(
    statuses: TaskStatus[],
    statusId: string,
    direction: -1 | 1,
): string | null {
    const index = statuses.findIndex((status) => status.id === statusId);

    if (index === -1) {
        return null;
    }

    return statuses[index + direction]?.id ?? null;
}

/**
 * Index inside `ids` (a column without the moving card) for a drop between
 * two visible neighbours; works when the column is filtered.
 */
export function insertionIndex(
    ids: string[],
    afterId: string | null,
    beforeId: string | null,
): number {
    if (afterId !== null) {
        const index = ids.indexOf(afterId);

        if (index !== -1) {
            return index + 1;
        }
    }

    if (beforeId !== null) {
        const index = ids.indexOf(beforeId);

        if (index !== -1) {
            return index;
        }
    }

    return 0;
}

/**
 * Applies a task received from the server (broadcast or polling) to the
 * board: removed from its old column, inserted into its column in rank
 * order. Tasks of unknown columns are dropped from the board.
 */
export function upsertInColumns(
    columns: BoardColumns,
    byId: Record<string, Task>,
    task: Task,
): BoardColumns {
    const next = removeFromColumns(columns, task.id);
    const target = next[task.status_id];

    if (!target) {
        return next;
    }

    const lookup = { ...byId, [task.id]: task };
    next[task.status_id] = [...target, task.id].sort((a, b) =>
        lookup[a] && lookup[b] ? compareTasks(lookup[a], lookup[b]) : 0,
    );

    return next;
}

export function removeFromColumns(
    columns: BoardColumns,
    taskId: string,
): BoardColumns {
    return Object.fromEntries(
        Object.entries(columns).map(([statusId, ids]) => [
            statusId,
            ids.includes(taskId) ? ids.filter((id) => id !== taskId) : ids,
        ]),
    );
}
