import { useState } from 'react';
import type { DivisionMetrics, MetricDefinitions } from '@/types/dashboard';
import type { DivisionProps } from './division-types';
import { compared, formatMetric, todayCaption } from './lib';
import { StatCard } from './stat-card';

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

/** The four headline KPIs (Main / MDashboardKadiv). */
export function DivisionKpis({
    props,
    compact = false,
}: {
    props: DivisionProps;
    compact?: boolean;
}) {
    const { metrics, attendance, definitions } = props;
    const previous = metrics?.compared.previous.label ?? '';

    return (
        <>
            <StatCard
                compact={compact}
                label="Kehadiran hari ini"
                definition="Hadir (termasuk terlambat) dari karyawan yang terjadwal hari ini."
                value={String(attendance.counts.present)}
                suffix={`/ ${attendance.counts.scheduled}${compact ? '' : ' terjadwal'}`}
                caption={todayCaption(attendance.counts)}
            />
            {metrics && (
                <>
                    <StatCard
                        compact={compact}
                        label={
                            compact ? 'Penyelesaian' : 'Tingkat penyelesaian'
                        }
                        definition={definitions.completion_rate}
                        value={formatMetric(
                            metrics.kpis.completion_rate.value,
                            'percent',
                        )}
                        delta={compared(
                            metrics.kpis.completion_rate,
                            'percent',
                            previous,
                        )}
                    />
                    <StatCard
                        compact={compact}
                        label="Ketepatan waktu"
                        definition={definitions.on_time_rate}
                        value={formatMetric(
                            metrics.kpis.on_time_rate.value,
                            'percent',
                        )}
                        delta={compared(
                            metrics.kpis.on_time_rate,
                            'percent',
                            previous,
                        )}
                    />
                    <StatCard
                        compact={compact}
                        label={compact ? 'Terlambat' : 'Tugas terlambat'}
                        definition={definitions.overdue_tasks}
                        value={String(metrics.kpis.overdue_tasks.value)}
                        suffix={compact ? 'tugas' : undefined}
                        valueTone={
                            metrics.kpis.overdue_tasks.value > 0
                                ? 'danger'
                                : 'default'
                        }
                        caption={overdueCaption(metrics.kpis.overdue_tasks)}
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
}: {
    metrics: DivisionMetrics;
    definitions: MetricDefinitions;
}) {
    const previous = metrics.compared.previous.label;

    return (
        <>
            <StatCard
                compact
                label="Lead time (median)"
                definition={definitions.lead_time}
                value={formatMetric(metrics.kpis.lead_time.value, 'days')}
                delta={compared(
                    metrics.kpis.lead_time,
                    'days',
                    previous,
                    'lower',
                )}
                caption={`${metrics.kpis.lead_time.denominator} tugas selesai`}
            />
            <StatCard
                compact
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
                caption={`${metrics.kpis.attendance_discipline.numerator} dari ${metrics.kpis.attendance_discipline.denominator} hari kerja tepat waktu`}
            />
            <StatCard
                compact
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
                caption={`${metrics.kpis.average_lateness.denominator} hari terlambat`}
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
