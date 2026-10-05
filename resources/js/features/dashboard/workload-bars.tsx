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
 * "Beban kerja": open tasks per person as horizontal bars, split into on
 * schedule (primary) and overdue (danger), scaled to the busiest person.
 * The numbers are always printed next to the bar ("11 · 3").
 */
export function WorkloadBars({ rows, limit, className }: Props) {
    const max = Math.max(1, ...rows.map((row) => row.open));
    const shown = limit ? rows.slice(0, limit) : rows;

    return (
        <div className={className}>
            <ul className="space-y-2.5">
                {shown.map((row) => {
                    const onTrack = row.open - row.overdue;

                    return (
                        <li
                            key={row.user.id}
                            className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm"
                        >
                            <span className="truncate text-text">
                                {row.user.name}
                            </span>
                            <span
                                className="flex h-2 overflow-hidden rounded-full bg-surface-2"
                                aria-hidden
                            >
                                <span
                                    className="h-full bg-primary"
                                    style={{ width: `${share(onTrack, max)}%` }}
                                />
                                {row.overdue > 0 && (
                                    <span
                                        className="h-full border-l-2 border-surface bg-danger"
                                        style={{
                                            width: `${share(row.overdue, max)}%`,
                                        }}
                                    />
                                )}
                            </span>
                            <span className="min-w-12 text-right text-text tnum">
                                <span className="sr-only">
                                    {row.open} tugas terbuka
                                    {row.overdue > 0
                                        ? `, ${row.overdue} terlambat`
                                        : ''}
                                </span>
                                <span aria-hidden>
                                    {row.open}
                                    {row.overdue > 0 && (
                                        <span className="text-danger">
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
            <p
                className={cn(
                    'mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted',
                )}
            >
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2 rounded-full bg-primary"
                        aria-hidden
                    />
                    Sesuai jadwal
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2 rounded-full bg-danger"
                        aria-hidden
                    />
                    Terlambat
                </span>
            </p>
        </div>
    );
}
