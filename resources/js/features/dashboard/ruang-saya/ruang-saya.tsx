import { useEffect, useMemo } from 'react';
import { useTaskComposer } from '@/features/tasks/form/task-composer';
import { LANES } from './lib';
import { RuangSayaDesktop } from './ruang-saya.desktop';
import { RuangSayaMobile } from './ruang-saya.mobile';
import type { Planner, PlannerItem } from './types';
import { useRuangSaya } from './use-ruang-saya';

/**
 * "Ruang saya" on Beranda: the viewer's own plan over their assigned tasks
 * and personal notes (App\Domain\Planner). Titles open the task sheet on
 * desktop/tablet and the full-screen detail on phones; changes made in the
 * sheet reload the planner.
 */
export function RuangSaya({
    planner,
    variant,
}: {
    planner: Planner;
    variant: 'desktop' | 'mobile';
}) {
    const state = useRuangSaya(planner);
    const composer = useTaskComposer();
    const { registerList } = composer;
    const { refresh } = state;
    const ids = useMemo(
        () =>
            LANES.flatMap((lane) =>
                state.planner.lanes[lane]
                    .filter((item) => !item.pending)
                    .map((item) => item.id),
            ),
        [state.planner],
    );
    const idList = ids.join(',');

    useEffect(() => {
        registerList({
            ids: idList === '' ? [] : idList.split(','),
            onTaskChange: () => refresh(),
        });
    }, [idList, refresh, registerList]);

    const onOpen = (item: Pick<PlannerItem, 'id' | 'key' | 'number' | 'url'>) =>
        composer.openEdit(item);

    return variant === 'mobile' ? (
        <RuangSayaMobile state={state} onOpen={onOpen} />
    ) : (
        <RuangSayaDesktop state={state} onOpen={onOpen} />
    );
}
