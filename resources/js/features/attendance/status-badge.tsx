import { Badge } from '@/components/ui/badge';
import { statusLabel, statusTone } from '@/lib/attendance';
import { cn } from '@/lib/utils';
import type { AttendanceDayData, AttendanceStatus } from '@/types/attendance';

type Props = {
    status: AttendanceStatus;
    minutes?: number;
    compact?: boolean;
    /** `sm`: 30px table pill (DAbsensi "Riwayat"); `md`: 32px status pill. */
    size?: 'sm' | 'md';
    className?: string;
};

/**
 * Attendance status pill: dot + text, never colour alone (Arus
 * `Badge variant="status"`, DAbsensi "Riwayat 7 hari kerja").
 */
export function StatusBadge({
    status,
    minutes = 0,
    compact = false,
    size = 'sm',
    className,
}: Props) {
    return (
        <Badge
            variant="status"
            tone={statusTone(status)}
            dot
            className={cn(size === 'sm' && 'h-[30px] gap-1.5 px-3', className)}
        >
            {statusLabel(status, minutes, compact)}
        </Badge>
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
