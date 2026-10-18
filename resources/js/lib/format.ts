/**
 * Display formatting helpers (locale id-ID, office timezone of the company).
 *
 * Timestamps are stored in UTC on the server; every date/time shown in the UI
 * must go through these helpers so it is rendered in the office timezone,
 * regardless of the viewer's device timezone.
 *
 * The office timezone is the signed-in company's `companies.timezone` (shared
 * prop `officeTimezone`, set in app.tsx; Fase 1 multi-perusahaan), Asia/Jakarta
 * until the server says otherwise.
 */

/** Office timezone of SPKD, and the fallback before/without a company. */
export const DEFAULT_OFFICE_TIMEZONE = 'Asia/Jakarta';

export const LOCALE = 'id-ID';

export type DateInput = Date | string | number;

const EMPTY = '–';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY_MS = 24 * HOUR;

let currentOfficeTimezone = DEFAULT_OFFICE_TIMEZONE;

/** The office timezone used by every helper below. */
export function officeTimezone(): string {
    return currentOfficeTimezone;
}

/**
 * Sets the office timezone (shared prop `officeTimezone`). Values that are not
 * a timezone the browser knows are ignored, keeping the previous one.
 */
export function setOfficeTimezone(timezone: unknown): void {
    if (
        typeof timezone !== 'string' ||
        timezone === '' ||
        timezone === currentOfficeTimezone
    ) {
        return;
    }

    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
        return;
    }

    currentOfficeTimezone = timezone;
}

const officeFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * `Intl.DateTimeFormat` in the office timezone, created once per timezone,
 * locale and options. Call it where the format is used (not at module load),
 * so a timezone set later is respected.
 */
export function officeDateFormat(
    locale: string,
    options: Omit<Intl.DateTimeFormatOptions, 'timeZone'>,
): Intl.DateTimeFormat {
    const key = `${currentOfficeTimezone}|${locale}|${JSON.stringify(options)}`;
    let format = officeFormats.get(key);

    if (format === undefined) {
        format = new Intl.DateTimeFormat(locale, {
            ...options,
            timeZone: currentOfficeTimezone,
        });
        officeFormats.set(key, format);
    }

    return format;
}

/**
 * UTC offset of the office timezone on an office date ("YYYY-MM-DD"), as
 * "+07:00", for building ISO instants from office date + clock time.
 */
export function officeUtcOffset(day: string): string {
    const noon = Date.parse(`${day}T12:00:00Z`);

    if (Number.isNaN(noon)) {
        return '+00:00';
    }

    const parts = officeDateFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date(noon));
    const part = (type: Intl.DateTimeFormatPartTypes): number =>
        Number(parts.find((item) => item.type === type)?.value ?? 0);
    const local = Date.UTC(
        part('year'),
        part('month') - 1,
        part('day'),
        part('hour'),
        part('minute'),
    );
    const minutes = Math.round((local - noon) / MINUTE);
    const abs = Math.abs(minutes);
    const pad = (value: number): string => String(value).padStart(2, '0');

    return `${minutes < 0 ? '-' : '+'}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const dateParts = (): Intl.DateTimeFormat =>
    officeDateFormat(LOCALE, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

const longDateParts = (): Intl.DateTimeFormat =>
    officeDateFormat(LOCALE, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

const timeParts = (): Intl.DateTimeFormat =>
    officeDateFormat(LOCALE, {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });

// en-CA yields an ISO-like "YYYY-MM-DD", used only to compute calendar days.
const calendarDay = (): Intl.DateTimeFormat =>
    officeDateFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
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
    const parts = dateParts().formatToParts(date);

    return `${part(parts, 'weekday')}, ${part(parts, 'day')} ${part(parts, 'month')} ${part(parts, 'year')}`;
}

/** "Senin, 5 Oktober 2026" in the office timezone (kiosk, page headers). */
export function formatLongDate(value: DateInput | null | undefined): string {
    const date = toDate(value);

    if (!date) {
        return EMPTY;
    }

    const parts = longDateParts().formatToParts(date);

    return `${part(parts, 'weekday')}, ${part(parts, 'day')} ${part(parts, 'month')} ${part(parts, 'year')}`;
}

const WEEKDAYS = [
    'Minggu',
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
] as const;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Calendar day "YYYY-MM-DD" of a value. A date-only string is taken as is
 * (a pure calendar date, never shifted by a timezone); timestamps are
 * converted to the office timezone first.
 */
export function toIsoDay(value: DateInput | null | undefined): string | null {
    if (typeof value === 'string' && ISO_DAY.test(value)) {
        return value;
    }

    const date = toDate(value);

    return date ? calendarDay().format(date) : null;
}

function isoDayParts(
    value: DateInput | null | undefined,
): { year: number; month: number; day: number } | null {
    const iso = toIsoDay(value);
    const match = iso ? ISO_DAY.exec(iso) : null;

    if (!match) {
        return null;
    }

    const [year, month, day] = match.slice(1).map(Number);
    const check = new Date(Date.UTC(year, month - 1, day));

    if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() !== month - 1 ||
        check.getUTCDate() !== day
    ) {
        return null;
    }

    return { year, month, day };
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** "30/10/2026" (day/month/year), the editable form of a date field. */
export function formatNumericDate(value: DateInput | null | undefined): string {
    const parts = isoDayParts(value);

    if (!parts) {
        return EMPTY;
    }

    return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

/**
 * "Senin, 30/10/2026": how a date field shows its value (owner decision,
 * Okt 2026), independent of the browser language. Date-only strings are pure
 * calendar dates; timestamps use the office timezone.
 */
export function formatDayDate(value: DateInput | null | undefined): string {
    const parts = isoDayParts(value);

    if (!parts) {
        return EMPTY;
    }

    const weekday =
        WEEKDAYS[
            new Date(
                Date.UTC(parts.year, parts.month - 1, parts.day),
            ).getUTCDay()
        ];

    return `${weekday}, ${formatNumericDate(value)}`;
}

/** "08.05" (24-hour clock, dot separator) in the office timezone. */
export function formatTime(value: DateInput | null | undefined): string {
    const date = toDate(value);

    if (!date) {
        return EMPTY;
    }

    const parts = timeParts().formatToParts(date);

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
    const [year, month, day] = calendarDay()
        .format(date)
        .split('-')
        .map(Number);

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
