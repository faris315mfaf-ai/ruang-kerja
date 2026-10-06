import type { BadgeTone } from '@/components/ui/badge';
import { greeting } from '@/features/dashboard/lib';
import {
    formatDate,
    formatNumber,
    formatPercent,
    formatRelative,
} from '@/lib/format';
import { formatShortDate, officeDay, weekdayShort } from '@/lib/requests';
import type {
    KpiTone,
    RoleKey,
    RoleKpi,
    RoleRow,
    ScheduleKind,
    Tone,
} from './types';
import { ROLE_KEYS } from './types';

export function isRoleKey(value: string): value is RoleKey {
    return (ROLE_KEYS as readonly string[]).includes(value);
}

/** Badge tone for a row/tile tone. */
export const BADGE_TONE: Record<Tone, BadgeTone> = {
    late: 'danger',
    warn: 'warning',
    info: 'info',
    ok: 'success',
    neutral: 'neutral',
};

/** Soft tile (leading tag square) classes per tone. */
export const TAG_CLASSES: Record<Tone, string> = {
    late: 'bg-danger-soft text-danger',
    warn: 'bg-warning-soft text-warning',
    info: 'bg-info-soft text-info',
    ok: 'bg-success-soft text-success',
    neutral: 'bg-surface-2 text-text-muted',
};

/** Text colour for values/notes per tone (neutral = regular text). */
export const TEXT_CLASSES: Record<Tone, string> = {
    late: 'text-danger',
    warn: 'text-warning',
    info: 'text-info',
    ok: 'text-success',
    neutral: 'text-text',
};

/** Progress tone for a bar tone. */
export const BAR_TONE = {
    ok: 'brand',
    warn: 'warning',
    late: 'danger',
    neutral: 'brand',
} as const;

const KINDS: Record<ScheduleKind, { label: string; classes: string }> = {
    task: { label: 'Tenggat', classes: 'bg-danger-soft text-danger' },
    milestone: { label: 'Milestone', classes: 'bg-link-soft text-link' },
    leave: { label: 'Cuti', classes: 'bg-info-soft text-info' },
};

export function kindOf(kind: ScheduleKind) {
    return KINDS[kind];
}

/** "77%", "12", "–" (not measurable yet). */
export function formatKpiValue(kpi: Pick<RoleKpi, 'value' | 'unit'>): string {
    if (kpi.value === null) {
        return '–';
    }

    return kpi.unit === 'percent'
        ? formatPercent(kpi.value, 0)
        : formatNumber(kpi.value);
}

/** "/ 47" after "25" when the KPI is a part of a whole. */
export function kpiSuffix(kpi: Pick<RoleKpi, 'total'>): string | undefined {
    return kpi.total === null ? undefined : `/ ${formatNumber(kpi.total)}`;
}

/** Phone tile tone of a KPI: the warm one is the alarming one. */
export function tileTone(tone: KpiTone, value: number | null): Tone {
    return tone === 'warm' && (value ?? 0) > 0 ? 'late' : 'neutral';
}

/** Row meta with its date: "Proyek X · Diajukan Agus · 2 hari lalu". */
export function rowMeta(
    row: Pick<RoleRow, 'meta' | 'at'>,
    now: Date = new Date(),
): string {
    if (!row.at) {
        return row.meta;
    }

    const date =
        row.at.style === 'relative'
            ? formatRelative(row.at.value, now)
            : formatDate(row.at.value);

    return [row.meta, date].filter((part) => part !== '').join(' · ');
}

/** "Hari ini", "Besok", "Kam, 8 Okt" for a "Y-m-d" office date. */
export function scheduleDay(date: string, now: Date = new Date()): string {
    const day = officeDay(date);
    const today = officeDay(now);

    if (!day || !today) {
        return '–';
    }

    const diff = Math.round(
        (Date.UTC(day.year, day.month - 1, day.day) -
            Date.UTC(today.year, today.month - 1, today.day)) /
            86_400_000,
    );

    if (diff === 0) {
        return 'Hari ini';
    }

    if (diff === 1) {
        return 'Besok';
    }

    // "8 Okt 2026" → "8 Okt"
    const short = formatShortDate(date).split(' ').slice(0, 2).join(' ');

    return `${weekdayShort(date)}, ${short}`;
}

/** Phone greeting: "Selamat pagi" → "Pagi" (RolePhone "Pagi, Pak Hendra"). */
export function shortGreeting(now: Date = new Date()): string {
    const word = greeting(now).replace('Selamat ', '');

    return word.charAt(0).toUpperCase() + word.slice(1);
}

/** First name for the greeting ("Hendra Wijaya" → "Hendra"). */
export function firstName(name: string | null | undefined): string {
    return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * Progress tone of a project in the decision flow: behind plan by 15 points
 * or more is "danger" (the system flag of PRD M10), behind at all "warning".
 */
export function progressTone(
    actual: number | null,
    planned: number | null,
): 'danger' | 'warning' | 'brand' {
    if (actual === null || planned === null) {
        return 'brand';
    }

    const variance = actual - planned;

    if (variance <= -15) {
        return 'danger';
    }

    return variance < 0 ? 'warning' : 'brand';
}

/** Items still shown after optimistic hides (approvals flow). */
export function withoutHidden<T extends { id: string }>(
    items: T[],
    hidden: ReadonlySet<string>,
): T[] {
    return items.filter((item) => !hidden.has(item.id));
}
