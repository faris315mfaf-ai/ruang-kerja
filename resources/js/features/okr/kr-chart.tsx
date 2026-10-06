import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { formatKrValue, krChartSeries } from './lib';
import type { KeyResult, QuarterKey } from './types';

const COLORS = {
    actual: 'var(--fill-teal)',
    plan: 'var(--marker)',
    grid: 'var(--divider)',
    axis: 'var(--text-muted)',
};

/**
 * Weekly progress of a key result: dashed plan line (start → target over the
 * quarter) and the check-in values so far. A visually hidden table carries
 * the same numbers for screen readers.
 */
export function KrChart({
    keyResult,
    quarter,
    today,
    compact = false,
}: {
    keyResult: KeyResult;
    quarter: QuarterKey;
    today: string;
    compact?: boolean;
}) {
    const rows = krChartSeries(keyResult, quarter, today);
    const format = (value: number) =>
        formatKrValue(value, keyResult.unit, keyResult.unit_label);
    const tick = { fill: COLORS.axis, fontSize: compact ? 12 : 13 };

    return (
        <figure className="m-0 flex flex-col gap-2">
            <div aria-hidden className={compact ? 'h-[180px]' : 'h-[220px]'}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={rows}
                        margin={{
                            top: 8,
                            right: 20,
                            bottom: 0,
                            left: compact ? -16 : -8,
                        }}
                    >
                        <CartesianGrid stroke={COLORS.grid} vertical={false} />
                        <XAxis
                            dataKey="week"
                            tick={tick}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(week: number) =>
                                week === 0 ? 'Awal' : `M${week}`
                            }
                            interval={compact ? 3 : 1}
                        />
                        <YAxis
                            tick={tick}
                            tickLine={false}
                            axisLine={false}
                            width={48}
                            domain={['auto', 'auto']}
                        />
                        <Tooltip
                            cursor={{ stroke: COLORS.grid }}
                            contentStyle={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 12,
                                color: 'var(--text)',
                                fontSize: 14,
                            }}
                            labelFormatter={(week) =>
                                Number(week) === 0
                                    ? 'Awal kuartal'
                                    : `Minggu ${Number(week)}`
                            }
                            formatter={(value, name) => [
                                format(Number(value)),
                                name === 'plan' ? 'Rencana' : 'Aktual',
                            ]}
                        />
                        <Line
                            type="linear"
                            dataKey="plan"
                            stroke={COLORS.plan}
                            strokeWidth={2}
                            strokeDasharray="6 5"
                            dot={false}
                            isAnimationActive={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="actual"
                            stroke={COLORS.actual}
                            strokeWidth={3}
                            dot={{
                                r: 3.5,
                                fill: COLORS.actual,
                                strokeWidth: 0,
                            }}
                            connectNulls={false}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="h-[3px] w-5 rounded-full bg-fill-teal"
                    />
                    Aktual
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="h-0 w-5 border-t-2 border-dashed border-marker"
                    />
                    Rencana linear
                </span>
            </figcaption>
            {/* Tables ignore sr-only's 1px box; the wrapper keeps them from
                widening the page on narrow screens. */}
            <div className="sr-only">
                <table>
                    <caption>Progres mingguan {keyResult.title}</caption>
                    <thead>
                        <tr>
                            <th scope="col">Minggu</th>
                            <th scope="col">Rencana</th>
                            <th scope="col">Aktual</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.week}>
                                <th scope="row">
                                    {row.week === 0
                                        ? 'Awal'
                                        : `Minggu ${row.week}`}
                                </th>
                                <td>{format(row.plan)}</td>
                                <td>
                                    {row.actual === null
                                        ? '–'
                                        : format(row.actual)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </figure>
    );
}
