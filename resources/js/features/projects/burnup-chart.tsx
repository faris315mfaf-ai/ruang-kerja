import { useMemo } from 'react';
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceDot,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { daysBetween, parseDay, shortDay } from '@/features/portfolio/lib';
import type { Burnup } from '@/features/portfolio/types';

export type BurnupRow = {
    date: string;
    /** Days since kickoff (x position). */
    day: number;
    scope: number | null;
    done: number | null;
    ideal: number | null;
};

/**
 * Burn-up rows: weekly points from kickoff to today (scope & done from the
 * daily snapshots), weekly future points until the target, and the ideal
 * line from 0 at kickoff to today's scope at the target date.
 */
export function burnupRows(burnup: Burnup): BurnupRow[] {
    const { start_date: start, target_date: target, points, today } = burnup;

    if (!start || points.length === 0) {
        return [];
    }

    const scopeNow = points[points.length - 1]?.scope ?? 0;
    const duration = target ? Math.max(1, daysBetween(start, target)) : null;
    const ideal = (day: number) =>
        duration === null
            ? null
            : Math.round(Math.min(1, day / duration) * scopeNow * 10) / 10;

    const rows: BurnupRow[] = points.map((point) => {
        const day = daysBetween(start, point.date);

        return {
            date: point.date,
            day,
            scope: point.scope,
            done: point.done,
            ideal: ideal(day),
        };
    });

    if (target && daysBetween(today, target) > 0) {
        const last = daysBetween(start, today);
        const end = daysBetween(start, target);

        for (let day = last + 7; day < end; day += 7) {
            const date = new Date(parseDay(start) + day * 86_400_000)
                .toISOString()
                .slice(0, 10);
            rows.push({
                date,
                day,
                scope: null,
                done: null,
                ideal: ideal(day),
            });
        }

        rows.push({
            date: target,
            day: end,
            scope: null,
            done: null,
            ideal: ideal(end),
        });
    }

    return rows;
}

const COLORS = {
    scope: 'var(--info)',
    done: 'var(--primary)',
    ideal: 'var(--text-muted)',
    grid: 'var(--border)',
    axis: 'var(--text-muted)',
    today: 'var(--text-subtle)',
    danger: 'var(--danger)',
};

