import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    barHeights,
    CHART_BAR_MAX,
    CHART_TITLES,
    chartFoot,
    chartSummary,
} from './lib';
import { ArusSkeleton, EmptyState, Panel } from './panel';
import type { PeriodBlock, PeriodKey } from './types';

function Legend() {
    return (
        <span className="flex gap-4 text-[15px] text-arus-text-2">
            <span className="inline-flex items-center gap-1.5">
                <span
                    aria-hidden
                    className="size-3 rounded-[4px] border border-dashed border-arus-border-strong bg-arus-surface-2"
                />
                Rencana
            </span>
            <span className="inline-flex items-center gap-1.5">
                <span
                    aria-hidden
                    className="size-3 rounded-[4px] bg-arus-brand"
                />
                Selesai
            </span>
        </span>
    );
}

/**
 * "Kerja … per divisi / harian / mingguan": planned (dashed) vs done
 * (gradient) per column, heights scaled client-side. The bars are a picture;
 * the same numbers are in a visually hidden table for screen readers.
 */
export function WorkChart({
    period,
    block,
    generatedAt,
    compact = false,
    className,
}: {
    period: PeriodKey;
    block: PeriodBlock;
    generatedAt?: string;
    compact?: boolean;
    className?: string;
}) {
    const max = compact ? 130 : CHART_BAR_MAX;
    const heights = barHeights(block.chart, max);
    const foot = chartFoot(period, block, generatedAt);
    const empty = block.chart.every((column) => column.planned === 0);

    return (
        <Panel
            title={CHART_TITLES[period]}
            action={<Legend />}
            className={className}
            bodyClassName="gap-4"
        >
            {empty ? (
                <EmptyState icon={BarChart3} title="Belum ada tugas bertenggat">
                    {foot}
                </EmptyState>
            ) : (
                <figure className="m-0 flex flex-col gap-3">
                    <div
                        aria-hidden
                        className={cn(
                            'flex items-end border-b border-arus-border pt-2',
                            compact
                                ? 'h-[180px] gap-2.5'
                                : 'h-[250px] gap-[18px]',
                        )}
                    >
                        {block.chart.map((column, index) => (
                            <div
                                key={column.key}
                                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                            >
                                <span className="text-[15px] font-extrabold whitespace-nowrap">
                                    {column.done}
                                    <span className="font-semibold text-arus-text-3">
                                        /{column.planned}
                                    </span>
                                </span>
                                <span
                                    className="relative block w-full max-w-[72px] rounded-t-[12px] border border-b-0 border-dashed border-arus-border-strong bg-arus-surface-2"
                                    style={{ height: heights[index].planned }}
                                >
                                    <span
                                        className="absolute inset-x-1.5 bottom-0 rounded-t-[9px] bg-arus-brand-y"
                                        style={{ height: heights[index].done }}
                                    />
                                </span>
                            </div>
                        ))}
                    </div>
                    <div
                        aria-hidden
                        className={cn(
                            '-mt-1 flex',
                            compact ? 'gap-2.5' : 'gap-[18px]',
                        )}
                    >
                        {block.chart.map((column) => (
                            <span
                                key={column.key}
                                title={column.full_label}
                                className="min-w-0 flex-1 truncate text-center text-[14px] font-bold text-arus-text-2"
                            >
                                {column.label}
                            </span>
                        ))}
                    </div>
                    <div className="sr-only">
                        <table>
                            <caption>{chartSummary(period, block)}</caption>
                            <thead>
                                <tr>
                                    <th scope="col">
                                        {period === 'harian'
                                            ? 'Divisi'
                                            : period === 'mingguan'
                                              ? 'Hari'
                                              : 'Minggu'}
                                    </th>
                                    <th scope="col">Rencana</th>
                                    <th scope="col">Selesai</th>
                                </tr>
                            </thead>
                            <tbody>
                                {block.chart.map((column) => (
                                    <tr key={column.key}>
                                        <th scope="row">{column.full_label}</th>
                                        <td>{column.planned}</td>
                                        <td>{column.done}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <figcaption className="text-[15px] leading-[22px] text-arus-text-2">
                        {foot}
                    </figcaption>
                </figure>
            )}
        </Panel>
    );
}

export function WorkChartSkeleton({
    period,
    className,
}: {
    period: PeriodKey;
    className?: string;
}) {
    return (
        <Panel
            title={CHART_TITLES[period]}
            action={<Legend />}
            className={className}
            bodyClassName="gap-4"
        >
            <div
                aria-hidden
                className="flex h-[250px] items-end gap-[18px] border-b border-arus-border"
            >
                {[70, 120, 90, 150, 60].map((height) => (
                    <div
                        key={height}
                        className="flex h-full flex-1 items-end justify-center"
                    >
                        <ArusSkeleton
                            className="w-full max-w-[72px] rounded-b-none"
                            style={{ height }}
                        />
                    </div>
                ))}
            </div>
            <ArusSkeleton className="h-4 w-3/4" />
        </Panel>
    );
}
