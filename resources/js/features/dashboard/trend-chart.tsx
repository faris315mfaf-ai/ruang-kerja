import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TrendPoint } from '@/types/dashboard';

type Props = {
    points: TrendPoint[];
    /** "% tugas bertenggat yang selesai" — what one bar means (table caption). */
    description: string;
    /** "selesai" / "tepat waktu" — numerator wording in the tooltip. */
    numeratorLabel: string;
    denominatorLabel: string;
    /** Plot height in px (bars scale to 100%). */
    height?: number;
    compact?: boolean;
};

/**
 * 8-week trend (DBeranda "Tren penyelesaian"): one column per week, value on
 * top, older weeks soft blue, the current week in the brand gradient. Hover
 * or focus shows the counts behind the percentage. The bars are a picture;
 * a visually hidden table carries the same numbers for screen readers.
 */
export function TrendChart({
    points,
    description,
    numeratorLabel,
    denominatorLabel,
    height = 220,
    compact = false,
}: Props) {
    const last = points.length - 1;
    // Value label + gaps + week label take the rest of the height.
    const plot = height - (compact ? 54 : 66);

    return (
        <figure className="m-0">
            <div
                aria-hidden
                className={cn(
                    'flex items-end',
                    compact ? 'gap-1.5' : 'gap-3 lg:gap-4',
                )}
                style={{ height }}
            >
                {points.map((point, index) => {
                    const current = index === last;
                    const value = point.value ?? 0;

                    return (
                        <div
                            key={point.week_start}
                            className="group relative flex min-w-0 flex-1 flex-col items-center gap-2"
                        >
                            <span
                                className={cn(
                                    'tnum',
                                    compact ? 'text-[13px]' : 'text-[15px]',
                                    current
                                        ? 'font-extrabold text-text'
                                        : 'font-semibold text-text-muted',
                                )}
                            >
                                {point.value === null
                                    ? '–'
                                    : compact
                                      ? Math.round(point.value)
                                      : formatPercent(point.value, 0)}
                            </span>
                            <span
                                className={cn(
                                    'w-full max-w-[52px] rounded-t-[12px] rounded-b-[6px]',
                                    current
                                        ? 'bg-primary bg-grad-merek-y'
                                        : 'bg-avatar-blue',
                                    point.value === null && 'bg-surface-2',
                                )}
                                style={{
                                    height: `${Math.max(4, (value / 100) * plot)}px`,
                                }}
                            />
                            <span
                                className={cn(
                                    'max-w-full truncate whitespace-nowrap text-text-muted',
                                    compact ? 'text-[12px]' : 'text-[14px]',
                                )}
                            >
                                {point.label}
                            </span>
                            <span className="glass pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max max-w-56 -translate-x-1/2 rounded-control px-3 py-2 text-meta text-text shadow-float group-hover:block">
                                Minggu {point.label}:{' '}
                                {point.value === null
                                    ? 'belum ada data'
                                    : `${point.numerator} ${numeratorLabel} dari ${point.denominator} ${denominatorLabel}`}
                            </span>
                        </div>
                    );
                })}
            </div>
            <table className="sr-only">
                <caption>{description}</caption>
                <thead>
                    <tr>
                        <th scope="col">Minggu</th>
                        <th scope="col">Nilai</th>
                    </tr>
                </thead>
                <tbody>
                    {points.map((point) => (
                        <tr key={point.week_start}>
                            <th scope="row">{point.label}</th>
                            <td>
                                {point.value === null
                                    ? 'Belum ada data'
                                    : `${formatPercent(point.value, 0)} (${point.numerator} ${numeratorLabel} dari ${point.denominator} ${denominatorLabel})`}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </figure>
    );
}
