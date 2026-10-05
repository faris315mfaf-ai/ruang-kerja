import { cn } from '@/lib/utils';

const FILLS = {
    brand: 'bg-grad-merek-x',
    success: 'bg-success',
    warning: 'bg-fill-warning',
    danger: 'bg-fill-danger',
    info: 'bg-accent-blue-strong',
} as const;

const HEIGHTS = { sm: 'h-2', md: 'h-2.5', lg: 'h-3.5' } as const;

/**
 * Progress bar (Komponen "Progres proyek"): surface-2 track, gradient merek
 * fill, optional plan marker. `label` names it for screen readers.
 */
export function Progress({
    value,
    label,
    marker,
    markerLabel,
    tone = 'brand',
    size = 'md',
    className,
}: {
    /** 0–100. */
    value: number;
    label: string;
    /** Planned position 0–100 (dark tick above the bar). */
    marker?: number;
    markerLabel?: string;
    tone?: keyof typeof FILLS;
    size?: keyof typeof HEIGHTS;
    className?: string;
}) {
    const clamp = (n: number) => Math.min(100, Math.max(0, n));
    const pct = clamp(value);

    return (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-valuetext={
                marker !== undefined
                    ? `${Math.round(pct)}%, ${markerLabel ?? 'rencana'} ${Math.round(clamp(marker))}%`
                    : undefined
            }
            className={cn(
                'relative w-full rounded-full bg-surface-2',
                HEIGHTS[size],
                className,
            )}
        >
            <div
                className={cn('h-full rounded-full', FILLS[tone])}
                style={{ width: `${pct}%` }}
            />
            {marker !== undefined && (
                <span
                    aria-hidden
                    className="absolute -top-1 -bottom-1 w-[3px] -translate-x-1/2 rounded-[2px] bg-marker"
                    style={{ left: `${clamp(marker)}%` }}
                />
            )}
        </div>
    );
}
