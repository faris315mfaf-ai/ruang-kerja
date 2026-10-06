import { useCallback, useEffect, useReducer, useRef } from 'react';
import { toast } from 'sonner';
import { ApiError, requestJson } from '@/features/tasks/lib/api';
import {
    complete as completeRoute,
    plan as planRoute,
    show as showRoute,
    store as storeRoute,
    unplan as unplanRoute,
} from '@/routes/planner';
import { move as moveRoute } from '@/routes/tasks';
import type { PlannerAction } from './lib';
import {
    LANE_LABELS,
    plannedNeighbours,
    plannerReducer,
    splitLane,
} from './lib';
import type { Lane, Planner, PlannerItem } from './types';

type Snapshot = { planner: Planner };

type CompleteResponse = Snapshot & {
    outcome: 'review' | 'done';
    previous_status_id: string;
};

export type RuangSaya = {
    planner: Planner;
    /** Accept / move / reorder. `index` = position among the lane's open cards. */
    plan: (id: string, lane: Lane, index?: number) => void;
    unplan: (id: string) => void;
    complete: (item: PlannerItem) => void;
    /** Resolves true when the note was saved (the input may be cleared). */
    add: (title: string, lane?: Lane) => Promise<boolean>;
    refresh: () => void;
};

function message(error: unknown): string {
    return error instanceof ApiError
        ? error.message
        : 'Terjadi kesalahan. Coba lagi sebentar lagi.';
}

/**
 * State of "Ruang saya" (shared by the desktop and phone views): every
 * change is applied optimistically, sent as JSON, and replaced by the
 * planner the server answers with. A failure rolls back to the state before
 * the change (or reloads it when another change is in flight) with a toast.
 */
export function useRuangSaya(initial: Planner): RuangSaya {
    const [planner, dispatch] = useReducer(plannerReducer, initial);
    const current = useRef(planner);
    const latest = useRef(0);

    current.current = planner;

    // A fresh `planner` prop (Inertia reload) wins over local state.
    useEffect(() => {
        dispatch({ type: 'replace', planner: initial });
    }, [initial]);

    const refresh = useCallback(() => {
        const seq = ++latest.current;

        requestJson<Snapshot>(showRoute())
            .then((response) => {
                if (seq === latest.current) {
                    dispatch({ type: 'replace', planner: response.planner });
                }
            })
            .catch(() => undefined);
    }, []);

    /** Optimistic action + request; returns the response or null on failure. */
    const run = useCallback(
        async <T extends Snapshot>(
            action: PlannerAction | null,
            request: () => Promise<T>,
        ): Promise<T | null> => {
            const before = current.current;
            const seq = ++latest.current;

            if (action) {
                dispatch(action);
            }

            try {
                const response = await request();

                if (seq === latest.current) {
                    dispatch({ type: 'replace', planner: response.planner });
                }

                return response;
            } catch (error) {
                if (seq === latest.current) {
                    dispatch({ type: 'replace', planner: before });
                } else {
                    refresh();
                }

                toast.error(message(error));

                return null;
            }
        },
        [refresh],
    );

    const plan = useCallback(
        (id: string, lane: Lane, index?: number) => {
            const open = splitLane(current.current.lanes[lane]).open.filter(
                (item) => item.id !== id,
            );
            const neighbours =
                index === undefined
                    ? { after_id: null, before_id: null }
                    : plannedNeighbours(open, index);

            void run({ type: 'plan', id, lane, index }, () =>
                requestJson<Snapshot>(planRoute(id), {
                    bucket: lane,
                    ...neighbours,
                }),
            );
        },
        [run],
    );

    const unplan = useCallback(
        (id: string) => {
            void run({ type: 'unplan', id }, () =>
                requestJson<Snapshot>(unplanRoute(id)),
            );
        },
        [run],
    );

    const undo = useCallback(
        (item: PlannerItem, previousStatusId: string) => {
            void run(null, async () => {
                await requestJson(moveRoute(item.id), {
                    status_id: previousStatusId,
                });

                return requestJson<Snapshot>(showRoute());
            }).then((response) => {
                if (response) {
                    toast.success(`${item.key} dikembalikan`);
                }
            });
        },
        [run],
    );

    const complete = useCallback(
        (item: PlannerItem) => {
            const outcome = item.completes_to ?? 'done';

            void run(
                {
                    type: 'complete',
                    id: item.id,
                    outcome,
                    now: new Date().toISOString(),
                },
                () => requestJson<CompleteResponse>(completeRoute(item.id)),
            ).then((response) => {
                if (!response) {
                    return;
                }

                toast.success(
                    response.outcome === 'review'
                        ? `${item.key} dikirim ke Review`
                        : `${item.key} selesai`,
                    {
                        action: {
                            label: 'Urungkan',
                            onClick: () =>
                                undo(item, response.previous_status_id),
                        },
                    },
                );
            });
        },
        [run, undo],
    );

    const add = useCallback(
        async (title: string, lane: Lane = 'today') => {
            const trimmed = title.trim();

            if (trimmed === '') {
                return false;
            }

            const temp: PlannerItem = {
                id: `temp-${Date.now()}`,
                key: '…',
                number: 0,
                title: trimmed,
                url: '',
                workspace: { name: 'Pribadi', key: '', type: 'personal' },
                due_date: null,
                days_late: 0,
                priority: 0,
                status: { id: '', name: 'Todo', category: 'todo' },
                is_personal: true,
                checklist: null,
                lane,
                auto: false,
                carried: false,
                done: false,
                completed_at: null,
                can_complete: false,
                completes_to: null,
                complete_hint: null,
                pending: true,
            };

            const response = await run({ type: 'add', item: temp }, () =>
                requestJson<Snapshot>(storeRoute(), {
                    title: trimmed,
                    bucket: lane,
                }),
            );

            if (response) {
                toast.success(`Catatan masuk ke ${LANE_LABELS[lane]}`);
            }

            return response !== null;
        },
        [run],
    );

    return { planner, plan, unplan, complete, add, refresh };
}
