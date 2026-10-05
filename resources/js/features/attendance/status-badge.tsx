import { TONE_CLASSES, statusLabel, statusTone } from '@/lib/attendance';
import { cn } from '@/lib/utils';
import type { AttendanceDayData, AttendanceStatus } from '@/types/attendance';

type Props = {
    status: AttendanceStatus;
    minutes?: number;
    compact?: boolean;
    className?: string;
};

/** Dot + text, never colour alone (docs/DESIGN.md §1.5, §6 "Badge status absensi"). */
export function StatusBadge({
    status,
    minutes = 0,
    compact = false,
    className,
}: Props) {
    const tone = TONE_CLASSES[statusTone(status)];

    return (
        <span
            className={cn(
                'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap',
                tone.soft,
                className,
            )}
        >
            <span
                aria-hidden
                className={cn('size-1.5 rounded-full', tone.solid)}
            />
            {statusLabel(status, minutes, compact)}
        </span>
    );
}

/** Minutes relevant to the badge of a day (late or early leave). */
export function badgeMinutes(
    day: Pick<
        AttendanceDayData,
        'status' | 'lateMinutes' | 'earlyLeaveMinutes'
    >,
): number {
    if (day.status === 'late') {
        return day.lateMinutes;
    }

    return day.status === 'early_leave' ? day.earlyLeaveMinutes : 0;
}
