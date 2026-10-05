import { show } from '@/routes/tasks';
import { ApiError, requestJson } from '../lib/api';
import type { Task } from '../types';

export type CardResult =
    | { kind: 'found'; task: Task }
    /** Deleted, or the viewer lost access to the workspace. */
    | { kind: 'gone' }
    | { kind: 'failed' };

/**
 * Board card of one task through the authorized GET /tugas/{id}?view=card
 * (realtime events only carry ids, see workspace-channel.ts).
 */
export async function fetchTaskCard(taskId: string): Promise<CardResult> {
    try {
        const { task } = await requestJson<{ task: Task }>(
            show(taskId, { query: { view: 'card' } }),
        );

        return { kind: 'found', task };
    } catch (error) {
        if (
            error instanceof ApiError &&
            (error.status === 404 || error.status === 403)
        ) {
            return { kind: 'gone' };
        }

        return { kind: 'failed' };
    }
}

/**
 * Collapses bursts of events per task into one refetch (`delay` ms after the
 * last event of that task).
 */
export function createCardRefresher(
    apply: (taskId: string, result: CardResult) => void,
    fetcher: (taskId: string) => Promise<CardResult> = fetchTaskCard,
    delay = 200,
) {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    return {
        schedule(taskId: string) {
            const pending = timers.get(taskId);

            if (pending !== undefined) {
                clearTimeout(pending);
            }

            timers.set(
                taskId,
                setTimeout(() => {
                    timers.delete(taskId);
                    void fetcher(taskId).then((result) =>
                        apply(taskId, result),
                    );
                }, delay),
            );
        },
        cancel() {
            timers.forEach((timer) => clearTimeout(timer));
            timers.clear();
        },
    };
}
