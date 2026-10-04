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
