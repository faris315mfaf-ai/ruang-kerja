import { usePage } from '@inertiajs/react';
import { useCallback, useMemo, useState } from 'react';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { OKR_NOW, OKR_TODAY, OWNERS } from './fixtures';
import type { KrDraft } from './lib';
import { applyCheckin, applyKrDraft, summarizeObjective } from './lib';
import type { KeyResult, Objective } from './types';

/**
 * Local state of one objective on the preview detail page: add/edit key
 * results and record check-ins (simulated save + toast). The real page will
 * post to the server and receive the updated objective as props.
 */
export function useObjective(initial: Objective) {
    const [objective, setObjective] = useState(initial);
    const { processing, run } = useFakeMutation();
    const { auth } = usePage().props;
    const me = useMemo(
        () => ({ id: 'me', name: auth.user?.name ?? 'Anda' }),
        [auth.user?.name],
    );
    const summary = summarizeObjective(objective, OKR_TODAY);

    const replaceKr = useCallback((next: KeyResult) => {
        setObjective((current) => {
            const exists = current.key_results.some((kr) => kr.id === next.id);

            return {
                ...current,
                updated_at: OKR_NOW,
                key_results: exists
                    ? current.key_results.map((kr) =>
                          kr.id === next.id ? next : kr,
                      )
                    : [...current.key_results, next],
            };
        });
    }, []);

    const saveKr = useCallback(
        (draft: KrDraft, base: KeyResult | null) =>
            run(
                () =>
                    replaceKr(
                        applyKrDraft(draft, base, {
                            objectiveId: objective.id,
                            owners: OWNERS,
                            id: `kr-baru-${Date.now()}`,
                        }),
                    ),
                {
                    success: base
                        ? 'Key result diperbarui'
                        : 'Key result ditambahkan',
                },
            ),
        [objective.id, replaceKr, run],
    );

    const checkin = useCallback(
        (
            kr: KeyResult,
            value: number,
            confidence: number | null,
            note: string,
        ) =>
            run(
                () =>
                    replaceKr(
                        applyCheckin(kr, {
                            id: `${kr.id}-c${kr.checkins.length + 1}-${Date.now()}`,
                            date: OKR_TODAY,
                            value,
                            confidence,
                            note: note.trim() || null,
                            author: me,
                        }),
                    ),
                { success: 'Check-in tersimpan' },
            ),
        [me, replaceKr, run],
    );

    return { objective, summary, processing, saveKr, checkin, me };
}
