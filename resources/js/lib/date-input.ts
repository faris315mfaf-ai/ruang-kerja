/**
 * Pure logic behind `components/ui/date-input.tsx` (parsing what a user types
 * into a date field, range checks, day stepping). Values are always calendar
 * dates "YYYY-MM-DD" (what the server receives); no timezone is involved.
 */

import { formatDayDate } from './format';

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** d/m/yyyy with "/", "-", "." or spaces as separators. */
const SEPARATED = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/;

/** ddmmyyyy (phone numeric keypads have no "/"). */
const COMPACT = /^(\d{2})(\d{2})(\d{4})$/;

const pad2 = (value: number): string => String(value).padStart(2, '0');

function toIso(year: number, month: number, day: number): string | null {
    if (year < 1000 || month < 1 || month > 12 || day < 1) {
        return null;
    }

    const date = new Date(Date.UTC(year, month - 1, day));

    // Rejects 31/02, 29/02 in non-leap years, etc. (Date rolls them over.)
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }

    return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** True for a real calendar date written as "YYYY-MM-DD". */
export function isIsoDay(value: string | null | undefined): value is string {
    const match = value ? ISO_DAY.exec(value) : null;

    return (
        match !== null &&
        toIso(Number(match[1]), Number(match[2]), Number(match[3])) === value
    );
}

/**
 * Parses typed text into "YYYY-MM-DD". Accepts "30/10/2026", "3/1/2026",
 * "30-10-2026", "30.10.2026", "30 10 2026", "30102026" and an ISO
 * "2026-10-30" (pasted). Day comes first; the year must have four digits.
 * Returns '' for blank input and null when the text is not a real date.
 */
export function parseDateInput(text: string): string | null {
    const value = text.trim();

    if (value === '') {
        return '';
    }

    if (isIsoDay(value)) {
        return value;
    }

    const match = SEPARATED.exec(value) ?? COMPACT.exec(value);

    if (!match) {
        return null;
    }

    return toIso(Number(match[3]), Number(match[2]), Number(match[1]));
}

export type DateRangeError = 'before_min' | 'after_max';

/** Where `value` falls outside [min, max] (ISO strings compare as dates). */
export function dateRangeError(
    value: string,
    min?: string | null,
    max?: string | null,
): DateRangeError | null {
    if (isIsoDay(min) && value < min) {
        return 'before_min';
    }

    if (isIsoDay(max) && value > max) {
        return 'after_max';
    }

    return null;
}

/** "YYYY-MM-DD" moved by `days` (negative = earlier). */
export function shiftIsoDay(value: string, days: number): string {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));

    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** Keeps a stepped date inside [min, max]. */
export function clampIsoDay(
    value: string,
    min?: string | null,
    max?: string | null,
): string {
    if (isIsoDay(min) && value < min) {
        return min;
    }

    if (isIsoDay(max) && value > max) {
        return max;
    }

    return value;
}

export type DateInputProblem = 'invalid' | 'required' | DateRangeError;

/**
 * Result of committing typed text: the new value, or the problem that makes
 * the field keep its previous value.
 */
export function resolveDateInput(
    text: string,
    options: {
        min?: string | null;
        max?: string | null;
        allowEmpty: boolean;
    },
): { value: string } | { problem: DateInputProblem } {
    const parsed = parseDateInput(text);

    if (parsed === null) {
        return { problem: 'invalid' };
    }

    if (parsed === '') {
        return options.allowEmpty ? { value: '' } : { problem: 'required' };
    }

    const range = dateRangeError(parsed, options.min, options.max);

    return range ? { problem: range } : { value: parsed };
}

/**
 * Light typing mask: after the user types the day or the month as two digits,
 * a "/" is added so phone numeric keypads (no "/" key) still produce
 * "dd/mm/yyyy". Deleting is never altered, and a "/" typed right after an
 * automatic one is not doubled.
 */
export function maskDateDraft(previous: string, next: string): string {
    if (next.length <= previous.length) {
        return next;
    }

    if (next.endsWith('//') && previous.endsWith('/')) {
        return previous;
    }

    if (/^\d{2}$/.test(next) || /^\d{1,2}\/\d{2}$/.test(next)) {
        return `${next}/`;
    }

    return next;
}

/** Short Indonesian message for a problem (shown under the field). */
export function dateInputMessage(
    problem: DateInputProblem,
    min?: string | null,
    max?: string | null,
): string {
    switch (problem) {
        case 'required':
            return 'Tanggal wajib diisi.';
        case 'before_min':
            return `Tanggal paling awal ${formatDayDate(min)}.`;
        case 'after_max':
            return `Tanggal paling lambat ${formatDayDate(max)}.`;
        default:
            return 'Tanggal tidak valid. Tulis dd/mm/yyyy, mis. 30/10/2026.';
    }
}
