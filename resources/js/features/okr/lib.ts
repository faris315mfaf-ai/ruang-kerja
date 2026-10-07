import { formatNumber } from '@/lib/format';
import type {
    KeyResult,
    KrCheckin,
    KrUnit,
    Objective,
    OkrStatus,
    PersonRef,
    QuarterKey,
} from './types';

const DAY_MS = 86_400_000;

function dayNumber(iso: string): number {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);

    return Date.UTC(y, m - 1, d) / DAY_MS;
}

function isoFromDay(day: number): string {
    return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

// ---- Quarter ----

export function parseQuarter(quarter: QuarterKey): { year: number; q: number } {
    const [year, q] = quarter.split('-Q').map(Number);

    return { year, q };
}

/** First and last office date of a quarter. */
export function quarterRange(quarter: QuarterKey): {
    start: string;
    end: string;
} {
    const { year, q } = parseQuarter(quarter);
    const startMonth = (q - 1) * 3;
    const start = Date.UTC(year, startMonth, 1) / DAY_MS;
    const end = Date.UTC(year, startMonth + 3, 1) / DAY_MS - 1;

    return { start: isoFromDay(start), end: isoFromDay(end) };
}

/** Days in the quarter (Q4 = 92). */
export function quarterDays(quarter: QuarterKey): number {
    const { start, end } = quarterRange(quarter);

    return dayNumber(end) - dayNumber(start) + 1;
}

/** Share of the quarter that has passed by the end of `today` (0–1). */
export function quarterElapsed(quarter: QuarterKey, today: string): number {
    const { start } = quarterRange(quarter);
    const passed = dayNumber(today) - dayNumber(start) + 1;

    return clamp(passed / quarterDays(quarter), 0, 1);
}

/** Weeks in the quarter (13 or 14) and the current week (1-based, clamped). */
export function quarterWeek(
    quarter: QuarterKey,
    today: string,
): { week: number; weeks: number } {
    const days = quarterDays(quarter);
    const weeks = Math.ceil(days / 7);
    const { start } = quarterRange(quarter);
    const week = Math.floor((dayNumber(today) - dayNumber(start)) / 7) + 1;

    return { week: clamp(week, 1, weeks), weeks };
}

const MONTHS = [
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

/** "Q4 2026 · Okt–Des". */
export function quarterLabel(quarter: QuarterKey, long = false): string {
    const { year, q } = parseQuarter(quarter);
    const base = `Q${q} ${year}`;

    if (!long) {
        return base;
    }

    return `${base} · ${MONTHS[(q - 1) * 3]}–${MONTHS[(q - 1) * 3 + 2]}`;
}

/** The quarter a date falls in. */
export function quarterOf(iso: string): QuarterKey {
    const [year, month] = iso.split('-').map(Number);

    return `${year}-Q${Math.ceil(month / 3) as 1 | 2 | 3 | 4}`;
}

// ---- Progress ----

/**
 * Raw progress of a key result from its start value toward the target,
 * unclamped: works for "lower is better" targets (bugs 14 → 4) and goes
 * below 0 when the value moved away from the target.
 */
export function krRawProgress(
    kr: Pick<KeyResult, 'start_value' | 'target_value' | 'current_value'>,
): number {
    const span = kr.target_value - kr.start_value;

    if (span === 0) {
        return kr.current_value === kr.target_value ? 1 : 0;
    }

    return (kr.current_value - kr.start_value) / span;
}

/** Progress of a key result for display, 0–1. */
export function krProgress(
    kr: Pick<KeyResult, 'start_value' | 'target_value' | 'current_value'>,
): number {
    return clamp(krRawProgress(kr), 0, 1);
}

/**
 * Weighted average of key result progress (weights default to equal). With
 * `raw` the per-KR progress is clamped to −1…1 instead of 0…1 so a key result
 * that moved backwards pulls the status down.
 */
export function weightedProgress(
    keyResults: Pick<
        KeyResult,
        'start_value' | 'target_value' | 'current_value' | 'weight'
    >[],
    raw = false,
): number {
    const total = keyResults.reduce(
        (sum, kr) => sum + Math.max(0, kr.weight),
        0,
    );

    if (keyResults.length === 0) {
        return 0;
    }

    return keyResults.reduce((sum, kr) => {
        const share =
            total > 0 ? Math.max(0, kr.weight) / total : 1 / keyResults.length;
        const value = raw ? clamp(krRawProgress(kr), -1, 1) : krProgress(kr);

        return sum + value * share;
    }, 0);
}

/** Thresholds (progress − elapsed) for the status bands. */
export const STATUS_GAP = { atRisk: -0.1, behind: -0.25 } as const;

/**
 * Status from the gap between progress and the share of the quarter that has
 * passed: ≥ −10 points on track, ≥ −25 points at risk, otherwise behind.
 */
export function statusFor(progress: number, elapsed: number): OkrStatus {
    const gap = progress - elapsed;

    if (gap >= STATUS_GAP.atRisk) {
        return 'on_track';
    }

    return gap >= STATUS_GAP.behind ? 'at_risk' : 'behind';
}

export function krStatus(kr: KeyResult, elapsed: number): OkrStatus {
    return statusFor(clamp(krRawProgress(kr), -1, 1), elapsed);
}

export type ObjectiveSummary = {
    /** Display progress 0–1. */
    progress: number;
    status: OkrStatus;
    /** Expected progress = share of quarter passed (0–1). */
    expected: number;
    /** Key results whose value moved away from the target. */
    regressed: number;
    counts: Record<OkrStatus, number>;
};

export function summarizeObjective(
    objective: Objective,
    today: string,
): ObjectiveSummary {
    const expected = quarterElapsed(objective.quarter, today);
    const counts: Record<OkrStatus, number> = {
        on_track: 0,
        at_risk: 0,
        behind: 0,
    };

    for (const kr of objective.key_results) {
        counts[krStatus(kr, expected)] += 1;
    }

    return {
        progress: weightedProgress(objective.key_results),
        status: statusFor(
            weightedProgress(objective.key_results, true),
            expected,
        ),
        expected,
        regressed: objective.key_results.filter((kr) => krRawProgress(kr) < 0)
            .length,
        counts,
    };
}

/** Portfolio-level numbers for the list header. */
export function aggregate(objectives: Objective[], today: string) {
    const summaries = objectives.map((objective) =>
        summarizeObjective(objective, today),
    );
    const counts: Record<OkrStatus, number> = {
        on_track: 0,
        at_risk: 0,
        behind: 0,
    };

    for (const summary of summaries) {
        counts[summary.status] += 1;
    }

    return {
        progress:
            summaries.length === 0
                ? 0
                : summaries.reduce((sum, s) => sum + s.progress, 0) /
                  summaries.length,
        counts,
        keyResults: objectives.reduce(
            (sum, o) => sum + o.key_results.length,
            0,
        ),
    };
}

export function filterObjectives(
    objectives: Objective[],
    filters: { quarter: QuarterKey | 'all'; division: string },
): Objective[] {
    return objectives.filter(
        (objective) =>
            (filters.quarter === 'all' ||
                objective.quarter === filters.quarter) &&
            (filters.division === 'all' ||
                objective.division.id === filters.division),
    );
}

/** Objectives grouped by division, divisions in first-seen order. */
export function groupByDivision(objectives: Objective[]) {
    const groups = new Map<
        string,
        { division: Objective['division']; items: Objective[] }
    >();

    for (const objective of objectives) {
        const group = groups.get(objective.division.id) ?? {
            division: objective.division,
            items: [],
        };

        group.items.push(objective);
        groups.set(objective.division.id, group);
    }

    return [...groups.values()];
}

// ---- Values & chart ----

export function formatKrValue(
    value: number,
    unit: KrUnit,
    label: string,
): string {
    switch (unit) {
        case 'percent':
            return `${formatNumber(value)}%`;
        case 'currency':
            return `Rp ${formatNumber(value)}`;
        case 'days':
            return `${formatNumber(value)} hari`;
        default:
            return label
                ? `${formatNumber(value)} ${label}`
                : formatNumber(value);
    }
}

export type KrChartPoint = {
    week: number;
    /** Planned value (straight line start → target). */
    plan: number;
    /** Latest check-in value up to this week (null in the future). */
    actual: number | null;
};

/**
 * Weekly chart rows: plan line from start to target over the quarter, actual
 * = last check-in of each week (week 0 = start value), future weeks null.
 */
export function krChartSeries(
    kr: KeyResult,
    quarter: QuarterKey,
    today: string,
): KrChartPoint[] {
    const { week: currentWeek, weeks } = quarterWeek(quarter, today);
    const { start } = quarterRange(quarter);
    const startDay = dayNumber(start);
    const sorted = [...kr.checkins].sort((a, b) =>
        a.date.localeCompare(b.date),
    );
    const closed = dayNumber(today) > dayNumber(quarterRange(quarter).end);
    const lastWeek = closed ? weeks : currentWeek;

    let value = kr.start_value;

    return Array.from({ length: weeks + 1 }, (_, week) => {
        const plan =
            kr.start_value +
            ((kr.target_value - kr.start_value) * week) / weeks;

        if (week > 0) {
            for (const checkin of sorted) {
                const checkinWeek =
                    Math.floor((dayNumber(checkin.date) - startDay) / 7) + 1;

                if (checkinWeek === week) {
                    value = checkin.value;
                }
            }
        }

        return {
            week,
            plan: Math.round(plan * 100) / 100,
            actual: week <= lastWeek ? value : null,
        };
    });
}

// ---- Forms & optimistic updates (pure) ----

export type KrDraft = {
    title: string;
    unit: KrUnit;
    unit_label: string;
    start_value: string;
    target_value: string;
    current_value: string;
    weight: string;
    owner_id: string;
};

export type KrDraftErrors = Partial<Record<keyof KrDraft, string>>;

function parseNumber(value: string): number | null {
    const normalized = value.trim().replace(/\./g, '').replace(',', '.');

    if (normalized === '' || !/^-?\d+(\.\d+)?$/.test(normalized)) {
        return null;
    }

    return Number(normalized);
}

/** Validates the add/edit key result form (Indonesian messages). */
export function validateKrDraft(draft: KrDraft): KrDraftErrors {
    const errors: KrDraftErrors = {};
    const start = parseNumber(draft.start_value);
    const target = parseNumber(draft.target_value);
    const current = parseNumber(draft.current_value);
    const weight = parseNumber(draft.weight);

    if (draft.title.trim().length < 5) {
        errors.title = 'Tulis key result minimal 5 karakter.';
    } else if (draft.title.trim().length > 160) {
        errors.title = 'Maksimal 160 karakter.';
    }

    if (start === null) {
        errors.start_value = 'Isi angka awal.';
    }

    if (target === null) {
        errors.target_value = 'Isi angka target.';
    } else if (start !== null && target === start) {
        errors.target_value = 'Target harus berbeda dari nilai awal.';
    }

    if (current === null) {
        errors.current_value = 'Isi nilai saat ini.';
    }

    if (draft.unit === 'percent') {
        for (const key of [
            'start_value',
            'target_value',
            'current_value',
        ] as const) {
            const value = parseNumber(draft[key]);

            if (value !== null && (value < 0 || value > 100) && !errors[key]) {
                errors[key] = 'Persen harus 0–100.';
            }
        }
    }

    if (
        weight === null ||
        !Number.isInteger(weight) ||
        weight < 1 ||
        weight > 100
    ) {
        errors.weight = 'Bobot bilangan bulat 1–100.';
    }

    if (!draft.owner_id) {
        errors.owner_id = 'Pilih pemilik.';
    }

    return errors;
}

export function draftFromKr(
    kr: KeyResult | null,
    defaultOwner: string,
): KrDraft {
    if (!kr) {
        return {
            title: '',
            unit: 'number',
            unit_label: '',
            start_value: '0',
            target_value: '',
            current_value: '0',
            weight: '1',
            owner_id: defaultOwner,
        };
    }

    return {
        title: kr.title,
        unit: kr.unit,
        unit_label: kr.unit_label,
        start_value: String(kr.start_value).replace('.', ','),
        target_value: String(kr.target_value).replace('.', ','),
        current_value: String(kr.current_value).replace('.', ','),
        weight: String(kr.weight),
        owner_id: kr.owner.id,
    };
}

/** Applies a valid draft to a new or existing key result. */
export function applyKrDraft(
    draft: KrDraft,
    base: KeyResult | null,
    context: { objectiveId: string; owners: PersonRef[]; id: string },
): KeyResult {
    const owner =
        context.owners.find((person) => person.id === draft.owner_id) ??
        base?.owner ??
        context.owners[0];

    return {
        id: base?.id ?? context.id,
        objective_id: context.objectiveId,
        title: draft.title.trim(),
        unit: draft.unit,
        unit_label: draft.unit === 'number' ? draft.unit_label.trim() : '',
        start_value: parseNumber(draft.start_value) ?? 0,
        target_value: parseNumber(draft.target_value) ?? 0,
        current_value: parseNumber(draft.current_value) ?? 0,
        weight: parseNumber(draft.weight) ?? 1,
        owner,
        tasks: base?.tasks ?? [],
        checkins: base?.checkins ?? [],
    };
}

/**
 * Request body of the add/edit key result form (validated draft; numbers
 * parsed from Indonesian notation, label only for the number unit).
 */
export function draftToPayload(draft: KrDraft) {
    return {
        title: draft.title.trim(),
        unit: draft.unit,
        unit_label: draft.unit === 'number' ? draft.unit_label.trim() : '',
        start_value: parseNumber(draft.start_value),
        target_value: parseNumber(draft.target_value),
        current_value: parseNumber(draft.current_value),
        weight: parseNumber(draft.weight),
        owner_id: draft.owner_id,
    };
}

/** Records a check-in: new current value + history entry (newest last). */
export function applyCheckin(
    kr: KeyResult,
    checkin: Omit<KrCheckin, 'key_result_id'>,
): KeyResult {
    return {
        ...kr,
        current_value: checkin.value,
        checkins: [...kr.checkins, { ...checkin, key_result_id: kr.id }],
    };
}

export { parseNumber as parseKrNumber };
