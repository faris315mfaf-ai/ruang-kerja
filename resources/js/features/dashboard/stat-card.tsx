import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { MetricDefinition } from '@/types/dashboard';
import type { DeltaInfo, DeltaTone } from './lib';
import { MetricInfo } from './metric-info';

const VALUE_TONES = {
    default: 'text-text',
    danger: 'text-danger',
    warning: 'text-warning',
    success: 'text-success',
    info: 'text-info',
} as const;

const DELTA_TONES: Record<DeltaTone, string> = {
    success: 'text-success',
    danger: 'text-danger',
    neutral: 'text-text-muted',
};

export type StatCardProps = {
    label: string;
    value: string;
    /** Small text after the number: "/ 14 terjadwal", "hari". */
    suffix?: string;
    valueTone?: keyof typeof VALUE_TONES;
    /** Tooltip with the metric formula. */
    definition?: Pick<MetricDefinition, 'label' | 'definition'> | string;
    delta?: DeltaInfo | null;
    caption?: ReactNode;
    className?: string;
    compact?: boolean;
};

/**
 * KPI tile (docs/DESIGN.md §6 StatCard): small label, 28px `tnum` number,
 * delta vs the previous period (green/red + arrow) and a caption.
 */
export function StatCard({
    label,
    value,
    suffix,
    valueTone = 'default',
    definition,
    delta,
    caption,
    className,
    compact = false,
}: StatCardProps) {
    const Arrow =
        delta?.direction === 'up'
            ? ArrowUpRight
            : delta?.direction === 'down'
              ? ArrowDownRight
              : Minus;

    return (
        <section
            className={cn(
                'flex min-w-0 flex-col rounded-xl border border-border bg-surface shadow-card',
                compact ? 'p-3' : 'p-4',
                className,
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <h3 className="text-[13px] leading-5 text-text-muted">
                    {label}
                </h3>
                {definition && <MetricInfo definition={definition} />}
            </div>
            <p className="mt-1.5 flex items-baseline gap-1.5">
                <span
                    className={cn(
                        'font-semibold tnum',
                        compact
                            ? 'text-2xl leading-8'
                            : 'text-[28px] leading-9',
                        VALUE_TONES[valueTone],
                    )}
                >
                    {value}
                </span>
                {suffix && (
                    <span className="text-sm text-text-muted tnum">
                        {suffix}
                    </span>
                )}
            </p>
            {delta && (
                <p
                    className={cn(
                        'mt-1 flex items-center gap-1 text-[13px] tnum',
                        DELTA_TONES[delta.tone],
                    )}
                >
                    <Arrow className="size-3.5 shrink-0" aria-hidden />
                    {delta.text}
                </p>
            )}
            {caption && (
                <div className="mt-1 text-[13px] leading-5 text-text-muted tnum">
                    {caption}
                </div>
            )}
        </section>
    );
}

export function StatCardSkeleton({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                'rounded-xl border border-border bg-surface p-4 shadow-card',
                className,
            )}
            aria-hidden
        >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-2 h-4 w-32" />
        </div>
    );
}
