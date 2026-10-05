import { router } from '@inertiajs/react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { move } from '@/routes/tasks';
import { requestJson } from './lib/api';
import type { BoardColumns } from './lib/board';
import {
    buildColumns,
    findColumn,
    insertionIndex,
    moveInColumns,
    removeFromColumns,
    upsertInColumns,
} from './lib/board';
import type { Task, TaskStatus } from './types';

type BoardState = {
    byId: Record<string, Task>;
    columns: BoardColumns;
};

export type MoveTarget = {
    statusId: string;
    /** Visible card directly above the drop position. */
    afterId?: string | null;
    /** Visible card directly below the drop position. */
    beforeId?: string | null;
};

function init(tasks: Task[], statuses: TaskStatus[]): BoardState {
    return {
        byId: Object.fromEntries(tasks.map((task) => [task.id, task])),
        columns: buildColumns(tasks, statuses),
    };
}

/**
 * Board state shared by the desktop board (drag & drop, Shift+←/→) and the
 * mobile board ("Pindahkan"): optimistic moves through PATCH
 * /tugas/{id}/move with rollback + toast on failure, and an undo toast.
 * Re-syncs whenever the server sends new `tasks`/`statuses` props.
 */
export function useTaskBoard(tasks: Task[], statuses: TaskStatus[]) {
    const [source, setSource] = useState({ tasks, statuses });
    const [state, setState] = useState(() => init(tasks, statuses));
    const stateRef = useRef(state);

    useLayoutEffect(() => {
        stateRef.current = state;
    }, [state]);

    if (source.tasks !== tasks || source.statuses !== statuses) {
        setSource({ tasks, statuses });
        setState(init(tasks, statuses));
    }

    const moveTaskRef = useRef<
        (taskId: string, target: MoveTarget) => Promise<boolean>
    >(() => Promise.resolve(false));

    const statusById = useMemo(
        () => Object.fromEntries(statuses.map((status) => [status.id, status])),
        [statuses],
    );

    const moveTask = useCallback(
        async (
            taskId: string,
            target: MoveTarget,
            options: { announce?: boolean } = {},
        ): Promise<boolean> => {
            const current = stateRef.current;
            const original = current.byId[taskId];
            const status = statusById[target.statusId];
            const fromStatusId = findColumn(current.columns, taskId);

            if (!original || !status || !fromStatusId) {
                return false;
            }

            const fromIds = current.columns[fromStatusId];
            const fromIndex = fromIds.indexOf(taskId);
            const previous = {
                afterId: fromIds[fromIndex - 1] ?? null,
                beforeId: fromIds[fromIndex + 1] ?? null,
            };
            const targetIds = (current.columns[target.statusId] ?? []).filter(
                (id) => id !== taskId,
            );
            const index = insertionIndex(
                targetIds,
                target.afterId ?? null,
                target.beforeId ?? null,
            );
            const result = moveInColumns(
                current.columns,
                taskId,
                target.statusId,
                index,
            );

            if (
                fromStatusId === target.statusId &&
                result.columns[target.statusId].join() === fromIds.join()
            ) {
                return true;
            }

            // Optimistic update.
            setState((prev) => ({
                byId: {
                    ...prev.byId,
                    [taskId]: {
                        ...original,
                        status_id: status.id,
                        status_category: status.category,
                    },
                },
                columns: moveInColumns(
                    prev.columns,
                    taskId,
                    target.statusId,
                    insertionIndex(
                        (prev.columns[target.statusId] ?? []).filter(
                            (id) => id !== taskId,
                        ),
                        target.afterId ?? null,
                        target.beforeId ?? null,
                    ),
                ).columns,
            }));

            try {
                const response = await requestJson<{ task: Task }>(
                    move(taskId),
                    {
                        status_id: status.id,
                        after_id: result.afterId,
                        before_id: result.beforeId,
                    },
                );

                setState((prev) => ({
                    ...prev,
                    byId: { ...prev.byId, [taskId]: response.task },
                }));

                if (options.announce && fromStatusId !== status.id) {
                    toast.success(
                        `${original.key} dipindahkan ke ${status.name}.`,
                        {
                            action: {
                                label: 'Urungkan',
                                onClick: () => {
                                    void moveTaskRef.current(taskId, {
                                        statusId: fromStatusId,
                                        ...previous,
                                    });
                                },
                            },
                        },
                    );
                }

                return true;
            } catch (error) {
                // Roll back to the previous column and place.
                setState((prev) => {
                    const ids = (prev.columns[fromStatusId] ?? []).filter(
                        (id) => id !== taskId,
                    );

                    return {
                        byId: { ...prev.byId, [taskId]: original },
                        columns: moveInColumns(
                            prev.columns,
                            taskId,
                            fromStatusId,
                            insertionIndex(
                                ids,
                                previous.afterId,
                                previous.beforeId,
                            ),
                        ).columns,
                    };
                });
                toast.error(
                    error instanceof Error
                        ? `Gagal memindahkan ${original.key}. ${error.message}`
                        : `Gagal memindahkan ${original.key}.`,
                );
                router.reload({ only: ['tasks'] });

                return false;
            }
        },
        [statusById],
    );

    useLayoutEffect(() => {
        moveTaskRef.current = moveTask;
    }, [moveTask]);

    /** A task from the server (broadcast, sheet edit, shortcut). */
    const upsertTask = useCallback((task: Task) => {
        setState((prev) => ({
            byId: { ...prev.byId, [task.id]: task },
            columns: upsertInColumns(prev.columns, prev.byId, task),
        }));
    }, []);

    const removeTask = useCallback((taskId: string) => {
        setState((prev) => {
            if (!prev.byId[taskId]) {
                return prev;
            }

            const byId = { ...prev.byId };
            delete byId[taskId];

            return { byId, columns: removeFromColumns(prev.columns, taskId) };
        });
    }, []);

    return {
        byId: state.byId,
        columns: state.columns,
        statusById,
        moveTask,
        upsertTask,
        removeTask,
    };
}
