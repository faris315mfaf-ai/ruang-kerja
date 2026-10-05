import { Link, usePage } from '@inertiajs/react';
import { LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TONE_CLASSES } from '@/lib/attendance';
import { shellStatus } from '@/lib/check-in-status';
import { formatTime } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import { cn } from '@/lib/utils';
import { index as attendanceIndex } from '@/routes/attendance';
import { START_PARAM } from './use-attendance-page';

/**
 * "Absensi hari ini" card for the home screen (mockups MBeranda,
 * DashboardSaya), from the shared attendance status. Sprint 9 completes the
 * dashboard around it.
 */
export function TodayAttendanceCard({ className }: { className?: string }) {
    const { attendanceStatus: status } = usePage().props;

    if (!status) {
        return null;
    }

    const shell = shellStatus(status);
    const checkedIn = status.checkInAt !== null;

    return (
        <section
            aria-labelledby="today-attendance"
            className={cn(
                'rounded-xl border border-border bg-surface p-4 shadow-card',
                className,
            )}
        >
            <div className="flex items-baseline justify-between gap-3">
                <h2
                    id="today-attendance"
                    className="text-[15px] font-semibold text-text"
                >
                    Absensi hari ini
                </h2>
                <span className="truncate text-[13px] text-text-muted">
                    {[
                        status.shiftName ? `Shift ${status.shiftName}` : null,
                        status.locationName,
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                    <p className="text-sm text-text-muted">Check-in</p>
                    <p
                        className={cn(
                            'font-mono text-[28px] leading-9 font-medium tnum',
                            checkedIn
                                ? TONE_CLASSES[shell.tone].text
                                : 'text-text-subtle',
                        )}
                    >
                        {checkedIn ? formatTime(status.checkInAt) : '––.––'}
                    </p>
                    <span
                        className={cn(
                            'mt-1 inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium',
                            TONE_CLASSES[shell.tone].soft,
                        )}
                    >
                        <span
                            aria-hidden
                            className={cn(
                                'size-1.5 rounded-full',
                                TONE_CLASSES[shell.tone].solid,
                            )}
                        />
                        {shell.title}
                    </span>
                </div>
                <div>
                    <p className="text-sm text-text-muted">
                        {status.checkOutAt ? 'Check-out' : 'Jadwal pulang'}
                    </p>
                    <p className="font-mono text-[28px] leading-9 font-medium text-text tnum">
                        {status.checkOutAt
                            ? formatTime(status.checkOutAt)
                            : (status.endLabel ?? '–')}
                    </p>
                    {status.distanceM !== null && (
                        <p className="mt-1 text-[13px] text-text-muted">
                            {formatDistance(status.distanceM)} dari titik lokasi
                        </p>
                    )}
                </div>
            </div>
            {shell.button && (
                <Button
                    asChild
                    className="mt-4 h-11 w-full text-[15px]"
                    variant={
                        shell.button.label === 'Check-in'
                            ? 'default'
                            : 'outline'
                    }
                >
                    <Link
                        href={attendanceIndex({
                            query: { [START_PARAM]: '1' },
                        })}
                    >
                        {shell.button.label === 'Check-in' ? (
                            <LogIn aria-hidden />
                        ) : (
                            <LogOut aria-hidden />
                        )}
                        {shell.button.label}
                    </Link>
                </Button>
            )}
        </section>
    );
}
