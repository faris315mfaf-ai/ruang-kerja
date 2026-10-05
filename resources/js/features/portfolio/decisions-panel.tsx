import { CircleCheck } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { cn } from '@/lib/utils';
import { shortDay } from './lib';
import type { AttentionItem, DecisionItem } from './types';
import type { PortfolioActions } from './use-portfolio';

function attentionText(item: AttentionItem): string {
    return [
        item.metrics.flags.includes('behind')
            ? `Tertinggal ${Math.abs(Math.round(item.metrics.variance ?? 0))} poin`
            : null,
        item.metrics.update_age_days === null
            ? 'belum ada update'
            : item.metrics.flags.includes('stale_update')
              ? `belum ada update ${item.metrics.update_age_days} hari`
              : null,
        !item.metrics.flags.includes('behind') && item.health === 'off_track'
            ? 'Bermasalah menurut PIC'
            : null,
    ]
        .filter(Boolean)
        .join(', ');
}

/**
 * "Butuh keputusan Anda" (DPortofolio) + "Perlu perhatian": each decision
 * shows project · requester · date, the question in 20px and the summary,
 * with "Diskusikan" / "Setujui" for Direksi.
 */
export function DecisionsPanel({
    decisions,
    attention,
    canSteer,
    actions,
    compact = false,
    className,
}: {
    decisions: DecisionItem[];
    attention: AttentionItem[];
    canSteer: boolean;
    actions: PortfolioActions;
    compact?: boolean;
    className?: string;
}) {
    return (
        <div id="keputusan" className={cn('scroll-mt-24', className)}>
            <Panel
                title={
                    <>
                        Butuh keputusan Anda
                        <Badge
                            className={cn(
                                'h-7 px-2.5 text-[15px]',
                                decisions.length > 0 && 'bg-grad-hangat',
                            )}
                        >
                            {decisions.length}
                        </Badge>
                    </>
                }
                action={
                    attention.length > 0 && (
                        <span className="text-meta text-text-muted">
                            +{attention.length} perlu perhatian
                        </span>
                    )
                }
                className={compact ? 'pt-5 pb-2' : 'pb-2'}
            >
                {decisions.length === 0 && attention.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={CircleCheck}
                        title="Tidak ada keputusan yang menunggu"
                        className="mb-4"
                    />
                ) : (
                    <ul className="divide-y divide-divider">
                        {decisions.map((item) => {
                            const project = {
                                key: item.project.key,
                                name: item.project.name,
                            };

                            return (
                                <li
                                    key={item.id}
                                    className="flex flex-col gap-2.5 py-[18px]"
                                >
                                    <p className="text-label font-normal text-text-muted">
                                        <span className="font-mono font-semibold">
                                            {item.project.key}
                                        </span>{' '}
                                        · {item.project.name} · diminta{' '}
                                        {item.author?.name ?? 'PIC'},{' '}
                                        {shortDay(item.created_at.slice(0, 10))}
                                    </p>
                                    <p className="text-[20px] leading-7 font-bold max-md:text-[18px] max-md:leading-6">
                                        {item.decision}
                                    </p>
                                    <p
                                        className={cn(
                                            'text-body-lg text-text-muted max-md:text-[16px] max-md:leading-6',
                                            compact && 'line-clamp-3',
                                        )}
                                    >
                                        {item.summary}
                                    </p>
                                    {canSteer && (
                                        <div
                                            className={cn(
                                                'flex gap-2.5',
                                                compact && 'grid grid-cols-2',
                                            )}
                                        >
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    actions.openDirection(
                                                        project,
                                                        item.id,
                                                        item.decision,
                                                    )
                                                }
                                            >
                                                Diskusikan
                                            </Button>
                                            <Button
                                                disabled={
                                                    actions.resolving ===
                                                    item.id
                                                }
                                                onClick={() =>
                                                    actions.resolve(
                                                        project,
                                                        item.id,
                                                    )
                                                }
                                                title="Setujui dan tandai keputusan selesai"
                                            >
                                                Setujui
                                            </Button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
                {attention.length > 0 && (
                    <div className="border-t border-divider pt-4">
                        <p className="text-overline text-text-muted">
                            Perlu perhatian
                        </p>
                        <ul className="divide-y divide-divider">
                            {attention.map((item) => {
                                const missed =
                                    item.metrics.missed_milestones[0];

                                return (
                                    <li
                                        key={item.project.id}
                                        className={cn(
                                            'flex gap-3 py-3.5',
                                            compact
                                                ? 'items-center'
                                                : 'items-start justify-between',
                                        )}
                                    >
                                        <div className="flex min-w-0 flex-col gap-1">
                                            <p className="text-[16px] font-semibold">
                                                <span className="mr-2 font-mono text-[14px] text-text-muted">
                                                    {item.project.key}
                                                </span>
                                                {attentionText(item)}
                                            </p>
                                            {!compact && (
                                                <p className="text-label font-normal text-text-muted">
                                                    {missed &&
                                                        `Milestone "${missed.name}" (${shortDay(missed.target_date)}) terlewat. `}
                                                    PIC {item.lead?.name ?? '–'}
                                                    {item.is_sponsor &&
                                                        '; Anda sponsor proyek ini'}
                                                    .
                                                </p>
                                            )}
                                        </div>
                                        {canSteer && (
                                            <Button
                                                variant="tonal"
                                                size="sm"
                                                className="shrink-0 max-md:h-11"
                                                onClick={() =>
                                                    actions.openRequest(
                                                        {
                                                            key: item.project
                                                                .key,
                                                            name: item.project
                                                                .name,
                                                        },
                                                        item.lead?.name ?? null,
                                                    )
                                                }
                                            >
                                                Minta update
                                            </Button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </Panel>
        </div>
    );
}
