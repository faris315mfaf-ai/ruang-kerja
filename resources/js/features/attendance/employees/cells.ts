import { formatRupiah } from '@/lib/requests';
import type { CellCode, GridCell, SettableStatus } from './types';

/**
 * Grid cell look per code (mockup Main.dc.html): letter, label and token
 * classes. Status is never colour alone: every cell has a letter or an
 * aria-label/tooltip naming it.
 */
export type CellStyle = {
    letter: string;
    label: string;
    className: string;
};

const SUCCESS = 'bg-success-soft text-success';
const WARNING = 'bg-warning-soft text-warning';
const DANGER = 'bg-danger-soft text-danger';
const INFO = 'bg-info-soft text-info';
const LINK = 'bg-link-soft text-link';

export const CELL_STYLES: Record<CellCode, CellStyle> = {
    present: { letter: 'H', label: 'Hadir', className: SUCCESS },
    late: { letter: 'T', label: 'Terlambat', className: WARNING },
    early_leave: { letter: 'P', label: 'Pulang cepat', className: WARNING },
    absent: { letter: 'A', label: 'Alpha', className: DANGER },
    permit: { letter: 'I', label: 'Izin', className: INFO },
    sick: { letter: 'S', label: 'Sakit', className: INFO },
    leave: { letter: 'C', label: 'Cuti', className: INFO },
    business_trip: { letter: 'D', label: 'Dinas', className: LINK },
    wfh: { letter: 'W', label: 'WFH', className: LINK },
    needs_correction: {
        letter: '!',
        label: 'Perlu koreksi',
        className:
            'bg-surface text-warning ring-2 ring-inset ring-fill-warning',
    },
    holiday: {
        letter: '',
        label: 'Libur',
        className: 'bg-surface-2 text-text-subtle',
    },
    off: {
        letter: '',
        label: 'Tidak terjadwal',
        className: 'bg-surface-2/60 text-text-subtle',
    },
    not_checked_in: {
        letter: '·',
        label: 'Belum check-in',
        className:
            'bg-surface text-text-muted ring-[1.5px] ring-inset ring-border-strong',
    },
    none: {
        letter: '?',
        label: 'Tanpa catatan',
        className:
            'bg-surface text-danger ring-[1.5px] ring-inset ring-border-strong',
    },
    future: {
        letter: '',
        label: 'Belum terjadi',
        className: 'bg-transparent text-text-subtle',
    },
};

/** Legend under the grid (mockup order). */
export const LEGEND: CellCode[] = [
    'present',
    'late',
    'wfh',
    'business_trip',
    'permit',
    'sick',
    'leave',
    'absent',
    'needs_correction',
    'not_checked_in',
    'none',
    'holiday',
];

export function cellStyle(code: string): CellStyle {
    return CELL_STYLES[code as CellCode] ?? CELL_STYLES.off;
}

const MONTHS_SHORT = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
];

/** "8 Okt" of a "YYYY-MM-DD" calendar date. */
export function shortDate(date: string): string {
    const [, month, day] = date.split('-').map(Number);

    return `${day} ${MONTHS_SHORT[month - 1] ?? ''}`;
}

/** "Rizky Ananda, 8 Okt: Alpha · manual" (button name of a grid cell). */
export function cellAriaLabel(name: string, cell: GridCell): string {
    const parts = [cellStyle(cell.code).label];
    const times = cellTimes(cell);

    if (times) {
        parts.push(times);
    }

    if (cell.manual) {
        parts.push('diatur HR');
    }

    return `${name}, ${shortDate(cell.date)}: ${parts.join(' · ')}`;
}

/** "08.02–17.05", "08.02–" or null. */
export function cellTimes(
    cell: Pick<GridCell, 'check_in' | 'check_out'>,
): string | null {
    if (cell.check_in === null && cell.check_out === null) {
        return null;
    }

    return `${cell.check_in ?? '?'}–${cell.check_out ?? ''}`;
}

