import type {
    BoardPersonState,
    RecapDayCell,
    RecapDayKind,
    RecapRow,
} from '@/types/attendance';
import { TONE_CLASSES } from './attendance';
import { OFFICE_TIMEZONE } from './format';
import type { StatusTone } from './attendance';

/**
 * Monthly recap helpers (mockups RekapAbsensi, MRiwayatAbsensi). Colour is
 * never the only signal: cells carry the day and a short label, the legend
 * names every colour (docs/DESIGN.md §1.5).
 */

/** Sick days use the brand colour so they differ from leave (blue). */
export type CalendarTone = StatusTone | 'brand';

const KIND_TONES: Record<RecapDayKind, CalendarTone> = {
    present: 'success',
    wfh: 'success',
    late: 'warning',
    early_leave: 'warning',
    absent: 'danger',
    needs_correction: 'danger',
    leave: 'info',
    permit: 'info',
    business_trip: 'info',
    sick: 'brand',
    holiday: 'neutral',
    off: 'neutral',
    upcoming: 'neutral',
    none: 'neutral',
};

export function kindTone(kind: RecapDayKind): CalendarTone {
    return KIND_TONES[kind];
}

export const CALENDAR_TONES: Record<
    CalendarTone,
    { soft: string; text: string; solid: string }
> = {
    ...TONE_CLASSES,
    brand: {
        soft: 'bg-primary/12 text-primary',
        text: 'text-primary',
        solid: 'bg-primary',
    },
};

/** Short label under the day number ("Sakit", "+11m", "Cuti"). */
export function cellLabel(cell: RecapDayCell): string | null {
    switch (cell.kind) {
        case 'late':
            return cell.lateMinutes > 0 ? `+${cell.lateMinutes}m` : 'Telat';
        case 'early_leave':
            return cell.earlyLeaveMinutes > 0
                ? `−${cell.earlyLeaveMinutes}m`
                : 'Pulang';
        case 'leave':
            return 'Cuti';
        case 'permit':
            return 'Izin';
        case 'sick':
            return 'Sakit';
        case 'business_trip':
            return 'Dinas';
        case 'absent':
            return 'Alpha';
        case 'needs_correction':
            return 'Koreksi';
        case 'wfh':
            return 'WFH';
        case 'holiday':
            return 'Libur';
        default:
            return null;
    }
}

/** ISO weekday (1 = Senin … 7 = Minggu) of a "YYYY-MM-DD" date. */
export function isoWeekday(date: string): number {
    const [year, month, day] = date.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    return weekday === 0 ? 7 : weekday;
}

/** Monday-first weeks with empty leading/trailing slots. */
export function calendarWeeks(days: RecapDayCell[]): (RecapDayCell | null)[][] {
    if (days.length === 0) {
        return [];
    }

    const slots: (RecapDayCell | null)[] = [
        ...Array.from({ length: isoWeekday(days[0].date) - 1 }, () => null),
        ...days,
    ];

    while (slots.length % 7 !== 0) {
        slots.push(null);
    }

    const weeks: (RecapDayCell | null)[][] = [];

    for (let index = 0; index < slots.length; index += 7) {
        weeks.push(slots.slice(index, index + 7));
    }

    return weeks;
}

export type LegendItem = { label: string; count: number; tone: CalendarTone };

/** Legend of the calendar with the month's counts. */
export function legend(row: RecapRow): LegendItem[] {
    const onTime = Math.max(0, row.presentDays - row.lateCount);

    return [
        { label: 'Hadir', count: onTime, tone: 'success' },
        { label: 'Terlambat', count: row.lateCount, tone: 'warning' },
        {
            label: 'Cuti',
            count: row.leaveDays + row.permitDays + row.businessTripDays,
            tone: 'info',
        },
        { label: 'Sakit', count: row.sickDays, tone: 'brand' },
        { label: 'Alpha', count: row.absentDays, tone: 'danger' },
        { label: 'Libur/akhir pekan', count: row.offDays, tone: 'neutral' },
    ];
}

/** "4 · 46m" (count · total minutes), "0" when never late. */
export function lateSummary(count: number, minutes: number): string {
    return count === 0 ? '0' : `${count} · ${minutes}m`;
}

/** "1,5" hours with Indonesian decimal comma. */
export function formatHours(hours: number): string {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(
        hours,
    );
}

/** "September 2026" ↔ "2026-09" navigation. */
export function shiftMonth(month: string, delta: number): string {
    const [year, mon] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, mon - 1 + delta, 1));

    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Last 12 months (newest first) for the month picker, ending at `current`. */
export function recentMonths(current: string, count = 12): string[] {
    return Array.from({ length: count }, (_, index) =>
        shiftMonth(current, -index),
    );
}

/** "2026-10" of an instant in the office timezone. */
export function officeMonth(iso: string): string {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
        return '1970-01';
    }

    return new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        timeZone: OFFICE_TIMEZONE,
    })
        .format(date)
        .slice(0, 7);
}

const MONTHS = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
];

export function monthLabel(month: string): string {
    const [year, mon] = month.split('-').map(Number);

    return `${MONTHS[mon - 1] ?? ''} ${year}`;
}

/** Board person state → label and tone. */
export const BOARD_STATES: Record<
    BoardPersonState,
    { label: string; tone: StatusTone }
> = {
    on_time: { label: 'Hadir', tone: 'success' },
    late: { label: 'Terlambat', tone: 'warning' },
    leave: { label: 'Cuti/izin/sakit', tone: 'info' },
    not_checked_in: { label: 'Belum check-in', tone: 'neutral' },
    off: { label: 'Tidak terjadwal', tone: 'neutral' },
};
