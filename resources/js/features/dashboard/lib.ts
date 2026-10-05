import { formatNumber, formatPercent } from '@/lib/format';
import type {
    ComparedMetric,
    MetricDefinition,
    TodayCounts,
} from '@/types/dashboard';

export type Unit = MetricDefinition['unit'];

export type DeltaTone = 'success' | 'danger' | 'neutral';

export type DeltaInfo = {
    text: string;
    tone: DeltaTone;
    direction: 'up' | 'down' | 'flat';
};

const MINUS = '−';

/** "78%", "2,5 hari", "21 menit", "11" — "–" when undefined. */
export function formatMetric(value: number | null, unit: Unit): string {
    if (value === null || !Number.isFinite(value)) {
        return '–';
    }

    switch (unit) {
        case 'percent':
            return formatPercent(value, 0);
        case 'days':
            return `${formatNumber(Math.round(value * 10) / 10)} hari`;
        case 'minutes':
            return `${formatNumber(Math.round(value))} menit`;
        default:
            return formatNumber(value);
    }
}

function signed(value: number, text: string): string {
    if (value > 0) {
        return `+${text}`;
    }

    return value < 0 ? `${MINUS}${text}` : text;
}

/**
 * Delta caption vs the previous period: "+6 poin dari minggu lalu",
 * "−0,5 hari dari bulan lalu", "sama dengan minggu lalu". Null when either
 * period has no value.
 */
export function deltaText(
    delta: number | null,
    unit: Unit,
    previousLabel: string,
): string | null {
    if (delta === null || !Number.isFinite(delta)) {
        return null;
    }

    if (delta === 0) {
        return `sama dengan ${previousLabel}`;
    }

    const amount = formatNumber(Math.abs(delta));
    const text = {
        percent: `${amount} poin`,
        days: `${amount} hari`,
        minutes: `${amount} menit`,
        count: amount,
    }[unit];

    return `${signed(delta, text)} dari ${previousLabel}`;
}

/**
 * Green when the change is an improvement: higher is better for rates,
 * lower is better for lead time, lateness and overdue counts.
 */
export function deltaTone(
    delta: number | null,
    better: 'higher' | 'lower' = 'higher',
): DeltaTone {
    if (delta === null || delta === 0) {
        return 'neutral';
    }

    return delta > 0 === (better === 'higher') ? 'success' : 'danger';
}

/** Compared metric → StatCard delta props. */
export function compared(
    metric: ComparedMetric,
    unit: Unit,
    previousLabel: string,
    better: 'higher' | 'lower' = 'higher',
): DeltaInfo | null {
    const text = deltaText(metric.delta, unit, previousLabel);

    if (text === null || metric.delta === null) {
        return null;
    }

    return {
        text,
        tone: deltaTone(metric.delta, better),
        direction: metric.delta > 0 ? 'up' : metric.delta < 0 ? 'down' : 'flat',
    };
}

/** "2 cuti/sakit · 0 belum check-in" (Kepala Divisi KPI caption). */
export function todayCaption(counts: TodayCounts): string {
    return `${counts.away} cuti/izin/sakit · ${counts.not_checked_in} belum check-in`;
}

/** "4 cuti · 1 izin · 1 sakit" (HR KPI caption), zero parts left out. */
export function awayBreakdown(counts: TodayCounts): string {
    const parts = [
        [counts.leave, 'cuti'],
        [counts.permit, 'izin'],
        [counts.sick, 'sakit'],
        [counts.business_trip, 'dinas'],
    ] as const;

    const text = parts
        .filter(([count]) => count > 0)
        .map(([count, label]) => `${count} ${label}`)
        .join(' · ');

    return text === '' ? 'tidak ada' : text;
}

/** Share in percent of a stacked bar, safe for zero totals. */
export function share(part: number, total: number): number {
    return total > 0 ? (part / total) * 100 : 0;
}

/** The busiest day of a week strip, for "Rabu paling padat." */
export function busiestDay<T extends { count: number }>(days: T[]): T | null {
    return days.reduce<T | null>(
        (best, day) =>
            day.count > 0 && (best === null || day.count > best.count)
                ? day
                : best,
        null,
    );
}

/** "minggu ini", "bulan ini", "kuartal ini", "periode ini". */
export function periodNoun(preset: string): string {
    return (
        {
            minggu: 'minggu ini',
            bulan: 'bulan ini',
            kuartal: 'kuartal ini',
        }[preset] ?? 'periode ini'
    );
}
