import {
    TONE_CLASSES,
    checkInTiming,
    formatDurationShort,
    minutesBetween,
    statusLabel,
} from '@/lib/attendance';
import type { StatusTone } from '@/lib/attendance';
import { formatTime, toDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TodayAttendance } from '@/types/attendance';

export type Pill = { label: string; tone: StatusTone };

/** Status chip above the clock ("Sudah check-in", "Selesai hari ini"). */
export function statusPill(today: TodayAttendance): Pill {
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
                tone: 'info',
            };
        case 'done':
            return { label: 'Selesai hari ini', tone: 'success' };
        case 'unavailable':
            return { label: day?.statusLabel ?? 'Tidak masuk', tone: 'info' };
    }
}

/** "Shift Reguler 08.00–17.00 · Kantor Pusat" (DAbsensi subtitle). */
export function scheduleLine(today: TodayAttendance): string {
    const { schedule, locations } = today;

    if (schedule.isHoliday) {
        return schedule.holidayName
            ? `Libur · ${schedule.holidayName}`
            : 'Hari libur';
    }

    if (!schedule.isWorkday || !schedule.start || !schedule.end) {
        return 'Tidak ada jadwal hari ini';
    }

    const place =
        schedule.workMode === 'wfh' || schedule.workMode === 'field'
            ? schedule.workModeLabel
            : locations.length === 1
              ? locations[0].name
              : null;

    return [
        `Shift ${schedule.shiftName ?? ''} ${formatTime(schedule.start)}–${formatTime(schedule.end)}`,
        place,
    ]
        .filter(Boolean)
        .join(' · ');
}

/** Timing hint before checking in ("8 menit sebelum jam masuk"). */
export function timingHint(
    today: TodayAttendance,
    now: Date,
): { text: string; tone: StatusTone } | null {
    // A company-hours refusal replaces the timing hint (shown as a notice).
    if (today.action !== 'check_in' || today.checkInBlocked) {
        return null;
    }

    const timing = checkInTiming(today.schedule, now);

    return timing.text ? { text: timing.text, tone: timing.tone } : null;
}

export type DayTile = {
    label: string;
    value: string;
    note: string;
    tone: StatusTone;
};

/** Masuk · Pulang · Durasi kerja tiles of the check-in card (DAbsensi). */
export function dayTiles(today: TodayAttendance, now: Date): DayTile[] {
    const { day, schedule } = today;
    const checkIn: DayTile = day?.checkInAt
        ? {
              label: 'Masuk',
              value: formatTime(day.checkInAt),
              note:
                  day.lateMinutes > 0
                      ? `Terlambat ${day.lateMinutes} mnt`
                      : day.status === 'wfh'
                        ? 'WFH'
                        : 'Tepat waktu',
              tone: day.lateMinutes > 0 ? 'warning' : 'success',
          }
        : {
              label: 'Masuk',
              value: schedule.start ? formatTime(schedule.start) : '–',
              note: schedule.start ? 'Terjadwal' : 'Tidak ada jadwal',
              tone: 'neutral',
          };
    const checkOut: DayTile = day?.checkOutAt
        ? {
              label: 'Pulang',
              value: formatTime(day.checkOutAt),
              note:
                  day.earlyLeaveMinutes > 0
                      ? `Pulang cepat ${day.earlyLeaveMinutes} mnt`
                      : 'Tercatat',
              tone: day.earlyLeaveMinutes > 0 ? 'warning' : 'neutral',
          }
        : {
              label: 'Pulang',
              value: schedule.end ? formatTime(schedule.end) : '–',
              note: schedule.end ? 'Terjadwal' : 'Tidak ada jadwal',
              tone: 'neutral',
          };
    const started = toDate(day?.checkInAt ?? null);
    const duration: DayTile = day?.checkOutAt
        ? {
              label: 'Durasi kerja',
              value: formatDurationShort(day.workMinutes),
              note: 'Total hari ini',
              tone: 'neutral',
          }
        : started
          ? {
                label: 'Durasi kerja',
                value: formatDurationShort(minutesBetween(started, now)),
                note: 'Berjalan',
                tone: 'neutral',
            }
          : {
                label: 'Durasi kerja',
                value: '–',
                note: 'Belum mulai',
                tone: 'neutral',
            };

    return [checkIn, checkOut, duration];
}

/** Grey 16px-radius tiles (DAbsensi "Masuk 07.41 · Tepat waktu"). */
export function DayTiles({
    today,
    now,
    className,
    tileClassName = 'bg-background',
}: {
    today: TodayAttendance;
    now: Date;
    className?: string;
    /** Tile surface: grey inside a card, bordered card on the page (phone). */
    tileClassName?: string;
}) {
    return (
        <dl className={cn('grid grid-cols-3 gap-2 md:gap-3', className)}>
            {dayTiles(today, now).map((tile) => (
                <div
                    key={tile.label}
                    className={cn(
                        'flex min-w-0 flex-col gap-1 rounded-lg px-3 py-3 md:px-[18px] md:py-4',
                        tileClassName,
                    )}
                >
                    <dt className="truncate text-meta text-text-muted md:text-[15px]">
                        {tile.label}
                    </dt>
                    <dd className="truncate text-[20px] leading-7 font-bold text-text tnum md:text-[26px] md:leading-8">
                        {tile.value}
                    </dd>
                    <dd
                        className={cn(
                            'truncate text-meta font-semibold md:text-[15px]',
                            tile.tone === 'neutral'
                                ? 'text-text-muted'
                                : TONE_CLASSES[tile.tone].text,
                        )}
                    >
                        {tile.note}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
