import {
    TONE_CLASSES,
    checkInTiming,
    formatDuration,
    minutesBetween,
    statusLabel,
} from '@/lib/attendance';
import type { StatusTone } from '@/lib/attendance';
import { formatTime, toDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TodayAttendance } from '@/types/attendance';

type Pill = { label: string; tone: StatusTone };

function statusPill(today: TodayAttendance): Pill {
    const day = today.day;

    switch (today.action) {
        case 'check_in':
            return { label: 'Belum check-in', tone: 'neutral' };
        case 'check_out':
            if (day?.status === 'late') {
                return {
                    label: statusLabel('late', day.lateMinutes),
                    tone: 'warning',
                };
            }

            return {
                label:
                    day?.status === 'wfh'
                        ? 'Sudah check-in · WFH'
                        : 'Sudah check-in',
                tone: 'success',
            };
        case 'done':
            return { label: 'Sudah check-out', tone: 'success' };
        case 'unavailable':
            return { label: day?.statusLabel ?? 'Tidak masuk', tone: 'info' };
    }
}

export function scheduleLine(today: TodayAttendance): string {
    const { schedule } = today;

    if (schedule.isHoliday) {
        return schedule.holidayName
            ? `Libur · ${schedule.holidayName}`
            : 'Hari libur';
    }

    if (!schedule.isWorkday || !schedule.start || !schedule.end) {
        return 'Tidak ada jadwal hari ini';
    }

    const mode =
        schedule.workMode === 'wfh' || schedule.workMode === 'field'
            ? ` · ${schedule.workModeLabel}`
            : '';

    return `Shift ${schedule.shiftName ?? ''} · masuk ${formatTime(schedule.start)} · pulang ${formatTime(schedule.end)}${mode}`;
}

function detailLine(
    today: TodayAttendance,
    now: Date,
): { text: string; tone: StatusTone } {
    const day = today.day;

    if (today.action === 'check_in') {
        const timing = checkInTiming(today.schedule, now);

        return { text: timing.text, tone: timing.tone };
    }

    if (!day?.checkInAt) {
        return { text: '', tone: 'neutral' };
    }

    const place =
        day.checkIn?.locationName ??
        (day.checkIn?.method === 'wfh' ? 'WFH/lapangan' : null);
    const checkIn = `Masuk ${formatTime(day.checkInAt)}${place ? ` · ${place}` : ''}`;

    if (today.action === 'done' && day.checkOutAt) {
        return {
            text: `${checkIn} · pulang ${formatTime(day.checkOutAt)} · ${formatDuration(day.workMinutes)}`,
            tone: 'neutral',
        };
    }

    const start = toDate(day.checkInAt);
    const worked = start ? formatDuration(minutesBetween(start, now)) : '';

    return {
        text: `${checkIn} · ${worked} berjalan`,
        tone: day.status === 'late' ? 'warning' : 'success',
    };
}

type Props = {
    today: TodayAttendance;
    now: Date;
    className?: string;
};

/**
 * "Kartu Check-in" (docs/DESIGN.md §6): status, big mono clock, today's
 * schedule and a timing hint (mockup Absensi).
 */
export function CheckInCard({ today, now, className }: Props) {
    const pill = statusPill(today);
    const detail = detailLine(today, now);

    return (
        <section
            aria-label="Absensi hari ini"
            className={cn(
                'rounded-xl border border-border bg-surface p-4 shadow-card md:p-5',
                className,
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-text-muted">Jam sekarang</p>
                <span
                    className={cn(
                        'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium',
                        TONE_CLASSES[pill.tone].soft,
                    )}
                >
                    <span
                        aria-hidden
                        className={cn(
                            'size-1.5 rounded-full',
                            TONE_CLASSES[pill.tone].solid,
                        )}
                    />
                    {pill.label}
                </span>
            </div>
            <p
                className="mt-1 font-mono text-[56px] leading-none font-medium tracking-tight text-text tnum md:text-[64px]"
                aria-live="off"
            >
                <time dateTime={now.toISOString()}>{formatTime(now)}</time>
            </p>
            <p className="mt-4 text-[15px] text-text-muted">
                {scheduleLine(today)}
            </p>
            {detail.text !== '' && (
                <p
                    className={cn(
                        'mt-1 text-[15px]',
                        TONE_CLASSES[detail.tone].text,
                    )}
                >
                    {detail.text}
                </p>
            )}
        </section>
    );
}
