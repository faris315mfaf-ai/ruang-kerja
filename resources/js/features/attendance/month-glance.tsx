import { KpiCard } from '@/components/ui/kpi-card';
import { Panel, PanelLink } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { WEEKDAYS, statusLabel, statusTone } from '@/lib/attendance';
import type { StatusTone } from '@/lib/attendance';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AttendanceDayData } from '@/types/attendance';

const DOTS: Record<StatusTone, string> = {
    success: 'bg-success',
    warning: 'bg-fill-warning',
    info: 'bg-accent-blue-strong',
    danger: 'bg-fill-danger',
    neutral: 'bg-transparent',
};

const LEGEND: { label: string; dot: string }[] = [
    { label: 'Hadir', dot: DOTS.success },
    { label: 'Terlambat', dot: DOTS.warning },
    { label: 'Cuti / WFH', dot: DOTS.info },
    { label: 'Alpha', dot: DOTS.danger },
];

/** Monday-based weekday index (0 = Sen) of an office calendar date. */
function weekdayIndex(date: string): number {
    return (new Date(`${date}T05:00:00Z`).getUTCDay() + 6) % 7;
}

function monthTitle(date: string): string {
    return new Intl.DateTimeFormat('id-ID', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${date}T05:00:00Z`));
}

/** Days of the month of `today` ("2026-10-01" … "2026-10-31"). */
function monthDates(today: string): string[] {
    const [year, month] = today.split('-').map(Number);
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const prefix = today.slice(0, 8);

    return Array.from(
        { length: count },
        (_, index) => `${prefix}${String(index + 1).padStart(2, '0')}`,
    );
}

/**
 * Month card of the Absensi page (DAbsensi "Oktober 2026"): 7-column grid,
 * today on the action gradient, a status dot per recorded day.
 */
export function MonthGlance({
    history,
    today,
    className,
}: {
    history: AttendanceDayData[] | undefined;
    today: string;
    className?: string;
}) {
    const dates = monthDates(today);
    const byDate = new Map((history ?? []).map((day) => [day.workDate, day]));
    const blanks = weekdayIndex(dates[0]);

    return (
        <Panel
            title={
                <span className="first-letter:uppercase">
                    {monthTitle(today)}
                </span>
            }
            action={
                <PanelLink href="/absensi/riwayat">Semua riwayat</PanelLink>
            }
            className={className}
            bodyClassName="gap-4"
        >
            <div className="grid grid-cols-7 gap-1 text-center" aria-hidden>
                {WEEKDAYS.map((day) => (
                    <span
                        key={day.value}
                        className="pb-1.5 text-[14px] font-bold text-text-muted"
                    >
                        {day.short}
                    </span>
                ))}
            </div>
            <ol
                aria-label={`Kalender ${monthTitle(today)}`}
                className="-mt-3 grid grid-cols-7 gap-1 text-center"
            >
                {Array.from({ length: blanks }, (_, index) => (
                    <li key={`blank-${index}`} aria-hidden />
                ))}
                {dates.map((date) => {
                    const day = byDate.get(date);
                    const isToday = date === today;
                    const weekend = weekdayIndex(date) >= 5;
                    const tone = day ? statusTone(day.status) : 'neutral';
                    const label = day
                        ? statusLabel(day.status, day.lateMinutes)
                        : null;

                    return (
                        <li
                            key={date}
                            aria-current={isToday ? 'date' : undefined}
                            aria-label={`${Number(date.slice(8))}${label ? ` · ${label}` : ''}`}
                            className={cn(
                                'flex h-[46px] flex-col items-center justify-center gap-[3px] rounded-control text-[16px] tnum',
                                isToday
                                    ? 'bg-primary bg-grad-aksi font-extrabold text-on-brand'
                                    : weekend
                                      ? 'font-medium text-text-subtle'
                                      : 'font-medium text-text',
                            )}
                        >
                            {Number(date.slice(8))}
                            <span
                                aria-hidden
                                className={cn(
                                    'size-1.5 rounded-full',
                                    isToday
                                        ? 'bg-on-brand'
                                        : day
                                          ? DOTS[tone]
                                          : 'bg-transparent',
                                )}
                            />
                        </li>
                    );
                })}
            </ol>
            <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-[14px] text-text-muted">
                {LEGEND.map((item) => (
                    <li
                        key={item.label}
                        className="inline-flex items-center gap-1.5"
                    >
                        <span
                            aria-hidden
                            className={cn('size-2 rounded-full', item.dot)}
                        />
                        {item.label}
                    </li>
                ))}
            </ul>
        </Panel>
    );
}

/** Attended days and the on-time share of the loaded history (30 days). */
export function historyStats(history: AttendanceDayData[]): {
    attended: number;
    onTime: number | null;
} {
    const attended = history.filter((day) => day.checkInAt !== null);
    const onTime = attended.filter((day) => day.lateMinutes === 0).length;

    return {
        attended: attended.length,
        onTime:
            attended.length === 0
                ? null
                : Math.round((onTime / attended.length) * 100),
    };
}

/** Two small KPI tiles under the month card (DAbsensi). */
export function HistoryStats({
    history,
}: {
    history: AttendanceDayData[] | undefined;
}) {
    if (history === undefined) {
        return (
            <div className="grid grid-cols-2 gap-3" aria-busy>
                <Skeleton className="h-[116px] rounded-card" />
                <Skeleton className="h-[116px] rounded-card" />
            </div>
        );
    }

    const stats = historyStats(history);

    return (
        <div className="grid grid-cols-2 gap-3">
            <KpiCard
                label="Hadir 30 hari"
                value={stats.attended}
                suffix="hari"
                className="px-5 py-5"
            />
            <KpiCard
                label="Tepat waktu 30 hari"
                value={
                    stats.onTime === null ? '–' : formatPercent(stats.onTime, 0)
                }
                className="px-5 py-5"
            />
        </div>
    );
}