/** Burn-up (lingkup vs selesai vs ideal) from project_progress_snapshots. */
export function BurnupChart({
    burnup,
    height = 240,
    compact = false,
}: {
    burnup: Burnup;
    height?: number;
    compact?: boolean;
}) {
    const rows = useMemo(() => burnupRows(burnup), [burnup]);

    if (rows.length === 0 || !burnup.start_date) {
        return (
            <p
                className="flex items-center justify-center rounded-md bg-surface-2 text-[13px] text-text-muted"
                style={{ height }}
            >
                Grafik muncul setelah tanggal mulai proyek diisi dan snapshot
                harian pertama tercatat.
            </p>
        );
    }

    const start = burnup.start_date;
    const todayDay = daysBetween(start, burnup.today);
    const todayRow = rows.find((row) => row.day === todayDay);
    const maxDay = rows[rows.length - 1].day;
    const ticks = compact ? [0, todayDay, maxDay] : rows.map((row) => row.day);

    return (
        <div
            role="img"
            aria-label={`Grafik burn-up: lingkup ${todayRow?.scope ?? '–'} tugas, selesai ${todayRow?.done ?? '–'}, ideal ${todayRow?.ideal ?? '–'}.`}
        >
            <ResponsiveContainer width="100%" height={height}>
                <LineChart
                    data={rows}
                    margin={{
                        top: 16,
                        right: 16,
                        bottom: 0,
                        left: compact ? -24 : -12,
                    }}
                >
                    <CartesianGrid stroke={COLORS.grid} vertical={false} />
                    <XAxis
                        dataKey="day"
                        type="number"
                        domain={[0, maxDay]}
                        ticks={ticks}
                        tickFormatter={(day: number) =>
                            shortDay(
                                new Date(parseDay(start) + day * 86_400_000)
                                    .toISOString()
                                    .slice(0, 10),
                            )
                        }
                        tick={{ fill: COLORS.axis, fontSize: 11 }}
                        axisLine={{ stroke: COLORS.grid }}
                        tickLine={false}
                    />
                    <YAxis
                        allowDecimals={false}
                        tick={{ fill: COLORS.axis, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                    />
                    <Tooltip
                        contentStyle={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                            color: 'var(--text)',
                        }}
                        labelFormatter={(day) =>
                            shortDay(
                                new Date(
                                    parseDay(start) + Number(day) * 86_400_000,
                                )
                                    .toISOString()
                                    .slice(0, 10),
                            )
                        }
                        formatter={(value, name) => [
                            value,
                            {
                                scope: 'Lingkup',
                                done: 'Selesai',
                                ideal: 'Ideal',
                            }[String(name)] ?? name,
                        ]}
                    />
                    <ReferenceLine
                        x={todayDay}
                        stroke={COLORS.today}
                        label={
                            compact
                                ? undefined
                                : {
                                      value: `Hari ini ${shortDay(burnup.today)}`,
                                      position: 'top',
                                      fill: COLORS.axis,
                                      fontSize: 11,
                                  }
                        }
                    />
                    <Line
                        type="monotone"
                        dataKey="scope"
                        stroke={COLORS.scope}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                    <Line
                        type="linear"
                        dataKey="ideal"
                        stroke={COLORS.ideal}
                        strokeWidth={1.5}
                        strokeDasharray="5 4"
                        dot={false}
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="done"
                        stroke={COLORS.done}
                        strokeWidth={2}
                        dot={{ r: 2.5, fill: COLORS.done }}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                    {!compact &&
                        burnup.milestones.map((milestone) => {
                            const day = daysBetween(
                                start,
                                milestone.target_date,
                            );

                            if (day < 0 || day > maxDay) {
                                return null;
                            }

                            return (
                                <ReferenceDot
                                    key={milestone.id}
                                    x={day}
                                    y={0}
                                    r={4}
                                    shape={(props: {
                                        cx?: number;
                                        cy?: number;
                                    }) => (
                                        <rect
                                            x={(props.cx ?? 0) - 4}
                                            y={(props.cy ?? 0) - 4}
                                            width={8}
                                            height={8}
                                            transform={`rotate(45 ${props.cx ?? 0} ${props.cy ?? 0})`}
                                            fill={
                                                milestone.status === 'missed'
                                                    ? COLORS.danger
                                                    : milestone.status.startsWith(
                                                            'completed',
                                                        )
                                                      ? COLORS.ideal
                                                      : 'var(--surface)'
                                            }
                                            stroke={
                                                milestone.status === 'missed'
                                                    ? COLORS.danger
                                                    : 'var(--text)'
                                            }
                                        >
                                            <title>{`${milestone.name} · ${shortDay(milestone.target_date)}`}</title>
                                        </rect>
                                    )}
                                />
                            );
                        })}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

/** One-sentence reading of the chart ("Lingkup bertambah …"). */
export function burnupCaption(
    burnup: Burnup,
    targetLabel: string,
): string | null {
    const points = burnup.points;
    const last = points[points.length - 1];

    if (!last || last.scope === null) {
        return null;
    }

    const parts: string[] = [];
    const initial = burnup.initial_scope;

    if (initial !== null && last.scope > initial) {
        parts.push(
            `Lingkup bertambah ${last.scope - initial} tugas sejak kickoff (${initial} → ${last.scope}).`,
        );
    }

    if (burnup.required_pace !== null) {
        parts.push(
            `Untuk selesai ${targetLabel}, tim perlu menyelesaikan rata-rata ${String(burnup.required_pace).replace('.', ',')} tugas per minggu` +
                (burnup.recent_pace !== null
                    ? `; 4 minggu terakhir rata-rata ${String(burnup.recent_pace).replace('.', ',')}.`
                    : '.'),
        );
    }

    return parts.join(' ') || null;
}
