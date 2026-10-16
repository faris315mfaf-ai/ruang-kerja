import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TodayAttendance } from '@/types/attendance';
import { windowsLine } from './windows';

/**
 * Why the main action is closed by the company "jam absen" right now: the
 * server's full sentence ("Absen masuk dibuka pukul 06.00 dan ditutup pukul
 * 12.00."). Renders nothing while the action is open.
 */
export function WindowNotice({
    notice,
    className,
}: {
    notice?: string;
    className?: string;
}) {
    if (!notice) {
        return null;
    }

    return (
        <p
            role="status"
            className={cn(
                'flex gap-2.5 rounded-lg bg-warning-soft p-3.5 text-[15px] leading-[22px] font-semibold text-warning',
                className,
            )}
        >
            <Clock
                className="mt-0.5 size-5 shrink-0"
                strokeWidth={1.9}
                aria-hidden
            />
            <span>{notice}</span>
        </p>
    );
}

/** Helper line with the configured hours ("Jam absen · masuk 06.00–12.00 …"). */
export function WindowsLine({
    today,
    className,
}: {
    today: TodayAttendance;
    className?: string;
}) {
    const line = windowsLine(today);

    return line ? (
        <p className={cn('text-[15px] text-text-muted', className)}>{line}</p>
    ) : null;
}
