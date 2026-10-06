import { ClipboardList } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { cn } from '@/lib/utils';
import type { PersonalMetrics } from '@/types/dashboard';

const DAY_TONE: Record<string, string> = {
    present: 'bg-success',
    wfh: 'bg-success',
    early_leave: 'bg-success/50',
    late: 'bg-fill-warning',
    absent: 'bg-fill-danger',
    needs_correction: 'bg-fill-danger/50',
    leave: 'bg-accent-blue',
    permit: 'bg-accent-blue',
    sick: 'bg-accent-blue',
    business_trip: 'bg-accent-blue',
    holiday: 'bg-surface-2',
};

const LEGEND = [
    { label: 'Hadir', tone: 'bg-success' },
    { label: 'Terlambat', tone: 'bg-fill-warning' },
    { label: 'Alpha', tone: 'bg-fill-danger' },
    { label: 'Cuti/izin/sakit', tone: 'bg-accent-blue' },
] as const;

/** Attendance days of the period as squares + legend. */
export function AttendanceStrip({
    days,
}: {
    days: PersonalMetrics['attendance']['days'];
}) {
    if (days.items.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={ClipboardList}
                title="Belum ada catatan absensi"
            >
                Belum ada catatan absensi pada periode ini.
            </EmptyState>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-body text-text tnum">
                <b className="text-success">{days.counts.present}</b> hadir ·{' '}
                <b className="text-warning">{days.counts.late}</b> terlambat ·{' '}
                <b>{days.counts.absent}</b> alpha
                {days.counts.away > 0 &&
                    ` · ${days.counts.away} cuti/izin/sakit`}
            </p>
            <ol className="flex flex-wrap gap-1.5">
                {days.items.map((day) => (
                    <li
                        key={day.date}
                        title={`${day.date}: ${day.label}${day.late_minutes > 0 ? ` ${day.late_minutes} menit` : ''}`}
                        className={cn(
                            'size-6 rounded-xs',
                            DAY_TONE[day.status] ?? 'bg-surface-2',
                        )}
                    >
                        <span className="sr-only">
                            {day.date}: {day.label}
                        </span>
                    </li>
                ))}
            </ol>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-text-muted">
                {LEGEND.map((item) => (
                    <span
                        key={item.label}
                        className="inline-flex items-center gap-1.5"
                    >
                        <span
                            aria-hidden
                            className={cn('size-2.5 rounded-full', item.tone)}
                        />
                        {item.label}
                    </span>
                ))}
            </p>
        </div>
    );
}
