import { ChevronDown, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { share } from '@/features/dashboard/lib';
import { WorkloadBars } from '@/features/dashboard/workload-bars';
import { formatNumber } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import type { ManagementWorkload } from './types';

/**
 * "Beban kerja" on /manajemen (keputusan pemilik 6 Okt 2026): open tasks per
 * division (busiest first); a division opens to the bars per person
 * (WorkloadBars, same metric as the Kepala Divisi dashboard).
 */
export function WorkloadPanel({
    workload,
    className,
}: {
    workload?: ManagementWorkload;
    className?: string;
}) {
    const [open, setOpen] = useState<string | null>(null);

    if (!workload) {
        return (
            <Panel
                title="Beban kerja"
                className={className}
                bodyClassName="gap-3"
            >
                {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                ))}
            </Panel>
        );
    }

    const max = Math.max(
        1,
        ...workload.divisions.map((division) => division.open),
    );

    return (
        <Panel
            title="Beban kerja"
            action={
                <span className="text-meta text-text-muted tnum">
                    {formatNumber(workload.total.open)} tugas terbuka ·{' '}
                    {workload.total.people} orang
                </span>
            }
            className={className}
            bodyClassName="gap-1"
        >
            {workload.divisions.length === 0 || workload.total.open === 0 ? (
                <EmptyState
                    size="sm"
                    icon={UsersRound}
                    title="Belum ada tugas terbuka"
                />
            ) : (
                <ul className="flex flex-col divide-y divide-divider">
                    {workload.divisions.map((division) => {
                        const key = division.id ?? 'none';
                        const expanded = open === key;
                        const panelId = `beban-${key}`;

                        return (
                            <li key={key} className="flex flex-col">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setOpen(expanded ? null : key)
                                    }
                                    aria-expanded={expanded}
                                    aria-controls={panelId}
                                    className={cn(
                                        'grid min-h-14 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg py-2 text-left md:grid-cols-[minmax(0,180px)_1fr_auto_auto]',
                                        focusRing,
                                    )}
                                >
                                    <span className="truncate text-[16px] font-semibold">
                                        {division.name}
                                    </span>
                                    <span
                                        aria-hidden
                                        className="hidden h-3 overflow-hidden rounded-[6px] bg-surface-2 md:flex"
                                    >
                                        <span
                                            className="h-full bg-grad-merek-x"
                                            style={{
                                                width: `${share(division.open - division.overdue, max)}%`,
                                            }}
                                        />
                                        <span
                                            className="h-full bg-fill-danger"
                                            style={{
                                                width: `${share(division.overdue, max)}%`,
                                            }}
                                        />
                                    </span>
                                    <span className="text-right text-[16px] font-bold tnum">
                                        {division.open}
                                        {division.overdue > 0 && (
                                            <span className="font-semibold text-danger">
                                                {' '}
                                                · {division.overdue}
                                            </span>
                                        )}
                                        <span className="sr-only">
                                            {' '}
                                            tugas terbuka, {
                                                division.overdue
                                            }{' '}
                                            terlambat
                                        </span>
                                    </span>
                                    <ChevronDown
                                        aria-hidden
                                        className={cn(
                                            'size-5 text-text-subtle transition-transform duration-180 ease-brand motion-reduce:transition-none',
                                            expanded && 'rotate-180',
                                        )}
                                    />
                                </button>
                                {expanded && (
                                    <div id={panelId} className="pt-2 pb-4">
                                        <WorkloadBars rows={division.people} />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}
