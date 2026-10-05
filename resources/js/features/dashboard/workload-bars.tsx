import { UsersRound } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { cn } from '@/lib/utils';
import type { WorkloadRow } from '@/types/dashboard';
import { share } from './lib';

type Props = {
    rows: WorkloadRow[];
    /** Rows shown before "Lihat semua". */
    limit?: number;
    className?: string;
};

/**
 * "Beban kerja" (DBeranda): open tasks per person as a 12px bar, on schedule
 * (brand gradient) + overdue (red), scaled to the busiest person. The
 * numbers are always printed next to the bar ("11 · 3").
 */
export function WorkloadBars({ rows, limit, className }: Props) {
    const max = Math.max(1, ...rows.map((row) => row.open));
    const shown = limit ? rows.slice(0, limit) : rows;

    if (rows.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={UsersRound}
                title="Belum ada tugas terbuka"
            />
        );
    }

    return (
        <div className={cn('flex flex-col gap-4', className)}>
            <ul className="flex flex-col gap-4">
                {shown.map((row) => {
                    const onTrack = row.open - row.overdue;

                    return (
                        <li
                            key={row.user.id}
                            className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 md:grid-cols-[minmax(0,180px)_1fr_72px] md:gap-4"
                        >
                            <span className="truncate text-[16px] font-medium">
                                {row.user.name}
                            </span>
                            <span
                                className="flex h-3 overflow-hidden rounded-[6px] bg-surface-2"
                                aria-hidden
                            >
                                <span
                                    className="h-full bg-grad-merek-x"
                                    style={{ width: `${share(onTrack, max)}%` }}
                                />
                                {row.overdue > 0 && (
                                    <span
                                        className="h-full bg-fill-danger"
                                        style={{
                                            width: `${share(row.overdue, max)}%`,
                                        }}
                                    />
                                )}
                            </span>
                            <span className="text-right text-[16px] font-bold tnum">
                                <span className="sr-only">
                                    {row.open} tugas terbuka
                                    {row.overdue > 0
                                        ? `, ${row.overdue} terlambat`
                                        : ''}
                                </span>
                                <span aria-hidden>
                                    {row.open}
                                    {row.overdue > 0 && (
                                        <span className="font-semibold text-danger">
                                            {' '}
                                            · {row.overdue}
                                        </span>
                                    )}
                                </span>
                            </span>
                        </li>
                    );
                })}
            </ul>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2.5 rounded-full bg-grad-merek-x"
                        aria-hidden
                    />
                    Sesuai jadwal
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2.5 rounded-full bg-fill-danger"
                        aria-hidden
                    />
                    Terlambat
                </span>
            </p>
        </div>
    );
}
