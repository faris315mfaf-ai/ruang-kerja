import { Link } from '@inertiajs/react';
import { Check, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MILESTONE_STATE_LABEL, shortDate } from './lib';
import { ArusSkeleton, EmptyState, FOCUS_RING, Panel } from './panel';
import type { ManagementPortfolio, MilestoneItem } from './types';

/** Items shown before "+N lainnya". */
const VISIBLE = 9;

function Dot({ item }: { item: MilestoneItem }) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex size-[22px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-arus-on-gradient',
                item.state === 'done' && 'bg-arus-action',
                item.state === 'missed' && 'bg-arus-fill-danger',
                item.state === 'next' &&
                    'border-4 border-arus-accent bg-arus-surface',
                item.state === 'todo' &&
                    'border-2 border-arus-border-strong bg-arus-surface',
            )}
        >
            {item.state === 'done' && (
                <Check className="size-3.5" strokeWidth={3} />
            )}
            {item.state === 'missed' && '!'}
        </span>
    );
}

/** "Milestone Oktober": timeline of this month's milestones of the viewer's projects. */
export function MilestonesPanel({
    milestones,
    canSeePortfolio,
    className,
}: {
    milestones: ManagementPortfolio['milestones'];
    canSeePortfolio: boolean;
    className?: string;
}) {
    const items = milestones.items.slice(0, VISIBLE);
    const rest = milestones.items.length - items.length;

    return (
        <Panel
            title={`Milestone ${milestones.month}`}
            action={
                <span className="text-[15px] font-bold text-arus-text-2">
                    {milestones.done} / {milestones.total} selesai
                </span>
            }
            className={className}
        >
            {items.length === 0 ? (
                <EmptyState
                    icon={Flag}
                    title={`Tidak ada milestone di bulan ${milestones.month}`}
                >
                    Milestone proyek yang jatuh tempo bulan ini akan tampil di
                    sini.
                </EmptyState>
            ) : (
                <ol className="flex flex-col pt-1">
                    {items.map((item, index) => {
                        const last = index === items.length - 1 && rest === 0;

                        return (
                            <li
                                key={item.id}
                                className="relative flex gap-3.5 pb-3.5"
                            >
                                <span className="flex shrink-0 flex-col items-center">
                                    <Dot item={item} />
                                    {!last && (
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'mt-1 w-0.5 flex-1',
                                                item.state === 'done'
                                                    ? 'bg-arus-accent'
                                                    : 'bg-arus-border',
                                            )}
                                        />
                                    )}
                                </span>
                                <span className="mt-px flex min-w-0 flex-1 flex-col gap-px">
                                    <span
                                        className={cn(
                                            'text-[15px] font-bold',
                                            item.state === 'missed' &&
                                                'text-arus-danger',
                                        )}
                                    >
                                        {item.name}
                                        <span className="sr-only">
                                            {' '}
                                            —{' '}
                                            {MILESTONE_STATE_LABEL[item.state]}
                                        </span>
                                    </span>
                                    <span className="text-[14px] text-arus-text-2">
                                        <Link
                                            href={item.project.url}
                                            prefetch
                                            title={item.project.name}
                                            aria-label={`${item.project.key}, ${item.project.name}`}
                                            className={cn(
                                                'rounded font-mono text-[13px] font-bold text-arus-link hover:underline',
                                                FOCUS_RING,
                                            )}
                                        >
                                            {item.project.key}
                                        </Link>
                                        {' · '}
                                        {shortDate(item.target_date)}
                                        {item.state === 'missed' &&
                                            ' · terlewat'}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                    {rest > 0 && (
                        <li className="pl-9 text-[15px] text-arus-text-2">
                            +{rest} milestone lainnya
                            {canSeePortfolio && (
                                <>
                                    {' di '}
                                    <Link
                                        href="/portofolio"
                                        prefetch
                                        className={cn(
                                            'font-semibold text-arus-link',
                                            FOCUS_RING,
                                        )}
                                    >
                                        Portofolio
                                    </Link>
                                </>
                            )}
                        </li>
                    )}
                </ol>
            )}
        </Panel>
    );
}

export function MilestonesPanelSkeleton({ className }: { className?: string }) {
    return (
        <Panel
            title="Milestone bulan ini"
            className={className}
            bodyClassName="gap-4"
        >
            {[0, 1, 2, 3, 4].map((key) => (
                <div key={key} className="flex gap-3.5">
                    <ArusSkeleton className="size-[22px] rounded-full" />
                    <ArusSkeleton className="h-10 flex-1" />
                </div>
            ))}
        </Panel>
    );
}
