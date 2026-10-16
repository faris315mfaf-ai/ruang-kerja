import type { CheckRejection } from '@/types/attendance';

export type CheckType = 'in' | 'out';

/**
 * "Rencana kerja" (check-in, morning) and "Laporan kerja" (check-out, evening)
 * are both a required list of numbered points that rides to the management
 * WhatsApp group with the photo (owner decisions 8 and 13 Oct 2026).
 */
export type PointsKind = 'plan' | 'report';

export const MAX_WORK_POINTS = 8;
export const MAX_WORK_POINT_LENGTH = 300;

export function pointsKindFor(type: CheckType): PointsKind {
    return type === 'in' ? 'plan' : 'report';
}

/** Wording of the points editor per kind (labels, hints, errors). */
export const POINTS_COPY: Record<
    PointsKind,
    {
        title: string;
        hint: string;
        itemLabel: string;
        placeholder: string;
        placeholderNext: string;
        error: string;
        /** Laravel field name of the points (`work_plan` / `work_report`). */
        field: string;
    }
> = {
    plan: {
        title: 'Rencana kerja',
        hint: 'Apa yang akan Anda kerjakan hari ini? Terkirim ke grup manajemen bersama foto Anda.',
        itemLabel: 'Poin rencana kerja',
        placeholder: 'Mis. Selesaikan laporan mingguan',
        placeholderNext: 'Poin berikutnya',
        error: 'Tulis minimal satu poin rencana kerja hari ini — ikut terkirim ke grup manajemen.',
        field: 'work_plan',
    },
    report: {
        title: 'Laporan kerja',
        hint: 'Apa yang sudah Anda kerjakan hari ini? Terkirim ke grup manajemen bersama foto Anda.',
        itemLabel: 'Poin laporan kerja',
        placeholder: 'Mis. Laporan mingguan selesai dan terkirim',
        placeholderNext: 'Poin berikutnya',
        error: 'Tulis minimal satu poin laporan kerja hari ini sebelum absen pulang — ikut terkirim ke grup manajemen.',
        field: 'work_report',
    },
};

/**
 * Both the plan (check-in) and the report (check-out) need at least one
 * non-blank point. Returns the inline error, or null when fine.
 */
export function pointsRejection(
    type: CheckType,
    points: readonly string[],
): string | null {
    return points.every((point) => point.trim() === '')
        ? POINTS_COPY[pointsKindFor(type)].error
        : null;
}

/** Only trimmed, non-empty points are sent (blank rows are dropped). */
export function workPoints(points: readonly string[]): string[] {
    return points
        .map((point) => point.trim())
        .filter((point) => point !== '')
        .slice(0, MAX_WORK_POINTS);
}

/**
 * Client-side gate before sending the selfie: the points are required for
 * both directions and a remote (WFH/field) attempt needs a location note.
 */
export function submitProblems(input: {
    type: CheckType;
    points: readonly string[];
    isRemote: boolean;
    note: string;
}): { points: string | null; note: string | null } {
    return {
        points: pointsRejection(input.type, input.points),
        note:
            input.isRemote && input.note.trim() === ''
                ? `Tulis catatan lokasi atau aktivitas untuk ${input.type === 'in' ? 'check-in' : 'check-out'} di luar kantor.`
                : null,
    };
}

/**
 * The server's 422 about the points (`work_plan*` / `work_report*`) so it can
 * be shown inline in the review step instead of on the failure screen.
 */
export function pointsServerError(
    rejection: CheckRejection,
    type: CheckType,
): string | null {
    if (rejection.reason !== 'validation' || !rejection.errors) {
        return null;
    }

    const field = POINTS_COPY[pointsKindFor(type)].field;
    const key = Object.keys(rejection.errors).find(
        (name) => name === field || name.startsWith(`${field}.`),
    );

    return key ? rejection.errors[key] : null;
}
