import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import okrRoutes from '@/routes/okr';
import keyResultRoutes from '@/routes/okr/key-results';
import keyResultTaskRoutes from '@/routes/okr/key-results/tasks';
import type { FormErrors } from './api';
import { submit } from './api';
import type { KrDraft } from './lib';
import { applyCheckin, draftToPayload, summarizeObjective } from './lib';
import type { KeyResult, Objective, ObjectiveDetailProps } from './types';

export type ObjectivePayload = {
    quarter: string;
    title: string;
    description: string;
    owner_id: string;
    status: 'draft' | 'active';
};

/**
 * State of /okr/{objective}: the server props (re-synced after every visit)
 * plus an optimistic check-in that rolls back when the server refuses it.
 * Every mutation is an Inertia visit; the server flashes the success toast
 * and sends the fresh objective as props.
 */
export function useObjective(props: ObjectiveDetailProps) {
    const [objective, setObjective] = useState<Objective>(props.objective);
    const [synced, setSynced] = useState<Objective>(props.objective);
    const [processing, setProcessing] = useState(false);
    const { auth } = usePage().props;

    // New props after a visit replace the local (optimistic) copy.
    if (synced !== props.objective) {
        setSynced(props.objective);
        setObjective(props.objective);
    }

    const summary = summarizeObjective(objective, props.today);
    const busy = {
        onStart: () => setProcessing(true),
        onFinish: () => setProcessing(false),
    };

    const saveKr = (
        draft: KrDraft,
        base: KeyResult | null,
        onErrors: (errors: FormErrors) => void,
    ) =>
        submit(
            base
                ? keyResultRoutes.update(base.id)
                : keyResultRoutes.store(objective.id),
            draftToPayload(draft),
            { ...busy, onErrors },
        );

    const deleteKr = (kr: KeyResult) =>
        submit(keyResultRoutes.destroy(kr.id), {}, busy);

    const checkin = async (
        kr: KeyResult,
        value: number,
        confidence: number | null,
        note: string,
        onErrors: (errors: FormErrors) => void,
    ) => {
        const previous = objective;

        setObjective((current) => ({
            ...current,
            key_results: current.key_results.map((item) =>
                item.id === kr.id
                    ? applyCheckin(item, {
                          id: `optimistic-${Date.now()}`,
                          date: props.today,
                          value,
                          confidence,
                          note: note.trim() || null,
                          author: {
                              id: auth.user?.id ?? '',
                              name: auth.user?.name ?? 'Anda',
                          },
                      })
                    : item,
            ),
        }));

        const saved = await submit(
            keyResultRoutes.checkin(kr.id),
            { value, confidence, note: note.trim() || null },
            { ...busy, onErrors },
        );

        if (!saved) {
            setObjective(previous);
        }

        return saved;
    };

    const saveObjective = (
        payload: ObjectivePayload,
        onErrors: (errors: FormErrors) => void,
    ) =>
        submit(okrRoutes.update(objective.id), payload, {
            ...busy,
            onErrors,
        });

    const reopen = () =>
        submit(
            okrRoutes.update(objective.id),
            {
                quarter: objective.quarter,
                title: objective.title,
                description: objective.description ?? '',
                owner_id: objective.owner.id,
                status: 'active',
            },
            busy,
        );

    const close = () => submit(okrRoutes.close(objective.id), {}, busy);

    const linkTask = (kr: KeyResult, taskId: string) =>
        submit(keyResultTaskRoutes.store(kr.id), { task_id: taskId }, busy);

    const unlinkTask = (kr: KeyResult, taskId: string) =>
        submit(
            keyResultTaskRoutes.destroy({ keyResult: kr.id, task: taskId }),
            {},
            busy,
        );

    return {
        objective,
        summary,
        processing,
        saveKr,
        deleteKr,
        checkin,
        saveObjective,
        reopen,
        close,
        linkTask,
        unlinkTask,
    };
}
