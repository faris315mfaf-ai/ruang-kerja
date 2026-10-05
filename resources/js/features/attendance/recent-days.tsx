import { Link } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import {
    TONE_CLASSES,
    shortDay,
    statusLabel,
    statusTone,
} from '@/lib/attendance';
import { cn } from '@/lib/utils';
import type { AttendanceDayData } from '@/types/attendance';
import { badgeMinutes } from './status-badge';

type Props = {
    history: AttendanceDayData[] | undefined;
    today: string;
    historyHref?: string;
    className?: string;
};

/** "5 hari kerja terakhir" strip (mockup Absensi). */
export function RecentDays({
    history,
    today,
    historyHref = '#riwayat',
    className,
}: Props) {
    const days = (history ?? [])
        .filter((day) => day.workDate < today && day.status !== 'holiday')
        .slice(0, 5)
        .reverse();

    return (
        <section
            aria-labelledby="recent-days-title"
            className={cn(
                'rounded-xl border border-border bg-surface p-4 shadow-card',
                className,
            )}
        >
            <div className="flex items-center justify-between">
                <h2
                    id="recent-days-title"
                    className="text-[15px] font-semibold text-text"
                >
                    5 hari kerja terakhir
                </h2>
                <Link
                    href={historyHref}
                    className="text-sm font-medium text-primary hover:underline"
                >
                    Riwayat
                </Link>
            </div>
            {history === undefined ? (
                <div className="mt-4 grid grid-cols-5 gap-1.5">
                    {Array.from({ length: 5 }, (_, index) => (
                        <Skeleton key={index} className="h-12" />
                    ))}
                </div>
            ) : days.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">
                    Belum ada catatan kehadiran.
                </p>
            ) : (
                <ol className="mt-3 grid grid-cols-5 gap-1.5">
                    {days.map((day) => {
                        const tone = TONE_CLASSES[statusTone(day.status)];

                        return (
                            <li
                                key={day.id}
                                className="flex min-w-0 flex-col items-center gap-1.5 text-center"
                            >
                                <span className="text-[13px] text-text-muted">
                                    {shortDay(day.workDate)}
                                </span>
                                <span
                                    aria-hidden
                                    className={cn(
                                        'h-1.5 w-full rounded-full',
                                        tone.solid,
                                    )}
                                />
                                <span
                                    className={cn(
                                        'truncate text-[13px] font-medium',
                                        tone.text,
                                    )}
                                >
                                    {statusLabel(
                                        day.status,
                                        badgeMinutes(day),
                                        true,
                                    )}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
