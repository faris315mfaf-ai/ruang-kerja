/**
 * Request (pengajuan) display helpers. Dates are shown in the office timezone.
 */
import {
    OFFICE_TIMEZONE,
    formatNumber,
    formatTime,
    toDate,
} from '@/lib/format';
import type { DateInput } from '@/lib/format';
import type {
    ApprovalStatus,
    LeaveTypeInfo,
    RequestCategory,
    RequestItem,
    RequestStatus,
} from '@/types/requests';

const MONTHS = [
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

const LONG_MONTHS = [
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

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const LONG_WEEKDAYS = [
    'Minggu',
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
];

const isoDay = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: OFFICE_TIMEZONE,
});

export type DayParts = {
    year: number;
    month: number;
    day: number;
    weekday: number;
    iso: string;
};

/** Calendar parts of an instant (or a "YYYY-MM-DD" date) in the office timezone. */
export function officeDay(value: DateInput): DayParts | null {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number);
        const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

        return { year, month, day, weekday, iso: value };
    }

    const date = toDate(value);

    if (!date) {
        return null;
    }

    return officeDay(isoDay.format(date));
}

/** "12 Okt 2026". */
export function formatShortDate(value: DateInput | null | undefined): string {
    const day = value === null || value === undefined ? null : officeDay(value);

    return day ? `${day.day} ${MONTHS[day.month - 1]} ${day.year}` : '–';
}

/** "Oktober 2026". */
export function formatMonthYear(year: number, month: number): string {
    return `${LONG_MONTHS[month - 1]} ${year}`;
}

/** "12–14 Okt 2026", "28 Sep – 2 Okt 2026", "3 Jul 2026". */
export function formatDateRange(start: DateInput, end: DateInput): string {
    const a = officeDay(start);
    const b = officeDay(end);

    if (!a || !b) {
        return '–';
    }

    if (a.iso === b.iso) {
        return `${a.day} ${MONTHS[a.month - 1]} ${a.year}`;
    }

    if (a.year === b.year && a.month === b.month) {
        return `${a.day}–${b.day} ${MONTHS[b.month - 1]} ${b.year}`;
    }

    if (a.year === b.year) {
        return `${a.day} ${MONTHS[a.month - 1]} – ${b.day} ${MONTHS[b.month - 1]} ${b.year}`;
    }

    return `${formatShortDate(a.iso)} – ${formatShortDate(b.iso)}`;
}

/** "Senin–Rabu, 12–14 Okt 2026". */
export function formatLongDateRange(start: DateInput, end: DateInput): string {
    const a = officeDay(start);
    const b = officeDay(end);

    if (!a || !b) {
        return '–';
    }

    const days =
        a.iso === b.iso
            ? LONG_WEEKDAYS[a.weekday]
            : `${LONG_WEEKDAYS[a.weekday]}–${LONG_WEEKDAYS[b.weekday]}`;

    return `${days}, ${formatDateRange(start, end)}`;
}

/** "Sen" for a "YYYY-MM-DD" date. */
export function weekdayShort(iso: string): string {
    const day = officeDay(iso);

    return day ? WEEKDAYS[day.weekday] : '';
}

/** Days with one decimal at most: 3 → "3", 0.5 → "0,5". */
export function formatDays(days: number | null | undefined): string {
    return formatNumber(
        days === null || days === undefined ? null : Math.round(days * 10) / 10,
    );
}

/** 210 → "3,5 jam". */
export function formatHours(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) {
        return '–';
    }

    return `${formatNumber(Math.round((minutes / 60) * 10) / 10)} jam`;
}

function hhmm(value: string | null | undefined): string | null {
    return value ? value.slice(0, 5).replace(':', '.') : null;
}

