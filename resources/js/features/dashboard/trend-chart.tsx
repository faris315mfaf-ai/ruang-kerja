import {
    Bar,
    BarChart,
    Cell,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    XAxis,
} from 'recharts';
import { formatPercent } from '@/lib/format';
import type { TrendPoint } from '@/types/dashboard';

type Props = {
    points: TrendPoint[];
    /** "% tugas bertenggat yang selesai" — what one bar means (tooltip/aria). */
    description: string;
    /** "selesai" / "tepat waktu" — numerator wording in the tooltip. */
    numeratorLabel: string;
    denominatorLabel: string;
    height?: number;
    compact?: boolean;
};

type TooltipPayload = { payload?: TrendPoint };

function TrendTooltip({
    active,
    payload,
    numeratorLabel,
    denominatorLabel,
}: {
    active?: boolean;
    payload?: TooltipPayload[];
    numeratorLabel: string;
    denominatorLabel: string;
}) {
    const point = payload?.[0]?.payload;

    if (!active || !point) {
        return null;
    }

    return (
        <div className="glass rounded-lg border border-border px-3 py-2 text-xs shadow-card">
            <p className="font-medium text-text">Minggu {point.label}</p>
            <p className="mt-0.5 text-text-muted tnum">
                {point.value === null
                    ? 'Belum ada data'
                    : `${formatPercent(point.value, 0)} · ${point.numerator} ${numeratorLabel} dari ${point.denominator} ${denominatorLabel}`}
            </p>
        </div>
    );
}

/**
 * 8-week trend as bars (one series, so no legend): older weeks muted, the
 * current week in the primary color, value labels on top, hover tooltip with
 * the counts behind each percentage. A visually hidden table carries the
 * same numbers for screen readers.
 */
export function TrendChart({
    points,
    description,
    numeratorLabel,
    denominatorLabel,
    height = 240,
    compact = false,
}: Props) {
    const last = points.length - 1;
    const data = points.map((point) => ({
        ...point,
        bar: point.value ?? 0,
    }));

    return (
        <figure className="m-0">
            <div style={{ height }} aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 22, right: 4, bottom: 0, left: 4 }}
                        barCategoryGap={compact ? '14%' : '22%'}
                    >
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={{ stroke: 'var(--border)' }}
                            interval={0}
                            tick={{
                                fill: 'var(--text-muted)',
                                fontSize: compact ? 10 : 12,
                            }}
                        />
                        <Tooltip
                            cursor={{ fill: 'var(--surface-2)' }}
                            content={
                                <TrendTooltip
                                    numeratorLabel={numeratorLabel}
                                    denominatorLabel={denominatorLabel}
                                />
                            }
                        />
                        <Bar
                            dataKey="bar"
                            radius={[4, 4, 0, 0]}
                            isAnimationActive={false}
                        >
                            {data.map((point, index) => (
                                <Cell
                                    key={point.week_start}
                                    fill={
                                        index === last
                                            ? 'var(--primary)'
                                            : 'var(--chart-1)'
                                    }
                                    fillOpacity={index === last ? 1 : 0.4}
                                />
                            ))}
                            <LabelList
                                dataKey="value"
                                position="top"
                                formatter={(value: unknown) =>
                                    typeof value === 'number'
                                        ? compact
                                            ? String(Math.round(value))
                                            : formatPercent(value, 0)
                                        : '–'
                                }
                                style={{
                                    fill: 'var(--text-muted)',
                                    fontSize: compact ? 11 : 12,
                                }}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
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
                                    : `${formatPercent(point.value, 0)} (${point.numerator} dari ${point.denominator})`}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </figure>
    );
}
