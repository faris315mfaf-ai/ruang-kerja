import type {
    RecurrencePattern,
    RecurrenceRule,
    Weekday,
} from '@/features/automation/types';

/**
 * Recurring task schedule (pure, date-only). Dates are office calendar days
 * as `YYYY-MM-DD`; arithmetic runs on UTC midnights so the device timezone
 * never shifts a day.
 */

const DAY_MS = 86_400_000;
/** Stop scanning after ~3 years: a pattern that never fires is a form error. */
const MAX_SCAN_DAYS = 3 * 366;

export const WEEKDAYS: { value: Weekday; short: string; long: string }[] = [
    { value: 1, short: 'Sen', long: 'Senin' },
    { value: 2, short: 'Sel', long: 'Selasa' },
    { value: 3, short: 'Rab', long: 'Rabu' },
    { value: 4, short: 'Kam', long: 'Kamis' },
    { value: 5, short: 'Jum', long: 'Jumat' },
    { value: 6, short: 'Sab', long: 'Sabtu' },
    { value: 7, short: 'Min', long: 'Minggu' },
];

export function isIsoDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));

    return (
        date.getUTCFullYear() === y &&
        date.getUTCMonth() === m - 1 &&
        date.getUTCDate() === d
    );
}

function toDay(value: string): number {
    const [y, m, d] = value.split('-').map(Number);

    return Date.UTC(y, m - 1, d) / DAY_MS;
}

function fromDay(day: number): string {
    return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a day index. */
function weekdayOf(day: number): Weekday {
    // 1970-01-01 was a Thursday (ISO 4).
    return (((((day + 3) % 7) + 7) % 7) + 1) as Weekday;
}

function mondayOf(day: number): number {
    return day - (weekdayOf(day) - 1);
}

function daysInMonth(year: number, monthIndex: number): number {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Whether `day` matches the pattern (ignores start/end bounds). */
function matches(
    pattern: RecurrencePattern,
    day: number,
    start: number,
): boolean {
    const weekday = weekdayOf(day);

    switch (pattern.kind) {
        case 'daily':
            return !pattern.weekdays_only || weekday <= 5;
        case 'weekly':
            return pattern.weekdays.includes(weekday);
        case 'monthly': {
            const date = new Date(day * DAY_MS);
            const last = daysInMonth(date.getUTCFullYear(), date.getUTCMonth());
            // Day 31 in a 30-day month falls on the last day.
            const target = Math.min(pattern.day_of_month, last);

            return date.getUTCDate() === target;
        }
        case 'every_n_weeks': {
            if (!pattern.weekdays.includes(weekday)) {
                return false;
            }

            const weeks = Math.round((mondayOf(day) - mondayOf(start)) / 7);

            return weeks % Math.max(1, pattern.interval) === 0;
        }
    }
}

/**
 * Next `count` dates (inclusive of `from`) on which the task is created,
 * never before `starts_on` nor after `ends_on`.
 */
export function nextOccurrences(
    rule: RecurrenceRule,
    from: string,
    count = 5,
): string[] {
    if (!isIsoDate(rule.starts_on) || !isIsoDate(from)) {
        return [];
    }

    const start = toDay(rule.starts_on);
    const end =
        rule.ends_on && isIsoDate(rule.ends_on) ? toDay(rule.ends_on) : null;
    const result: string[] = [];
    let day = Math.max(start, toDay(from));

    for (
        let scanned = 0;
        scanned < MAX_SCAN_DAYS && result.length < count;
        scanned++, day++
    ) {
        if (end !== null && day > end) {
            break;
        }

        if (matches(rule.pattern, day, start)) {
            result.push(fromDay(day));
        }
    }

    return result;
}

function joinIndonesian(items: string[]): string {
    if (items.length <= 1) {
        return items.join('');
    }

    return `${items.slice(0, -1).join(', ')} dan ${items[items.length - 1]}`;
}

function weekdayNames(weekdays: Weekday[]): string {
    const sorted = [...weekdays].sort((a, b) => a - b);

    if (sorted.join() === '1,2,3,4,5') {
        return 'hari kerja';
    }

    return joinIndonesian(sorted.map((value) => WEEKDAYS[value - 1].long));
}

/** "Setiap Senin dan Kamis", "Setiap bulan tanggal 25", … */
export function describePattern(pattern: RecurrencePattern): string {
    switch (pattern.kind) {
        case 'daily':
            return pattern.weekdays_only ? 'Setiap hari kerja' : 'Setiap hari';
        case 'weekly':
            return pattern.weekdays.length === 0
                ? 'Mingguan (pilih hari)'
                : `Setiap ${weekdayNames(pattern.weekdays)}`;
        case 'monthly':
            return pattern.day_of_month >= 31
                ? 'Setiap akhir bulan'
                : `Setiap bulan tanggal ${pattern.day_of_month}`;
        case 'every_n_weeks': {
            const days =
                pattern.weekdays.length === 0
                    ? '(pilih hari)'
                    : `hari ${weekdayNames(pattern.weekdays)}`;

            return pattern.interval <= 1
                ? `Setiap minggu, ${days}`
                : `Setiap ${pattern.interval} minggu, ${days}`;
        }
    }
}

export type RecurringForm = {
    title: string;
    workspace_id: string;
    assignee_id: string;
    pattern: RecurrencePattern;
    starts_on: string;
    ends_on: string;
};

export type RecurringErrors = Partial<
    Record<
        'title' | 'workspace_id' | 'pattern' | 'starts_on' | 'ends_on',
        string
    >
>;

/** Client-side validation (the server repeats it later). */
export function validateRecurring(form: RecurringForm): RecurringErrors {
    const errors: RecurringErrors = {};

    if (form.title.trim() === '') {
        errors.title = 'Isi judul tugas.';
    } else if (form.title.trim().length > 255) {
        errors.title = 'Judul maksimal 255 karakter.';
    }

    if (form.workspace_id === '') {
        errors.workspace_id = 'Pilih workspace.';
    }

    const { pattern } = form;

    if (
        (pattern.kind === 'weekly' || pattern.kind === 'every_n_weeks') &&
        pattern.weekdays.length === 0
    ) {
        errors.pattern = 'Pilih minimal satu hari.';
    } else if (
        pattern.kind === 'monthly' &&
        (!Number.isInteger(pattern.day_of_month) ||
            pattern.day_of_month < 1 ||
            pattern.day_of_month > 31)
    ) {
        errors.pattern = 'Tanggal harus 1–31.';
    } else if (
        pattern.kind === 'every_n_weeks' &&
        (!Number.isInteger(pattern.interval) ||
            pattern.interval < 1 ||
            pattern.interval > 12)
    ) {
        errors.pattern = 'Jarak minggu harus 1–12.';
    }

    if (!isIsoDate(form.starts_on)) {
        errors.starts_on = 'Isi tanggal mulai.';
    }

    if (form.ends_on !== '') {
        if (!isIsoDate(form.ends_on)) {
            errors.ends_on = 'Tanggal berakhir tidak valid.';
        } else if (isIsoDate(form.starts_on) && form.ends_on < form.starts_on) {
            errors.ends_on = 'Tanggal berakhir harus setelah tanggal mulai.';
        }
    }

    if (
        Object.keys(errors).length === 0 &&
        nextOccurrences(
            {
                pattern,
                starts_on: form.starts_on,
                ends_on: form.ends_on || null,
            },
            form.starts_on,
            1,
        ).length === 0
    ) {
        errors.ends_on =
            'Tidak ada jadwal di antara tanggal mulai dan berakhir.';
    }

    return errors;
}