/** "12–14 Okt 2026", "18 Sep · 14.00–16.00", "2 Okt 2026 · check-out 17.10". */
export function formatRequestPeriod(
    item: Pick<
        RequestItem,
        'type' | 'start_at' | 'end_at' | 'minutes' | 'payload'
    >,
): string {
    const category = item.type.category;

    if (category === 'correction') {
        const parts = [formatShortDate(item.payload.date ?? item.start_at)];
        const checkIn = hhmm(item.payload.check_in);
        const checkOut = hhmm(item.payload.check_out);

        if (checkIn) {
            parts.push(`check-in ${checkIn}`);
        }

        if (checkOut) {
            parts.push(`check-out ${checkOut}`);
        }

        return parts.join(' · ');
    }

    if (item.minutes !== null) {
        const day = officeDay(item.start_at);
        const date = day ? `${day.day} ${MONTHS[day.month - 1]}` : '–';

        return `${date} · ${formatTime(item.start_at)}–${formatTime(item.end_at)}`;
    }

    return formatDateRange(item.start_at, item.end_at);
}

/** Unit of a whole-day duration: "hari kalender", "hari kerja" (leave) or "hari". */
export function dayUnit(
    type: Pick<LeaveTypeInfo, 'category' | 'counts_calendar_days'>,
): string {
    if (type.counts_calendar_days) {
        return 'hari kalender';
    }

    return type.category === 'leave' ? 'hari kerja' : 'hari';
}

/** "3 hari kerja", "1 hari", "2 jam", "—" (corrections). */
export function formatRequestDuration(
    item: Pick<RequestItem, 'type' | 'days' | 'minutes'>,
): string {
    if (item.minutes !== null) {
        return formatHours(item.minutes);
    }

    if (item.days !== null) {
        return `${formatDays(item.days)} ${dayUnit(item.type)}`;
    }

    return '—';
}

/** Tinted pill per category (token colors only). */
export const categoryClass: Record<RequestCategory, string> = {
    leave: 'bg-info/10 text-info',
    permit: 'bg-accent-blue/10 text-info',
    sick: 'bg-brand-500/10 text-primary',
    overtime: 'bg-warning/10 text-warning',
    correction: 'bg-surface-2 text-text-muted',
    business_trip: 'bg-success/10 text-success',
};

export type Tone = 'warning' | 'success' | 'danger' | 'muted' | 'info';

export const statusTone: Record<RequestStatus, Tone> = {
    draft: 'muted',
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    revision_requested: 'info',
    canceled: 'muted',
};

export const approvalTone: Record<ApprovalStatus, Tone> = {
    queued: 'muted',
    waiting: 'warning',
    approved: 'success',
    rejected: 'danger',
    revision_requested: 'info',
    skipped: 'muted',
};

export const toneClass: Record<Tone, { pill: string; dot: string }> = {
    warning: { pill: 'bg-warning/10 text-warning', dot: 'bg-warning' },
    success: { pill: 'bg-success/10 text-success', dot: 'bg-success' },
    danger: { pill: 'bg-danger/10 text-danger', dot: 'bg-danger' },
    info: { pill: 'bg-info/10 text-info', dot: 'bg-info' },
    muted: { pill: 'bg-surface-2 text-text-muted', dot: 'bg-text-subtle' },
};

/** "1 dari 2" step position, or null when not waiting. */
export function stepProgress(
    item: Pick<RequestItem, 'step_position' | 'step_count'>,
): string | null {
    return item.step_position === null
        ? null
        : `${item.step_position} dari ${item.step_count}`;
}

/** Days from the request's working dates that fall in a (year, month). */
export function datesInMonth(
    dates: string[],
    year: number,
    month: number,
): Set<number> {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;

    return new Set(
        dates
            .filter((d) => d.startsWith(prefix))
            .map((d) => Number(d.slice(8, 10))),
    );
}

/** "Nadia Putri juga cuti pada 13 Okt" (first colleague) + others count. */
export function colleagueSummary(
    people: { name: string; dates: string[] }[],
): string | null {
    const first = people[0];

    if (!first) {
        return null;
    }

    const dates = first.dates.slice(0, 3).map((iso) => {
        const day = officeDay(iso);

        return day ? `${day.day} ${MONTHS[day.month - 1]}` : iso;
    });
    const more = first.dates.length > 3 ? ` (+${first.dates.length - 3})` : '';
    const others = people.length > 1 ? ` dan ${people.length - 1} lainnya` : '';

    return `${first.name}${others} juga tidak masuk pada ${dates.join(', ')}${more}`;
}
