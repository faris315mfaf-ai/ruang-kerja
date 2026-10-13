import type {
    AttendanceWindowRange,
    CheckRejection,
    TodayAttendance,
} from '@/types/attendance';

/** "06:00" → "06.00" (Indonesian time format used across the UI). */
export function windowTime(value: string): string {
    return value.replace(':', '.');
}

/** "06.00–12.00", "mulai 15.00", "sampai 12.00" or null when unbounded. */
export function windowRangeText(
    range: AttendanceWindowRange | null,
): string | null {
    if (!range) {
        return null;
    }

    if (range.from && range.until) {
        return `${windowTime(range.from)}–${windowTime(range.until)}`;
    }

    if (range.from) {
        return `mulai ${windowTime(range.from)}`;
    }

    if (range.until) {
        return `sampai ${windowTime(range.until)}`;
    }

    return null;
}

/**
 * Helper line under the main action: "Jam absen · masuk 06.00–12.00 · pulang
 * mulai 15.00". Null when no company hours apply to today's schedule.
 */
export function windowsLine(
    today: Pick<TodayAttendance, 'windows' | 'windowsApply'>,
): string | null {
    if (!today.windowsApply) {
        return null;
    }

    const parts = [
        ['masuk', windowRangeText(today.windows.checkIn)],
        ['pulang', windowRangeText(today.windows.checkOut)],
    ]
        .filter((part): part is [string, string] => part[1] !== null)
        .map(([label, text]) => `${label} ${text}`);

    return parts.length > 0 ? `Jam absen · ${parts.join(' · ')}` : null;
}

/** The window problem the server refused with (`check_in_window` / `check_out_window`). */
export function isWindowRejection(reason: CheckRejection['reason']): boolean {
    return reason === 'check_in_window' || reason === 'check_out_window';
}

/**
 * Title of the failure screen for a window refusal: opening hours not reached
 * yet ("belum dibuka") or already over ("sudah ditutup").
 */
export function windowRejectionTitle(rejection: CheckRejection): string {
    const noun =
        rejection.reason === 'check_in_window' ? 'Absen masuk' : 'Absen pulang';

    return rejection.context.phase === 'after'
        ? `${noun} sudah ditutup`
        : `${noun} belum dibuka`;
}

/**
 * A closed check-in window ("after") cannot be retried today: the employee
 * files an attendance correction instead. Before opening, waiting is enough.
 */
export function windowSuggestsCorrection(rejection: CheckRejection): boolean {
    return (
        isWindowRejection(rejection.reason) &&
        rejection.context.phase === 'after'
    );
}
