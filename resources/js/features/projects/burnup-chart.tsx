import { ChartLine } from 'lucide-react';
import { useId, useMemo } from 'react';
import {
    Area,
    CartesianGrid,
    ComposedChart,
    Line,
    ReferenceArea,
    ReferenceDot,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { EmptyState } from '@/components/empty-state';
import { daysBetween, parseDay, shortDay } from '@/features/portfolio/lib';
import type { Burnup } from '@/features/portfolio/types';

export type BurnupRow = {
    date: string;
    /** Days since kickoff (x position). */
    day: number;
    scope: number | null;
    done: number | null;
    ideal: number | null;
    /** Dotted projection from today's done at the recent weekly pace. */
    projection: number | null;
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
            projection: null,
        };
    });
    const todayDay = daysBetween(start, today);
    const doneNow = points[points.length - 1]?.done ?? null;
    const pace = burnup.recent_pace;
    const project = (day: number) =>
        pace === null || doneNow === null || day < todayDay
            ? null
            : Math.round(
                  Math.min(scopeNow, doneNow + (pace * (day - todayDay)) / 7) *
                      10,
              ) / 10;

    if (rows.length > 0 && pace !== null) {
        rows[rows.length - 1].projection = doneNow;
    }

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
                projection: project(day),
            });
        }

        rows.push({
            date: target,
            day: end,
            scope: null,
            done: null,
            ideal: ideal(end),
            projection: project(end),
        });
    }

    return rows;
}

const COLORS = {
    scope: 'var(--text-subtle)',
    ideal: 'var(--marker)',
    projection: 'var(--accent-blue-strong)',
    grid: 'var(--divider)',
    axis: 'var(--text-muted)',
    today: 'var(--primary)',
    future: 'var(--background)',
    danger: 'var(--danger)',
};

const dayLabel = (start: string, day: number) =>
    shortDay(
        new Date(parseDay(start) + day * 86_400_000).toISOString().slice(0, 10),
    );

/**
 * Burn-up (DProyek): lingkup (gray), selesai (gradient merek with a soft
 * area), ideal (dashed), proyeksi (dotted blue) and the future shaded behind
 * the "Hari ini" line; milestones as diamonds on the axis.
 */
