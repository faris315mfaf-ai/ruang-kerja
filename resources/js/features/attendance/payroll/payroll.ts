import { formatDateTime, formatNumber, formatNumericDate } from '@/lib/format';
import type { PayrollReport, WageHistory } from './types';

/** "160.000" → 160000; "" → null. Anything but digits and dots is ignored. */
export function parseRupiahInput(text: string): number | null {
    const digits = text.replace(/\D/g, '');

    return digits === '' ? null : Number(digits);
}

/** 160000 → "160.000" for a Rupiah text field (prefix "Rp" sits outside). */
export function formatRupiahInput(value: number | null): string {
    return value === null ? '' : formatNumber(value);
}

/** "1,5 hari" / "12 hari". */
export function formatDays(value: number): string {
    return `${formatNumber(value)} hari`;
}

export type PeriodStatus = {
    label: string;
    tone: 'warning' | 'success' | 'neutral';
};

/** Pill next to the title: Draf · periode berjalan / Terkunci oleh … */
export function periodStatus(
    period: PayrollReport['period'],
    isRunning: boolean,
): PeriodStatus {
    if (period.locked) {
        const who = period.locked_by_name
            ? ` oleh ${period.locked_by_name}`
            : '';
        const when = period.locked_at
            ? `, ${formatDateTime(period.locked_at)}`
            : '';

        return { label: `Terkunci${who}${when}`, tone: 'success' };
    }

    return isRunning
        ? { label: 'Draf · periode berjalan', tone: 'warning' }
        : { label: 'Draf · belum dikunci', tone: 'neutral' };
}

/** Day before a "YYYY-MM-DD" date. */
function dayBefore(date: string): string {
    const [year, month, day] = date.split('-').map(Number);

    return new Date(Date.UTC(year, month - 1, day - 1))
        .toISOString()
        .slice(0, 10);
}

/**
 * Wage history rows (newest first) with their validity: the newest that
 * already started is "Berlaku"; older ones end the day before the next one.
 */
export function wageRanges(
    wages: WageHistory['wages'],
    today: string,
): {
    id: string;
    range: string;
    current: boolean;
    upcoming: boolean;
}[] {
    const sorted = [...wages].sort((a, b) =>
        b.effective_from.localeCompare(a.effective_from),
    );
    const currentId = sorted.find((wage) => wage.effective_from <= today)?.id;

    return sorted.map((wage, index) => {
        const next = sorted[index - 1];
        const from = formatNumericDate(wage.effective_from);

        return {
            id: wage.id,
            range: next
                ? `${from} – ${formatNumericDate(dayBefore(next.effective_from))}`
                : `Sejak ${from}`,
            current: wage.id === currentId,
            upcoming: wage.effective_from > today,
        };
    });
}

/** First day of the month after "YYYY-MM". */
export function nextMonthStart(month: string): string {
    const [year, mon] = month.split('-').map(Number);

    return new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 10);
}
