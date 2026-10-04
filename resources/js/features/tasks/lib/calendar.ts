import { addDays, endOfWeek, startOfWeek } from './due-date';

/** First day of the month containing `date` ("YYYY-MM-01"). */
export function monthStart(date: string): string {
    return `${date.slice(0, 7)}-01`;
}

/** First day of the month `months` away from the month of `date`. */
export function addMonths(date: string, months: number): string {
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7)) - 1 + months;
    const normalized = new Date(Date.UTC(year, month, 1));

    return normalized.toISOString().slice(0, 10);
}

function monthEnd(date: string): string {
    return addDays(addMonths(date, 1), -1);
}

/** Monday-first weeks covering the whole month (4–6 rows of 7 days). */
export function monthGrid(date: string): string[][] {
    const first = startOfWeek(monthStart(date));
    const last = endOfWeek(monthEnd(date));
    const weeks: string[][] = [];

    for (let day = first; day <= last; day = addDays(day, 7)) {
        weeks.push(Array.from({ length: 7 }, (_, index) => addDays(day, index)));
    }

    return weeks;
}

/** Monday … Sunday of the week containing `date`. */
export function weekDays(date: string): string[] {
    const monday = startOfWeek(date);

    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function isSameMonth(a: string, b: string): boolean {
    return a.slice(0, 7) === b.slice(0, 7);
}

/** Groups items by due date; items without one are skipped. */
export function groupByDueDate<T extends { due_date: string | null }>(
    items: T[],
): Map<string, T[]> {
    const groups = new Map<string, T[]>();

    for (const item of items) {
        if (!item.due_date) {
            continue;
        }

        const list = groups.get(item.due_date) ?? [];
        list.push(item);
        groups.set(item.due_date, list);
    }

    return groups;
}

export const WEEKDAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
