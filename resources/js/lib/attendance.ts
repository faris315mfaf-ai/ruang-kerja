import type {
    AttendanceStatus,
    DaySchedule,
    WorkModeValue,
} from '@/types/attendance';
import { formatTime, toDate } from './format';

/** Visual tone of a status (docs/DESIGN.md §2 "Semantik"). */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STATUS: Record<AttendanceStatus, { label: string; tone: StatusTone }> = {
    present: { label: 'Hadir', tone: 'success' },
    late: { label: 'Terlambat', tone: 'warning' },
    early_leave: { label: 'Pulang cepat', tone: 'warning' },
    absent: { label: 'Alpha', tone: 'danger' },
    leave: { label: 'Cuti', tone: 'info' },
    permit: { label: 'Izin', tone: 'info' },
    sick: { label: 'Sakit', tone: 'info' },
    business_trip: { label: 'Dinas', tone: 'info' },
    holiday: { label: 'Libur', tone: 'neutral' },
    wfh: { label: 'WFH', tone: 'info' },
    needs_correction: { label: 'Perlu koreksi', tone: 'danger' },
};

export function statusTone(status: AttendanceStatus): StatusTone {
    return STATUS[status].tone;
}

/**
 * Badge text: "Hadir", "Terlambat 12m", "Pulang cepat 30m" (docs/DESIGN.md §6).
 * `compact` gives the short strip form "Telat 12m".
 */
export function statusLabel(
    status: AttendanceStatus,
    minutes = 0,
    compact = false,
): string {
    if (status === 'late' && minutes > 0) {
        return `${compact ? 'Telat' : 'Terlambat'} ${minutes}m`;
    }

    if (status === 'early_leave' && minutes > 0) {
        return `${compact ? 'Pulang' : 'Pulang cepat'} ${minutes}m`;
    }

    return STATUS[status].label;
}

/** Token classes per tone: soft background, text, and a solid dot/bar. */
export const TONE_CLASSES: Record<
    StatusTone,
    { soft: string; text: string; solid: string }
> = {
    success: {
        soft: 'bg-success-soft text-success',
        text: 'text-success',
        solid: 'bg-success',
    },
    warning: {
        soft: 'bg-warning-soft text-warning',
        text: 'text-warning',
        solid: 'bg-warning',
    },
    danger: {
        soft: 'bg-danger-soft text-danger',
        text: 'text-danger',
        solid: 'bg-danger',
    },
    info: {
        soft: 'bg-info-soft text-info',
        text: 'text-info',
        solid: 'bg-info',
    },
    neutral: {
        soft: 'bg-surface-2 text-text-muted',
        text: 'text-text-muted',
        solid: 'bg-text-subtle',
    },
};

const MINUTE = 60_000;

/** Whole minutes from `from` to `to` (negative when `to` is earlier). */
export function minutesBetween(from: Date, to: Date): number {
    return Math.trunc((to.getTime() - from.getTime()) / MINUTE);
}

/** "45 menit", "1 jam", "8 jam 13 menit". */
export function formatDuration(totalMinutes: number): string {
    const minutes = Math.max(0, Math.round(totalMinutes));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    if (hours === 0) {
        return `${rest} menit`;
    }

    return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} menit`;
}

export type Timing = {
    text: string;
    tone: StatusTone;
    /** Check-in is not open yet (before the window). */
    tooEarly: boolean;
};

/**
 * One-line hint under the schedule on the check-in card, before checking in:
 * "8 menit sebelum jam masuk", "Lewat 12 menit dari batas toleransi",
 * "Check-in dibuka pukul 06.00", "Hari libur: …".
 */
export function checkInTiming(schedule: DaySchedule, now: Date): Timing {
    if (schedule.isHoliday) {
        return {
            text: `Hari libur${schedule.holidayName ? `: ${schedule.holidayName}` : ''}. Check-in tetap bisa dicatat.`,
            tone: 'neutral',
            tooEarly: false,
        };
    }

    const start = toDate(schedule.start);
    const opens = toDate(schedule.checkInOpensAt);
    const threshold = toDate(schedule.lateThreshold);

    if (!schedule.isWorkday || !start) {
        return {
            text: 'Tidak ada jadwal hari ini. Check-in tetap bisa dicatat.',
            tone: 'neutral',
            tooEarly: false,
        };
    }

    if (opens && now < opens) {
        return {
            text: `Check-in dibuka pukul ${formatTime(opens)}`,
            tone: 'neutral',
            tooEarly: true,
        };
    }

    if (now < start) {
        const minutes = Math.max(
            1,
            Math.ceil((start.getTime() - now.getTime()) / MINUTE),
        );

        return {
            text: `${minutes} menit sebelum jam masuk`,
            tone: 'success',
            tooEarly: false,
        };
    }

    if (threshold && now <= threshold) {
        return {
            text: `Masih dalam toleransi sampai ${formatTime(threshold)}`,
            tone: 'success',
            tooEarly: false,
        };
    }

    const late = threshold ? minutesBetween(threshold, now) : 0;

    return {
        text: `Lewat ${formatDuration(late)} dari batas toleransi ${threshold ? formatTime(threshold) : ''}`.trim(),
        tone: 'warning',
        tooEarly: false,
    };
}

const WORK_MODE_LABELS: Record<WorkModeValue, string> = {
    office: 'Kantor',
    hybrid: 'Hybrid',
    wfh: 'WFH',
    field: 'Lapangan',
};

export function workModeLabel(mode: WorkModeValue): string {
    return WORK_MODE_LABELS[mode];
}

/** ISO weekdays 1 = Senin … 7 = Minggu. */
export const WEEKDAYS: { value: number; short: string; long: string }[] = [
    { value: 1, short: 'Sen', long: 'Senin' },
    { value: 2, short: 'Sel', long: 'Selasa' },
    { value: 3, short: 'Rab', long: 'Rabu' },
    { value: 4, short: 'Kam', long: 'Kamis' },
    { value: 5, short: 'Jum', long: 'Jumat' },
    { value: 6, short: 'Sab', long: 'Sabtu' },
    { value: 7, short: 'Min', long: 'Minggu' },
];

/** [1..5] → "Sen–Jum", [1, 3, 5] → "Sen, Rab, Jum" (mirrors App\Domain\Attendance\Support\Weekdays). */
export function weekdaysLabel(days: readonly number[]): string {
    const sorted = [...new Set(days)]
        .filter((d) => d >= 1 && d <= 7)
        .sort((a, b) => a - b);

    if (sorted.length === 0) {
        return '–';
    }

    if (sorted.length === 7) {
        return 'Setiap hari';
    }

    const short = (day: number) => WEEKDAYS[day - 1].short;
    const isRange =
        sorted.length >= 3 &&
        sorted[sorted.length - 1] - sorted[0] === sorted.length - 1;

    return isRange
        ? `${short(sorted[0])}–${short(sorted[sorted.length - 1])}`
        : sorted.map(short).join(', ');
}

/** "Sen 28" for compact day strips, in the office timezone. */
export function shortDay(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const names = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    return `${names[weekday]} ${day}`;
}

/**
 * Private Echo channels (without `private-`) of the live attendance board
 * (routes/channels.php): the viewer's own company feed for attendance.view_all,
 * else one feed per led division. No company id → no company channel.
 */
export function attendanceChannelNames(
    channels: { company: boolean; divisions: readonly string[] },
    companyId: string | null | undefined,
): string[] {
    if (channels.company) {
        return companyId ? [`company.${companyId}.attendance`] : [];
    }

    return channels.divisions.map((id) => `division.${id}.attendance`);
}
