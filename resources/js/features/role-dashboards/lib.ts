import type { BadgeTone } from '@/components/ui/badge';
import type { MeetingPlace, RoleDashboard, RoleKey, Tone } from './types';
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

const PLACES: Record<MeetingPlace, { label: string; classes: string }> = {
    Meet: { label: 'Google Meet', classes: 'bg-link-soft text-link' },
    Zoom: { label: 'Zoom', classes: 'bg-info-soft text-info' },
    Ruang: { label: 'Tatap muka', classes: 'bg-surface-2 text-text-muted' },
    Klien: { label: 'Klien', classes: 'bg-warning-soft text-warning' },
    Tenggat: { label: 'Tenggat', classes: 'bg-danger-soft text-danger' },
};

export function placeOf(place: MeetingPlace) {
    return PLACES[place];
}

// ---- Flow logic (pure, unit tested) ----

export type Verdict = 'approved' | 'rejected';

/** Items still waiting for a verdict (PDirekturSetuju "N menunggu"). */
export function pendingCount(
    ids: string[],
    verdicts: Record<string, Verdict | undefined>,
): number {
    return ids.filter((id) => !verdicts[id]).length;
}

/** UAT tally (PAnalisUAT): done, percent of total and pass rate. */
export function uatTally(passed: number, failed: number, total: number) {
    const done = passed + failed;

    return {
        done,
        percent: total > 0 ? Math.round((done / total) * 100) : 0,
        passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
        /** Number of the scenario on screen (1-based). */
        next: Math.min(done + 1, total),
        finished: done >= total,
    };
}

/** Next step of the bug workflow; after the last step it loops back (demo). */
export function nextBugStep(current: number, steps: number): number {
    return current >= steps - 1 ? 1 : current + 1;
}

/** Selected indexes of a multi-choice chip group, sorted. */
export function toggleIndex(selected: number[], index: number): number[] {
    return selected.includes(index)
        ? selected.filter((value) => value !== index)
        : [...selected, index].sort((a, b) => a - b);
}

/** Label of the material review approve button (PMarketingReview). */
export function reviewButtonLabel(open: number, approved: boolean): string {
    if (approved) {
        return 'Disetujui';
    }

    return open > 0 ? `Setujui (${open} terbuka)` : 'Setujui & kirim';
}

/** Same dashboard with every list emptied (preview of the empty state). */
export function emptyDashboard(config: RoleDashboard): RoleDashboard {
    return {
        ...config,
        flowRow: undefined,
        list: { ...config.list, rows: [] },
        bars: { ...config.bars, items: [] },
        schedule: [],
        side: { ...config.side, items: [] },
        phone: { ...config.phone, rows: [] },
    };
}
