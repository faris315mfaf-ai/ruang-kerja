import { useState } from 'react';
import { cn } from '@/lib/utils';
import type {
    ComparedMetric,
    DivisionMetrics,
    MetricDefinitions,
} from '@/types/dashboard';
import type { DivisionProps } from './division-types';
import { compared, formatMetric, todayCaption } from './lib';
import { MetricKpi } from './dashboard-ui';

/** "3 di antaranya milik 1 orang" (mockup Main). */
export function overdueCaption(
    kpi: DivisionMetrics['kpis']['overdue_tasks'],
): string {
    if (kpi.value === 0) {
        return 'tidak ada tugas terlambat';
    }

    if (kpi.people === 1) {
        return 'semuanya milik 1 orang';
    }

    return `${kpi.top_person} di antaranya milik 1 orang`;
}

/** Phone KPI tile (MBeranda "Saldo cuti" tiles). */
export const KPI_TILE = 'gap-0.5 rounded-card px-4 py-3.5 shadow-none';

/**
 * The four headline KPIs (DBeranda "Ringkasan"): attendance on the gradient
 * highlight card, then completion, on-time rate and overdue tasks.
 */
export function DivisionKpis({
    props,
    compact = false,
}: {
    props: DivisionProps;
    compact?: boolean;
}) {
    const { metrics, attendance, definitions } = props;
    const previous = props.filters.period.previous_label;
    const card = compact ? KPI_TILE : undefined;
    const layout = compact ? undefined : 'flex-[1_1_240px]';
    // Phone tiles are narrow: the delta goes in the note line, not a pill.
    const change = (metric: ComparedMetric) => {
        const delta = compared(metric, 'percent', previous);

        return compact ? { note: delta?.text } : { delta };
    };

    return (
        <>
            <MetricKpi
                tone="highlight"
                label={
                    compact ? 'Kehadiran hari ini' : 'Kehadiran divisi hari ini'
                }
                value={String(attendance.counts.present)}
                suffix={`/ ${attendance.counts.scheduled}`}
                note={todayCaption(attendance.counts)}
                className={cn(layout, compact && 'col-span-2')}
                cardClassName={card}
            />
            {metrics && (
                <>
                    <MetricKpi
                        className={layout}
                        cardClassName={card}
                        label={
                            compact ? 'Penyelesaian' : 'Tingkat penyelesaian'
                        }
                        definition={definitions.completion_rate}
                        value={formatMetric(
                            metrics.kpis.completion_rate.value,
                            'percent',
                        )}
                        {...change(metrics.kpis.completion_rate)}
                    />
                    <MetricKpi
                        className={layout}
                        cardClassName={card}
                        label="Ketepatan waktu"
                        definition={definitions.on_time_rate}
                        value={formatMetric(
                            metrics.kpis.on_time_rate.value,
                            'percent',
                        )}
                        {...change(metrics.kpis.on_time_rate)}
                    />
                    <MetricKpi
                        className={cn(layout, compact && 'col-span-2')}
                        cardClassName={card}
                        label={compact ? 'Terlambat' : 'Tugas terlambat'}
                        definition={definitions.overdue_tasks}
                        value={String(metrics.kpis.overdue_tasks.value)}
                        suffix={compact ? 'tugas' : undefined}
                        valueClassName={
                            metrics.kpis.overdue_tasks.value > 0
                                ? 'text-danger'
                                : undefined
                        }
                        note={overdueCaption(metrics.kpis.overdue_tasks)}
                    />
                </>
            )}
        </>
    );
}

/** Lead time, attendance discipline, average lateness. */
export function SecondaryKpis({
    metrics,
    definitions,
    previousLabel,
}: {
    metrics: DivisionMetrics;
    definitions: MetricDefinitions;
    previousLabel: string;
}) {
    const previous = previousLabel;

    return (
        <>
            <MetricKpi
                label="Lead time (median)"
                definition={definitions.lead_time}
                value={formatMetric(metrics.kpis.lead_time.value, 'days')}
                delta={compared(
                    metrics.kpis.lead_time,
                    'days',
                    previous,
                    'lower',
                )}
                note={`${metrics.kpis.lead_time.denominator} tugas selesai`}
            />
            <MetricKpi
                label="Kedisiplinan hadir"
                definition={definitions.attendance_discipline}
                value={formatMetric(
                    metrics.kpis.attendance_discipline.value,
                    'percent',
                )}
                delta={compared(
                    metrics.kpis.attendance_discipline,
                    'percent',
                    previous,
                )}
                note={`${metrics.kpis.attendance_discipline.numerator} dari ${metrics.kpis.attendance_discipline.denominator} hari kerja tepat waktu`}
            />
            <MetricKpi
                label="Rata-rata terlambat"
                definition={definitions.average_lateness}
                value={formatMetric(
                    metrics.kpis.average_lateness.value,
                    'minutes',
                )}
                delta={compared(
                    metrics.kpis.average_lateness,
                    'minutes',
                    previous,
                    'lower',
                )}
                note={`${metrics.kpis.average_lateness.denominator} hari terlambat`}
            />
        </>
    );
}

/** Show the first rows, expand to all ("Lihat semua 14 anggota"). */
export function useExpandable(limit: number) {
    const [expanded, setExpanded] = useState(false);

    return {
        limit: expanded ? undefined : limit,
        expanded,
        toggle: () => setExpanded((value) => !value),
    };
}
