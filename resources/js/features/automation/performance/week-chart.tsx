import { weekBars, weekLabel } from '@/features/automation/performance';
import type { WeekBucket } from '@/features/automation/types';
import { cn } from '@/lib/utils';

/**
 * SKinerja "Tugas selesai per minggu": stacked bar per week — on time in the
 * brand gradient, late in warning orange on top — total above, week below.
 * The bars are decorative; a visually hidden table carries the numbers.
 */
export function WeekChart({
    weeks,
    compact = false,
}: {
    weeks: WeekBucket[];
    compact?: boolean;
}) {
    const plot = compact ? 96 : 150;
    const bars = weekBars(weeks, plot);
    const last = bars.length - 1;

    return (
        <figure className="m-0">
            <div
                aria-hidden
                className={cn(
                    'flex items-end',
                    compact ? 'gap-2' : 'gap-3 lg:gap-4',
                )}
            >
                {bars.map((bar, index) => (
                    <div
                        key={bar.week_start}
                        className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                    >
                        <span
                            className={cn(
                                'font-bold text-text tnum',
                                compact ? 'text-[13px]' : 'text-[15px]',
                            )}
                        >
                            {bar.total}
                        </span>
                        <div
                            className={cn(
                                'flex w-full flex-col overflow-hidden',
                                compact
                                    ? 'rounded-[7px]'
                                    : 'max-w-12 rounded-[10px]',
                            )}
                            style={{
                                height: Math.max(4, bar.onTimeH + bar.lateH),
                            }}
                        >
                            {bar.lateH > 0 && (
                                <div
                                    className="shrink-0 bg-fill-warning"
                                    style={{ height: bar.lateH }}
                                />
                            )}
                            <div className="flex-1 bg-primary bg-grad-merek-y" />
                        </div>
                        <span
                            className={cn(
                                'whitespace-nowrap tnum',
                                compact
                                    ? 'text-[12px] font-semibold'
                                    : 'text-[14px]',
                                index === last
                                    ? 'font-extrabold text-text'
                                    : 'font-medium text-text-muted',
                            )}
                        >
                            {weekLabel(bar.week_start, compact)}
                        </span>
                    </div>
                ))}
            </div>
            {/* Tables ignore sr-only's 1px box; the wrapper keeps them from
                widening the page on narrow screens. */}
            <div className="sr-only">
                <table>
                    <caption>Tugas selesai per minggu</caption>
                    <thead>
                        <tr>
                            <th scope="col">Minggu mulai</th>
                            <th scope="col">Tepat waktu</th>
                            <th scope="col">Lewat tenggat</th>
                        </tr>
                    </thead>
                    <tbody>
                        {weeks.map((week) => (
                            <tr key={week.week_start}>
                                <th scope="row">
                                    {weekLabel(week.week_start)}
                                </th>
                                <td>{week.on_time}</td>
                                <td>{week.late}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </figure>
    );
}

export function WeekLegend({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                'flex flex-wrap gap-4 text-[15px] text-text-muted',
                className,
            )}
        >
            <span className="inline-flex items-center gap-2">
                <span
                    aria-hidden
                    className="size-3 rounded-[4px] bg-grad-merek"
                />
                Tepat waktu
            </span>
            <span className="inline-flex items-center gap-2">
                <span
                    aria-hidden
                    className="size-3 rounded-[4px] bg-fill-warning"
                />
                Lewat tenggat
            </span>
        </div>
    );
}
