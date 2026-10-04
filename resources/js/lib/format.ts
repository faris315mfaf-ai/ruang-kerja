/**
 * Display formatting helpers (locale id-ID, office timezone Asia/Jakarta).
 *
 * Timestamps are stored in UTC on the server; every date/time shown in the UI
 * must go through these helpers so it is rendered in the office timezone,
 * regardless of the viewer's device timezone.
 */

export const OFFICE_TIMEZONE = 'Asia/Jakarta';

export const LOCALE = 'id-ID';

export type DateInput = Date | string | number;

const EMPTY = '–';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY_MS = 24 * HOUR;

const dateParts = new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: OFFICE_TIMEZONE,
});

const timeParts = new Intl.DateTimeFormat(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: OFFICE_TIMEZONE,
});

// en-CA yields an ISO-like "YYYY-MM-DD", used only to compute calendar days.
const calendarDay = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: OFFICE_TIMEZONE,
});

const numberFormat = new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: 2,
});

/**
 * Converts any supported input to a valid Date, or null when it cannot be
 * parsed. Accepts Laravel's ISO strings (with microseconds), date-only
 * strings ("2026-10-05"), epoch milliseconds and Date instances.
 */
export function toDate(value: DateInput | null | undefined): Date | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

function part(parts: Intl.DateTimeFormatPart[], type: string): string {
    return parts.find((p) => p.type === type)?.value ?? '';
}

/** "Sen, 5 Okt 2026" in the office timezone. */
export function formatDate(value: DateInput | null | undefined): string {
    const date = toDate(value);

    if (!date) {
        return EMPTY;
    }

    // Assembled from parts so the output does not depend on ICU punctuation.
    const parts = dateParts.formatToParts(date);

    return `${part(parts, 'weekday')}, ${part(parts, 'day')} ${part(parts, 'month')} ${part(parts, 'year')}`;
}

/** "08.05" (24-hour clock, dot separator) in the office timezone. */
export function formatTime(value: DateInput | null | undefined): string {
    const date = toDate(value);

    if (!date) {
        return EMPTY;
    }

    const parts = timeParts.formatToParts(date);

    return `${part(parts, 'hour')}.${part(parts, 'minute')}`;
}

/** "Sen, 5 Okt 2026 08.05" in the office timezone. */
export function formatDateTime(value: DateInput | null | undefined): string {
    const date = toDate(value);

    if (!date) {
        return EMPTY;
    }

    return `${formatDate(date)} ${formatTime(date)}`;
}

/** Calendar day index (days since epoch) of a date in the office timezone. */
function officeDayIndex(date: Date): number {
    const [year, month, day] = calendarDay.format(date).split('-').map(Number);

    return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

/**
 * Relative time in Indonesian: "baru saja", "5 menit lalu", "2 jam lalu",
 * "kemarin", "3 hari lalu"; future: "dalam 5 menit", "dalam 2 jam", "besok",
 * "dalam 3 hari". Beyond a week it falls back to weeks, months and years.
 *
 * Differences under a minute (either direction) are "baru saja" so small
 * client/server clock skew never shows "dalam 1 menit" for fresh items.
 */
export function formatRelative(
    value: DateInput | null | undefined,
    now: DateInput = new Date(),
): string {
    const date = toDate(value);
    const reference = toDate(now);

    if (!date || !reference) {
        return EMPTY;
    }

    const diff = date.getTime() - reference.getTime();
    const abs = Math.abs(diff);
    const future = diff > 0;
    const phrase = (amount: number, unit: string): string =>
        future ? `dalam ${amount} ${unit}` : `${amount} ${unit} lalu`;

    if (abs < MINUTE) {
        return 'baru saja';
    }

    if (abs < HOUR) {
        return phrase(Math.floor(abs / MINUTE), 'menit');
    }

    if (abs < DAY_MS) {
        return phrase(Math.floor(abs / HOUR), 'jam');
    }

    const days = Math.abs(officeDayIndex(date) - officeDayIndex(reference));

    if (days <= 1) {
        return future ? 'besok' : 'kemarin';
    }

    if (days < 7) {
        return phrase(days, 'hari');
    }

    if (days < 30) {
        return phrase(Math.floor(days / 7), 'minggu');
    }

    if (days < 365) {
        return phrase(Math.floor(days / 30), 'bulan');
    }

    return phrase(Math.floor(days / 365), 'tahun');
}

/** "1.250" (dot thousands separator, comma decimals, max 2 decimals). */
export function formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return EMPTY;
    }

    return numberFormat.format(value);
}

/**
 * Percent from a value already expressed in percent units: 92 → "92%",
 * 92.5 → "92,5%". Pass `ratio * 100` when starting from a 0–1 ratio.
 */
export function formatPercent(
    value: number | null | undefined,
    fractionDigits = 1,
): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return EMPTY;
    }

    const formatted = new Intl.NumberFormat(LOCALE, {
        maximumFractionDigits: fractionDigits,
    }).format(value);

    return `${formatted}%`;
}