const WEEKDAY_LETTERS = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];
const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function weekdayIndex(date: string): number {
    const [year, month, day] = date.split('-').map(Number);

    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Day header: weekday letter (M S S R K J S), day number, weekend flag. */
export function dayHeader(date: string): {
    letter: string;
    short: string;
    day: number;
    weekend: boolean;
} {
    const index = weekdayIndex(date);

    return {
        letter: WEEKDAY_LETTERS[index],
        short: WEEKDAY_SHORT[index],
        day: Number(date.slice(8, 10)),
        weekend: index === 0 || index === 6,
    };
}

/** Status options of the editor, in mockup order (H T W D I S C A L). */
export const STATUS_OPTIONS: { value: SettableStatus; code: CellCode }[] = [
    { value: 'present', code: 'present' },
    { value: 'late', code: 'late' },
    { value: 'wfh', code: 'wfh' },
    { value: 'business_trip', code: 'business_trip' },
    { value: 'permit', code: 'permit' },
    { value: 'sick', code: 'sick' },
    { value: 'leave', code: 'leave' },
    { value: 'absent', code: 'absent' },
    { value: 'holiday', code: 'holiday' },
];

const ATTENDED: SettableStatus[] = ['present', 'late', 'wfh', 'business_trip'];

/** Check-in/out times only mean something for these statuses. */
export function isAttended(status: string | null): boolean {
    return status !== null && (ATTENDED as string[]).includes(status);
}

export function isSettable(status: string | null): status is SettableStatus {
    return STATUS_OPTIONS.some((option) => option.value === status);
}

/** "08.05" (grid/detail) → "08:05" for `<input type="time">`. */
export function toTimeInput(value: string | null): string {
    return value ? value.replace('.', ':') : '';
}

/**
 * Expected effect on gaji harian once the chosen status is saved. Cuti,
 * Sakit and Izin follow the company rules (not on this page), so the hint
 * names the rule instead of guessing.
 */
export function wageHint(
    status: SettableStatus,
    dailyWage: number | null,
): string {
    const amount = dailyWage === null ? '' : ` (${formatRupiah(dailyWage)})`;

    switch (status) {
        case 'present':
        case 'late':
        case 'wfh':
        case 'business_trip':
            return `dibayar 1 hari${amount}`;
        case 'absent':
            return 'tidak dibayar';
        case 'holiday':
            return 'bukan hari kerja, tidak dihitung';
        default:
            return `mengikuti aturan gaji untuk ${cellStyle(status).label.toLowerCase()}`;
    }
}

/**
 * Seven dates for the mobile week strip: centred on `selected`, clamped to
 * the month [start, end] (a month always has ≥ 28 days).
 */
export function weekStripDates(
    selected: string,
    start: string,
    end: string,
): string[] {
    const toUtc = (date: string) => {
        const [year, month, day] = date.split('-').map(Number);

        return Date.UTC(year, month - 1, day);
    };
    const toIso = (time: number) => new Date(time).toISOString().slice(0, 10);
    const DAY = 86_400_000;
    const first = toUtc(start);
    const last = toUtc(end);
    let from = Math.max(first, toUtc(selected) - 3 * DAY);

    if (from + 6 * DAY > last) {
        from = Math.max(first, last - 6 * DAY);
    }

    return Array.from({ length: 7 }, (_, index) => from + index * DAY)
        .filter((time) => time <= last)
        .map(toIso);
}

/** Mobile chips for one date: all, not in yet, late, Alpha. */
export type DayFilter = 'all' | 'missing' | 'late' | 'absent';

export function matchesDayFilter(code: CellCode, filter: DayFilter): boolean {
    switch (filter) {
        case 'missing':
            return code === 'not_checked_in' || code === 'none';
        case 'late':
            return code === 'late';
        case 'absent':
            return code === 'absent';
        default:
            return true;
    }
}

/** Every date "YYYY-MM-DD" from `start` to `end` inclusive. */
export function monthDates(start: string, end: string): string[] {
    const dates: string[] = [];
    const [year, month, day] = start.split('-').map(Number);
    const cursor = new Date(Date.UTC(year, month - 1, day));

    for (let guard = 0; guard < 62; guard++) {
        const iso = cursor.toISOString().slice(0, 10);

        if (iso > end) {
            break;
        }

        dates.push(iso);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return dates;
}

/** Date the page opens on: today inside the month, else its last counted day. */
export function defaultDate(
    today: string | null,
    period: { start: string; end: string; countedUntil: string | null },
): string {
    if (today !== null && today >= period.start && today <= period.end) {
        return today;
    }

    return period.countedUntil ?? period.end;
}
