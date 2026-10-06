import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { EmptyState } from '@/components/empty-state';
import { formatNumber } from '@/lib/format';
import { CandidateCard } from './candidate-card';
import { groupByStage, STAGE_LABELS, STAGES } from './lib';
import type { CandidateCard as Card, CandidateStage } from './types';

/**
 * Desktop/tablet: one column per stage (Masuk … Ditolak), scrolling
 * sideways inside its own area when the columns do not fit. Moving a card
 * is done with its "Pindahkan" menu (no drag & drop).
 */
export function CandidateBoard({
    candidates,
    canManage,
    showPosition,
}: {
    candidates: Card[];
    canManage: boolean;
    showPosition: boolean;
}) {
    const groups = groupByStage(candidates);

    return (
        <div className="relative w-full min-w-0 overflow-x-auto pb-2">
            <div className="grid auto-cols-[minmax(232px,1fr)] grid-flow-col gap-3">
                {STAGES.map((stage) => (
                    <section
                        key={stage}
                        aria-labelledby={`stage-${stage}`}
                        className="flex min-w-0 flex-col gap-3 rounded-panel border border-border bg-surface-2/60 p-3"
                    >
                        <h2
                            id={`stage-${stage}`}
                            className="flex items-center justify-between gap-2 px-1 pt-1 text-[16px] font-bold text-text"
                        >
                            {STAGE_LABELS[stage]}
                            <span className="text-[14px] font-semibold text-text-muted tnum">
                                {formatNumber(groups[stage].length)}
                            </span>
                        </h2>
                        {groups[stage].length === 0 ? (
                            <p className="rounded-lg border border-dashed border-border-strong px-3 py-6 text-center text-meta text-text-muted">
                                Belum ada kandidat
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-3">
                                {groups[stage].map((candidate) => (
                                    <li key={candidate.id}>
                                        <CandidateCard
                                            candidate={candidate}
                                            canManage={canManage}
                                            showPosition={showPosition}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                ))}
            </div>
        </div>
    );
}

type Filter = 'all' | CandidateStage;

/** Phone: stage chips (with counts) above a single list of cards. */
export function CandidateList({
    candidates,
    canManage,
    showPosition,
}: {
    candidates: Card[];
    canManage: boolean;
    showPosition: boolean;
}) {
    const [filter, setFilter] = useState<Filter>('all');
    const groups = groupByStage(candidates);
    const visible =
        filter === 'all' ? candidates : groups[filter as CandidateStage];

    return (
        <div className="flex flex-col gap-4">
            <ChipScroller<Filter>
                label="Tahap"
                value={filter}
                onChange={setFilter}
                chips={[
                    { value: 'all', label: 'Semua', count: candidates.length },
                    ...STAGES.map((stage) => ({
                        value: stage,
                        label: STAGE_LABELS[stage],
                        count: groups[stage].length,
                    })),
                ]}
            />
            {visible.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={Inbox}
                    title="Belum ada kandidat di tahap ini"
                />
            ) : (
                <ul className="flex flex-col gap-3">
                    {visible.map((candidate) => (
                        <li key={candidate.id}>
                            <CandidateCard
                                candidate={candidate}
                                canManage={canManage}
                                showPosition={showPosition}
                                showStage={filter === 'all'}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