export function BurnupChart({
    burnup,
    height = 280,
    compact = false,
}: {
    burnup: Burnup;
    height?: number;
    compact?: boolean;
}) {
    const rows = useMemo(() => burnupRows(burnup), [burnup]);
    const id = useId().replace(/:/g, '');

    if (rows.length === 0 || !burnup.start_date) {
        return (
            <EmptyState
                size="sm"
                icon={ChartLine}
                title="Grafik belum tersedia"
                className="min-h-40"
            >
                Grafik muncul setelah tanggal mulai proyek diisi dan snapshot
                harian pertama tercatat.
            </EmptyState>
        );
    }

    const start = burnup.start_date;
    const todayDay = daysBetween(start, burnup.today);
    const todayRow = rows.find((row) => row.day === todayDay);
    const maxDay = rows[rows.length - 1].day;
    const ticks = compact ? [0, todayDay, maxDay] : rows.map((row) => row.day);
    const tick = { fill: COLORS.axis, fontSize: compact ? 13 : 14 };

    return (
        <div
            role="img"
            aria-label={`Grafik burn-up: lingkup ${todayRow?.scope ?? '–'}, selesai ${todayRow?.done ?? '–'}, ideal ${todayRow?.ideal ?? '–'} per ${shortDay(burnup.today)}.`}
        >
            <ResponsiveContainer width="100%" height={height}>
                <ComposedChart
                    data={rows}
                    margin={{
                        top: 24,
                        right: 12,
                        bottom: 0,
                        left: compact ? -16 : -12,
                    }}
                >
                    <defs>
                        <linearGradient
                            id={`${id}l`}
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="0"
                        >
                            <stop offset="0" stopColor="var(--fill-teal)" />
                            <stop offset="1" stopColor="var(--accent-blue)" />
                        </linearGradient>
                        <linearGradient
                            id={`${id}f`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0"
                                stopColor="var(--accent-blue)"
                                stopOpacity={0.22}
                            />
                            <stop
                                offset="1"
                                stopColor="var(--fill-teal)"
                                stopOpacity={0}
                            />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke={COLORS.grid} vertical={false} />
                    {todayDay < maxDay && (
                        <ReferenceArea
                            x1={todayDay}
                            x2={maxDay}
                            fill={COLORS.future}
                            fillOpacity={1}
                            ifOverflow="hidden"
                        />
                    )}
                    <XAxis
                        dataKey="day"
                        type="number"
                        domain={[0, maxDay]}
                        ticks={ticks}
                        tickFormatter={(day: number) => dayLabel(start, day)}
                        tick={tick}
                        axisLine={false}
                        tickLine={false}
                        tickMargin={10}
                    />
                    <YAxis
                        allowDecimals={false}
                        tick={tick}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                    />
                    <Tooltip
                        contentStyle={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 12,
                            fontSize: 14,
                            color: 'var(--text)',
                        }}
                        labelFormatter={(day) => dayLabel(start, Number(day))}
                        formatter={(value, name) => [
                            value,
                            {
                                scope: 'Lingkup',
                                done: 'Selesai',
                                ideal: 'Ideal',
                                projection: 'Proyeksi',
                            }[String(name)] ?? name,
                        ]}
                    />
                    <ReferenceLine
                        x={todayDay}
                        stroke={COLORS.today}
                        strokeWidth={2}
                        label={
                            compact
                                ? undefined
                                : {
                                      value: 'Hari ini',
                                      position: 'insideTopLeft',
                                      fill: 'var(--link)',
                                      fontSize: 14,
                                      fontWeight: 700,
                                      offset: 8,
                                  }
                        }
                    />
                    <Line
                        type="linear"
                        dataKey="ideal"
                        stroke={COLORS.ideal}
                        strokeWidth={2}
                        strokeDasharray="7 6"
                        dot={false}
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="scope"
                        stroke={COLORS.scope}
                        strokeWidth={3}
                        strokeLinejoin="round"
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                    <Area
                        type="monotone"
                        dataKey="done"
                        stroke={`url(#${id}l)`}
                        strokeWidth={4}
                        strokeLinecap="round"
                        fill={`url(#${id}f)`}
                        dot={false}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                    <Line
                        type="linear"
                        dataKey="projection"
                        stroke={COLORS.projection}
                        strokeWidth={2.5}
                        strokeDasharray="2 6"
                        strokeLinecap="round"
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                    />
                    {todayRow?.done !== null &&
                        todayRow?.done !== undefined && (
                            <ReferenceDot
                                x={todayDay}
                                y={todayRow.done}
                                r={7}
                                fill="var(--surface)"
                                stroke={COLORS.projection}
                                strokeWidth={3}
                            />
                        )}
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
                                    r={5}
                                    shape={(props: {
                                        cx?: number;
                                        cy?: number;
                                    }) => (
                                        <rect
                                            x={(props.cx ?? 0) - 5}
                                            y={(props.cy ?? 0) - 5}
                                            width={10}
                                            height={10}
                                            rx={2}
                                            transform={`rotate(45 ${props.cx ?? 0} ${props.cy ?? 0})`}
                                            fill={
                                                milestone.status === 'missed'
                                                    ? COLORS.danger
                                                    : milestone.status.startsWith(
                                                            'completed',
                                                        )
                                                      ? 'var(--success)'
                                                      : 'var(--surface)'
                                            }
                                            stroke={
                                                milestone.status === 'missed'
                                                    ? COLORS.danger
                                                    : 'var(--border-strong)'
                                            }
                                            strokeWidth={2}
                                        >
                                            <title>{`${milestone.name} · ${shortDay(milestone.target_date)}`}</title>
                                        </rect>
                                    )}
                                />
                            );
                        })}
                </ComposedChart>
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
