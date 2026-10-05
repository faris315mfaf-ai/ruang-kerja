import { OFFICE_TIMEZONE } from '@/lib/format';

/**
 * Date-only helpers for task dates (start_date / due_date are SQL `date`
 * values like "2026-10-08", already in office time). All arithmetic runs on
 * UTC midnights so the viewer's device timezone never shifts a day.
 */

const DAY_MS = 86_400_000;

const isoDay = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: OFFICE_TIMEZONE,
});

const weekdayShort = new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    timeZone: 'UTC',
});

const dayMonth = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
});

const monthYear = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
});

const monthShort = new Intl.DateTimeFormat('id-ID', {
    month: 'short',
    timeZone: 'UTC',
});

/** Today's date in the office timezone ("YYYY-MM-DD"). */
export function officeToday(now: Date = new Date()): string {
    return isoDay.format(now);
}

function toUtc(date: string): number {
    const [year, month, day] = date.slice(0, 10).split('-').map(Number);

    return Date.UTC(year, month - 1, day);
}

function fromUtc(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
    return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: string, to: string): number {
    return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
    const day = new Date(toUtc(date)).getUTCDay();

    return day === 0 ? 7 : day;
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
    return addDays(date, 1 - isoWeekday(date));
}

/** Sunday of the week containing `date`. */
export function endOfWeek(date: string): string {
    return addDays(date, 7 - isoWeekday(date));
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Kam" */
export function formatWeekdayShort(date: string): string {
    return weekdayShort.format(toUtc(date)).replace('.', '');
}

/** "8 Okt" */
export function formatDayMonth(date: string): string {
    return dayMonth.format(toUtc(date)).replace('.', '');
}

/** "Kam, 8 Okt" */
export function formatShortDate(date: string): string {
    return `${formatWeekdayShort(date)}, ${formatDayMonth(date)}`;
}

/** "Oktober 2026" */
export function formatMonthYear(date: string): string {
    return capitalize(monthYear.format(toUtc(date)));
}

/** "Okt" */
export function formatMonthShort(date: string): string {
    return monthShort.format(toUtc(date)).replace('.', '');
}

/** "6–11 Okt" or "28 Sep–4 Okt" */
export function formatDayRange(from: string, to: string): string {
    if (from.slice(0, 7) === to.slice(0, 7)) {
        return `${Number(from.slice(8, 10))}–${formatDayMonth(to)}`;
    }

    return `${formatDayMonth(from)}–${formatDayMonth(to)}`;
}

export type DueState = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';

export function dueState(due: string, today: string): DueState {
    const days = diffDays(today, due);

    if (days < 0) {
        return 'overdue';
    }

    if (days === 0) {
        return 'today';
    }

    if (days === 1) {
        return 'tomorrow';
    }

    return due <= endOfWeek(today) ? 'week' : 'later';
}

/**
 * Due label as in the mockups: "Lewat 2 hari", "Hari ini", "Besok",
 * "Kam, 8 Okt" (this week) or "16 Okt" (later; year added when different).
 */
export function formatDue(due: string, today: string): string {
    const state = dueState(due, today);

    switch (state) {
        case 'overdue':
            return `Lewat ${-diffDays(today, due)} hari`;
        case 'today':
            return 'Hari ini';
        case 'tomorrow':
            return 'Besok';
        case 'week':
            return formatShortDate(due);
        default:
            return due.slice(0, 4) === today.slice(0, 4)
                ? formatDayMonth(due)
                : `${formatDayMonth(due)} ${due.slice(0, 4)}`;
    }
}

/** Text tone for a due date on an open task. */
export function dueTone(
    due: string | null,
    today: string,
    closed: boolean,
): 'danger' | 'warning' | 'muted' {
    if (!due || closed) {
        return 'muted';
    }

    const state = dueState(due, today);

    if (state === 'overdue') {
        return 'danger';
    }

    return state === 'today' || state === 'tomorrow' ? 'warning' : 'muted';
}

export type DueGroup = 'overdue' | 'today' | 'week' | 'later' | 'none';

export const DUE_GROUPS: DueGroup[] = [
    'overdue',
    'today',
    'week',
    'later',
    'none',
];

/** "Tugas saya" groups: Terlambat, Hari ini, Minggu ini, Nanti, Tanpa tenggat. */
export function dueGroup(due: string | null, today: string): DueGroup {
    if (!due) {
        return 'none';
    }

    const state = dueState(due, today);

    if (state === 'tomorrow') {
        return 'week';
    }

    return state;
}

/**
 * "Selesai 28 Sep · tepat waktu" / "Selesai 1 Okt · telat 1 hari" (DBoard,
 * closed cards). `completedAt` is an ISO timestamp, compared in office time.
 */
export function formatCompletion(
    completedAt: string,
    due: string | null,
): { text: string; late: boolean } {
    const day = officeToday(new Date(completedAt));
    const base = `Selesai ${formatDayMonth(day)}`;

    if (!due) {
        return { text: base, late: false };
    }

    const late = diffDays(due, day);

    return late > 0
        ? { text: `${base} · telat ${late} hari`, late: true }
        : { text: `${base} · tepat waktu`, late: false };
}
