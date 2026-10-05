import { Link, usePage } from '@inertiajs/react';
import { LogIn, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
                'rounded-panel border border-border bg-surface p-5 shadow-card',
                className,
            )}
        >
            <div className="flex items-baseline justify-between gap-3">
                <h2
                    id="today-attendance"
                    className="text-title font-bold text-text"
                >
                    Absensi hari ini
                </h2>
                <span className="truncate text-meta text-text-muted">
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
                    <p className="text-meta text-text-muted">Check-in</p>
                    <p
                        className={cn(
                            'text-[28px] leading-9 font-bold tnum',
                            checkedIn
                                ? TONE_CLASSES[shell.tone].text
                                : 'text-text-subtle',
                        )}
                    >
                        {checkedIn ? formatTime(status.checkInAt) : '––.––'}
                    </p>
                    <Badge
                        variant="status"
                        tone={shell.tone}
                        dot
                        className="mt-1 h-[30px] gap-1.5 px-3"
                    >
                        {shell.title}
                    </Badge>
                </div>
                <div>
                    <p className="text-meta text-text-muted">
                        {status.checkOutAt ? 'Check-out' : 'Jadwal pulang'}
                    </p>
                    <p className="text-[28px] leading-9 font-bold text-text tnum">
                        {status.checkOutAt
                            ? formatTime(status.checkOutAt)
                            : (status.endLabel ?? '–')}
                    </p>
                    {status.distanceM !== null && (
                        <p className="mt-1 text-meta text-text-muted">
                            {formatDistance(status.distanceM)} dari titik lokasi
                        </p>
                    )}
                </div>
            </div>
            {shell.button && (
                <Button
                    asChild
                    size="lg"
                    className="mt-4 w-full"
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
