import type {
    MilestoneStatus,
    ProjectFlag,
    ProjectHealth,
    ProjectMetrics,
    RiskLevel,
} from './types';

export const HEALTH_LABELS: Record<ProjectHealth, string> = {
    on_track: 'Sesuai jalur',
    at_risk: 'Berisiko',
    off_track: 'Bermasalah',
};

/** Tinted pill + dot classes per health (token colors only). */
export const HEALTH_TONES: Record<
    ProjectHealth,
    { pill: string; dot: string; bar: string; text: string; track: string }
> = {
    on_track: {
        pill: 'bg-success-soft text-success',
        dot: 'bg-success',
        bar: 'bg-success',
        text: 'text-success',
        track: 'bg-success/15 border-success/60',
    },
    at_risk: {
        pill: 'bg-warning-soft text-warning',
        dot: 'bg-fill-warning',
        bar: 'bg-fill-warning',
        text: 'text-warning',
        track: 'bg-warning-soft border-warning/60',
    },
    off_track: {
        pill: 'bg-danger-soft text-danger',
        dot: 'bg-fill-danger',
        bar: 'bg-fill-danger',
        text: 'text-danger',
        track: 'bg-danger/15 border-danger/60',
    },
};

export const FLAG_LABELS: Record<ProjectFlag, string> = {
    behind: 'Tertinggal',
    missed_milestone: 'Milestone terlewat',
    stale_update: 'Update kedaluwarsa',
};

export const MILESTONE_LABELS: Record<MilestoneStatus, string> = {
    not_started: 'Belum mulai',
    in_progress: 'Berjalan',
    completed: 'Selesai',
    completed_late: 'Selesai terlambat',
    missed: 'Terlewat',
};

export const RISK_LABELS: Record<RiskLevel, string> = {
    high: 'Tinggi',
    medium: 'Sedang',
    low: 'Rendah',
};

export const RISK_TONES: Record<RiskLevel, string> = {
    high: 'bg-danger-soft text-danger',
    medium: 'bg-warning-soft text-warning',
    low: 'bg-surface-2 text-text-muted',
};

const MONTHS_SHORT = [
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

const WEEKDAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const DAY_MS = 86_400_000;

/** Parses "2026-10-05" (an office-calendar date) as UTC midnight. */
export function parseDay(day: string): number {
    const [year, month, date] = day.slice(0, 10).split('-').map(Number);

    return Date.UTC(year, month - 1, date);
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"). */
export function daysBetween(from: string, to: string): number {
    return Math.round((parseDay(to) - parseDay(from)) / DAY_MS);
}

/** "9 Okt" for an office-calendar date. */
export function shortDay(day: string | null): string {
    if (!day) {
        return '–';
    }

    const date = new Date(parseDay(day));

    return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`;
}

/** "Jum, 9 Okt" for an office-calendar date. */
export function weekdayDay(day: string | null): string {
    if (!day) {
        return '–';
    }

    const date = new Date(parseDay(day));

    return `${WEEKDAYS_SHORT[date.getUTCDay()]}, ${shortDay(day)}`;
}

/** "4 hari lagi" · "hari ini" · "besok" · "lewat 2 hari". */
export function dueLabel(days: number | null): string {
    if (days === null) {
        return '–';
    }

    if (days === 0) {
        return 'hari ini';
    }

    if (days === 1) {
        return 'besok';
    }

    return days > 0 ? `${days} hari lagi` : `lewat ${Math.abs(days)} hari`;
}

/** "Kemarin" · "9 hari lalu" · "Hari ini" · "Belum ada update". */
export function updateAgeLabel(days: number | null): string {
    if (days === null) {
        return 'Belum ada update';
    }

    if (days <= 0) {
        return 'Hari ini';
    }

    return days === 1 ? 'Kemarin' : `${days} hari lalu`;
}

/** Rounded percent for display ("48%"), "–" without data. */
export function percent(value: number | null): string {
    return value === null ? '–' : `${Math.round(value)}%`;
}

/** "−13 poin" / "+4 poin" (rounded, typographic minus). */
export function pointsLabel(variance: number | null): string {
    if (variance === null) {
        return '–';
    }

    const rounded = Math.round(variance);

    if (rounded === 0) {
        return '0 poin';
    }

    return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)} poin`;
}

/**
 * Short description of the system flags, e.g.
 * "Tertinggal 32 poin · Milestone terlewat · Update 9 hari".
 */
export function flagSummary(metrics: ProjectMetrics): string {
    return metrics.flags
        .map((flag) => {
            switch (flag) {
                case 'behind':
                    return `Tertinggal ${Math.abs(Math.round(metrics.variance ?? 0))} poin`;
                case 'missed_milestone':
                    return metrics.missed_milestones.length === 1
                        ? `Milestone terlewat`
                        : `${metrics.missed_milestones.length} milestone terlewat`;
                case 'stale_update':
                    return metrics.update_age_days === null
                        ? 'Belum ada update'
                        : `Update ${metrics.update_age_days} hari`;
                default:
                    return '';
            }
        })
        .filter(Boolean)
        .join(' · ');
}

/** Position of a date inside [from, to] in percent (clamped 0–100). */
export function positionPercent(day: string, from: string, to: string): number {
    const span = parseDay(to) - parseDay(from) + DAY_MS;
    const offset = parseDay(day) - parseDay(from);

    return Math.min(100, Math.max(0, (offset / span) * 100));
}

/** Sort weight: problems first, projects without update in between. */
export function healthRank(health: ProjectHealth | null): number {
    if (health === null) {
        return 1.5;
    }

    return { off_track: 0, at_risk: 1, on_track: 2 }[health];
}
