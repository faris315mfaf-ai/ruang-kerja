import { Link } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { HiringTile } from './hiring-shell';
import { hiringUrls } from './lib';
import type { HiringOverview } from './types';

/**
 * The Hiring space as a special card on /workspace (HR, Super Admin and
 * assigned interviewers / final approvers): open positions, new applicants,
 * candidates waiting for a decision.
 */
export function HiringWorkspaceCard({
    overview,
}: {
    overview: HiringOverview;
}) {
    const { counts } = overview;
    const stats = [
        { label: 'Lowongan dibuka', value: counts.open_positions },
        { label: 'Kandidat baru', value: counts.new_candidates },
        { label: 'Menunggu keputusan', value: counts.awaiting_decision },
    ];

    return (
        <Link
            href={hiringUrls.index()}
            prefetch
            className={cn(
                'flex h-full flex-col gap-3.5 rounded-panel border border-border bg-surface p-[18px] text-text shadow-card transition-[border-color,box-shadow] duration-120 ease-brand hover:border-border-strong md:p-[22px]',
                focusRing,
            )}
        >
            <span className="flex items-center gap-3">
                <HiringTile className="size-12 rounded-[14px]" />
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 text-title font-bold">
                        Hiring
                    </span>
                    <span className="truncate text-meta text-text-muted">
                        Ruang khusus rekrutmen
                    </span>
                </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
                <Badge variant="status" className="h-7 px-2.5 text-[14px]">
                    {overview.can_manage ? 'Pengelola' : 'Tim penilai'}
                </Badge>
                {counts.awaiting_decision > 0 && (
                    <Badge
                        variant="status"
                        tone="warning"
                        dot
                        className="h-7 px-2.5 text-[14px]"
                    >
                        Perlu keputusan
                    </Badge>
                )}
            </span>
            <span className="mt-auto grid grid-cols-3 gap-2 border-t border-divider pt-2.5">
                {stats.map((stat) => (
                    <span key={stat.label} className="flex flex-col">
                        <b className="text-title text-text tnum">
                            {formatNumber(stat.value)}
                        </b>
                        <span className="text-meta leading-tight text-text-muted">
                            {stat.label}
                        </span>
                    </span>
                ))}
            </span>
        </Link>
    );
}
