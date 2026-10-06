import type { PeriodCounts, WeekBucket } from '@/features/automation/types';

/**
 * Kinerja saya — PRD M7 formulas on personal counts. Each metric is shown
 * on its own with its context; there is deliberately no combined score.
 */

/** Percentage 0–100, or null when there is nothing to divide by. */
export function rate(numerator: number, denominator: number): number | null {
    if (denominator <= 0) {
        return null;
    }

    return Math.round((numerator / denominator) * 100);
}

/** Median of a list (null when empty), one decimal. */
export function median(values: number[]): number | null {
    if (values.length === 0) {
        return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const value =
        sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];

    return Math.round(value * 10) / 10;
}

/** "2,6 hr" with an Indonesian decimal comma. */
export function formatDays(value: number | null): string {
    if (value === null) {
        return '–';
    }

    return `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })} hr`;
}

export type MetricKey = 'completion' | 'on_time' | 'lead_time' | 'attendance';

export type Metric = {
    key: MetricKey;
    label: string;
    /** Formatted value ("82%", "2,6 hr", "–"). */
    value: string;
    /** Counts behind the value ("37 dari 45 tugas bertenggat selesai"). */
    note: string;
    /** Formula shown in the tooltip / definitions list (PRD M7). */
    definition: string;
    /** Numeric value for comparisons; null = no data. */
    raw: number | null;
};

export const METRIC_DEFINITIONS: Record<MetricKey, string> = {
    completion:
        'Tugas selesai yang tenggatnya jatuh dalam periode ÷ semua tugas bertenggat dalam periode (tanpa yang dibatalkan).',
    on_time:
        'Tugas selesai pada atau sebelum tenggat ÷ tugas selesai yang punya tenggat.',
    lead_time:
        'Median hari dari tugas dibuat sampai selesai, untuk tugas yang selesai dalam periode.',
    attendance:
        'Hari hadir tepat waktu ÷ hari kerja terjadwal (cuti, izin, sakit, dinas, libur tidak dihitung).',
};

export function computeMetrics(counts: PeriodCounts): Metric[] {
    const completion = rate(counts.done_of_due, counts.due);
    const onTime = rate(counts.on_time, counts.done_with_due);
    const lead = median(counts.lead_times);
    const attendance = rate(counts.on_time_days, counts.scheduled_days);
    const pct = (value: number | null) => (value === null ? '–' : `${value}%`);

    return [
        {
            key: 'completion',
            label: 'Tingkat penyelesaian',
            value: pct(completion),
            raw: completion,
            note:
                counts.due === 0
                    ? 'Belum ada tugas bertenggat'
                    : `${counts.done_of_due} dari ${counts.due} tugas bertenggat selesai`,
            definition: METRIC_DEFINITIONS.completion,
        },
        {
            key: 'on_time',
            label: 'Ketepatan waktu',
            value: pct(onTime),
            raw: onTime,
            note:
                counts.done_with_due === 0
                    ? 'Belum ada tugas selesai bertenggat'
                    : `${counts.on_time} dari ${counts.done_with_due} selesai sebelum tenggat`,
            definition: METRIC_DEFINITIONS.on_time,
        },
        {
            key: 'lead_time',
            label: 'Median lead time',
            value: formatDays(lead),
            raw: lead,
            note: `divisi ${formatDays(counts.division_lead_time).replace(' hr', ' hari')}`,
            definition: METRIC_DEFINITIONS.lead_time,
        },
        {
            key: 'attendance',
            label: 'Hadir tepat waktu',
            value: pct(attendance),
            raw: attendance,
            note:
                counts.scheduled_days === 0
                    ? counts.attendance_label
                    : `${counts.attendance_label} · ${counts.on_time_days} dari ${counts.scheduled_days} hari kerja`,
            definition: METRIC_DEFINITIONS.attendance,
        },
    ];
}

/** Bar heights for the weekly stacked chart, scaled to the busiest week. */
export function weekBars(
    weeks: WeekBucket[],
    plotHeight: number,
): { week_start: string; total: number; onTimeH: number; lateH: number }[] {
    const max = Math.max(1, ...weeks.map((w) => w.on_time + w.late));

    return weeks.map((week) => ({
        week_start: week.week_start,
        total: week.on_time + week.late,
        onTimeH: Math.round((week.on_time / max) * plotHeight),
        lateH: Math.round((week.late / max) * plotHeight),
    }));
}

/** "5 Okt" / "5/10" week labels. */
export function weekLabel(weekStart: string, compact = false): string {
    const [, m, d] = weekStart.split('-').map(Number);
    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'Mei',
        'Jun',
        'Jul',
        'Agu',
        'Sep',
        'Okt',
        'Nov',
        'Des',
    ];

    return compact ? `${d}/${m}` : `${d} ${months[m - 1]}`;
}

export function isEmptyPerformance(
    counts: PeriodCounts,
    weeks: WeekBucket[],
): boolean {
    return (
        counts.due === 0 &&
        counts.done_with_due === 0 &&
        counts.lead_times.length === 0 &&
        weeks.every((w) => w.on_time + w.late === 0)
    );
}
