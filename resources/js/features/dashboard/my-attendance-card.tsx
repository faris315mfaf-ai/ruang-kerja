import { Link, usePage } from '@inertiajs/react';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { START_PARAM } from '@/features/attendance/use-attendance-page';
import { TONE_CLASSES } from '@/lib/attendance';
import { shellStatus } from '@/lib/check-in-status';
import { formatTime, toDate } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import { cn } from '@/lib/utils';
import { MetricInfo } from './metric-info';

/** Position (0–100) of `at` between `start` and `end`. */
function position(start: Date, end: Date, at: Date): number {
    const span = end.getTime() - start.getTime();

    return span > 0
        ? Math.min(
              100,
              Math.max(0, ((at.getTime() - start.getTime()) / span) * 100),
          )
        : 0;
}

/**
 * Desktop "Absensi hari ini" (mockup DashboardSaya): status line, location,
 * a day timeline (schedule start → now → end with the check-in marker) and
 * the next action. Data: shared `attendanceStatus` prop (Sprint 2).
 */
export function MyAttendanceCard({ className }: { className?: string }) {
    const { attendanceStatus: status } = usePage().props;

    if (!status) {
        return null;
    }

    const shell = shellStatus(status);
    const start = toDate(status.start);
    const end = toDate(status.end);
    const checkIn = toDate(status.checkInAt);
    const now = new Date();
    const late = status.status === 'late' && status.lateMinutes > 0;

    return (
        <section
            aria-labelledby="my-attendance"
            className={cn(
                'flex flex-col rounded-xl border border-border bg-surface p-4 shadow-card',
                className,
            )}
        >
            <div className="flex items-baseline justify-between gap-3">
                <h2
                    id="my-attendance"
                    className="text-[15px] font-semibold text-text"
                >
                    Absensi hari ini
                </h2>
                {status.shiftName && (
                    <span className="truncate text-[13px] text-text-muted">
                        Shift {status.shiftName}
                    </span>
                )}
            </div>
            <p
                className={cn(
                    'mt-2 flex items-center gap-1.5 text-[17px] font-semibold',
                    TONE_CLASSES[shell.tone].text,
                )}
            >
                <Clock className="size-4.5" aria-hidden />
                {checkIn ? (
                    <>
                        Check-in{' '}
                        <span className="font-mono tnum">
                            {formatTime(checkIn)}
                        </span>
                        {late && ` · Terlambat ${status.lateMinutes} menit`}
                    </>
                ) : (
                    shell.title
                )}
                {late && (
                    <MetricInfo definition="Terlambat dihitung dari batas toleransi shift, bukan dari jam masuk." />
                )}
            </p>
            <p className="mt-1 text-[13px] text-text-muted">
                {[
                    status.locationName,
                    status.distanceM !== null
                        ? `${formatDistance(status.distanceM)} dari titik lokasi`
                        : null,
                    status.isRemote ? 'WFH/lapangan' : null,
                ]
                    .filter(Boolean)
                    .join(' · ') || shell.detail}
            </p>
            {start && end && (
                <div className="mt-4">
                    <div
                        className="relative h-1.5 rounded-full bg-surface-2"
                        aria-hidden
                    >
                        {checkIn && (
                            <span
                                className={cn(
                                    'absolute inset-y-0 rounded-full',
                                    late ? 'bg-warning/60' : 'bg-primary/60',
                                )}
                                style={{
                                    left: 0,
                                    width: `${position(start, end, checkIn)}%`,
                                }}
                            />
                        )}
                        {checkIn && (
                            <span
                                className="absolute inset-y-0 rounded-full bg-primary"
                                style={{
                                    left: `${position(start, end, checkIn)}%`,
                                    width: `${Math.max(0, position(start, end, now) - position(start, end, checkIn))}%`,
                                }}
                            />
                        )}
                        <span
                            className="absolute -top-1 h-3.5 w-0.5 rounded bg-text"
                            style={{ left: `${position(start, end, now)}%` }}
                        />
                    </div>
                    <div className="mt-1.5 flex justify-between font-mono text-xs text-text-muted tnum">
                        <span>{formatTime(start)}</span>
                        <span className="text-text">
                            sekarang {formatTime(now)}
                        </span>
                        <span>{formatTime(end)}</span>
                    </div>
                </div>
            )}
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-sm text-text-muted">
                    {status.checkOutAt ? 'Check-out ' : 'Jadwal pulang '}
                    <span className="font-mono text-text tnum">
                        {status.checkOutAt
                            ? formatTime(status.checkOutAt)
                            : (status.endLabel ?? '–')}
                    </span>
                </span>
                {shell.button ? (
                    <Button asChild size="sm" variant={shell.button.variant}>
                        <Link href={`/absensi?${START_PARAM}=1`}>
                            {shell.button.label === 'Check-in' ? (
                                <LogIn aria-hidden />
                            ) : (
                                <LogOut aria-hidden />
                            )}
                            {shell.button.label}
                        </Link>
                    </Button>
                ) : (
                    <Button asChild size="sm" variant="outline">
                        <Link href="/pengajuan/baru?kategori=correction">
                            Ajukan koreksi
                        </Link>
                    </Button>
                )}
            </div>
        </section>
    );
}
