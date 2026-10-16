import type { AttendanceStatusSummary } from '@/types/attendance';
import type { CenterAction } from '@/lib/navigation';

/** Absen comes back this long before the shift ends (ms). */
export const CHECK_OUT_LEAD_MS = 60 * 60_000;

/**
 * Owner decision 9 Oct 2026: the raised button is Absen before the
 * morning check-in and from one hour before the shift ends (until the
 * check-out); once the user is checked in — and after the check-out —
 * it becomes Workspace, opening the workspace picker sheet. Unknown
 * status keeps Absen: attendance must stay reachable.
 */
export function centerAction(
    status: AttendanceStatusSummary | null | undefined,
    now: number,
): CenterAction {
    if (!status || status.action === 'check_in') {
        return 'absen';
    }

    if (status.action === 'check_out') {
        return status.end !== null &&
            now < Date.parse(status.end) - CHECK_OUT_LEAD_MS
            ? 'workspace'
            : 'absen';
    }

    return 'workspace';
}

/**
 * Milliseconds until `centerAction` flips without any prop change (the
 * end − 60 min moment), null when nothing will change by itself.
 */
export function msUntilCenterFlip(
    status: AttendanceStatusSummary | null | undefined,
    now: number,
): number | null {
    if (!status || status.action !== 'check_out' || status.end === null) {
        return null;
    }

    const flipAt = Date.parse(status.end) - CHECK_OUT_LEAD_MS;

    return Number.isNaN(flipAt) || flipAt <= now ? null : flipAt - now;
}
