import { UserRoundCheck } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    TodayAttendance,
    TodayPerson,
    TodayState,
} from '@/types/dashboard';

/**
 * Status colours of DBeranda / DHR (hadir green, terlambat amber, cuti blue,
 * belum gray, alpha red). Every bar segment also has a text label + count.
 */
export const STATE_META: Record<
    TodayState,
    { label: string; text: string; dot: string }
> = {
    present: { label: 'Hadir', text: 'text-success', dot: 'bg-success' },
    late: { label: 'Terlambat', text: 'text-warning', dot: 'bg-fill-warning' },
    away: {
        label: 'Cuti/izin/sakit',
        text: 'text-info',
        dot: 'bg-accent-blue-strong',
    },
    not_checked_in: {
        label: 'Belum',
        text: 'text-text-muted',
        dot: 'bg-border-strong',
    },
    absent: { label: 'Alpha', text: 'text-danger', dot: 'bg-fill-danger' },
};

export const STATE_ORDER: TodayState[] = [
    'present',
    'late',
    'away',
    'not_checked_in',
    'absent',
];

/** Count per state; "present" here means on time (late is its own slice). */
export function stateCounts(data: TodayAttendance): Record<TodayState, number> {
    return {
        present: data.counts.present - data.counts.late,
        late: data.counts.late,
        away: data.counts.away,
        not_checked_in: data.counts.not_checked_in,
        absent: data.counts.absent,
    };
}

/** Legend: dot, label and count per state (alpha only when > 0). */
export function StateLegend({
    data,
    className,
}: {
    data: TodayAttendance;
    className?: string;
}) {
    const counts = stateCounts(data);

    return (
        <ul
            className={cn(
                'grid grid-cols-2 gap-x-4 gap-y-2 text-label font-normal text-text-muted',
                className,
            )}
        >
            {STATE_ORDER.filter(
                (state) => state !== 'absent' || counts.absent > 0,
            ).map((state) => (
                <li key={state} className="inline-flex items-center gap-2">
                    <span
                        aria-hidden
                        className={cn(
                            'size-2.5 shrink-0 rounded-full',
                            STATE_META[state].dot,
                        )}
                    />
                    {STATE_META[state].label}
                    <b className="font-bold text-text tnum">{counts[state]}</b>
                </li>
            ))}
        </ul>
    );
}

/** Stacked bar of today's states (DBeranda "Kehadiran hari ini"). */
export function AttendanceBar({
    data,
    className,
}: {
    data: TodayAttendance;
    className?: string;
}) {
    const counts = stateCounts(data);

    return (
        <div
            role="img"
            aria-label={`${data.counts.present} dari ${data.counts.scheduled} terjadwal hadir`}
            className={cn(
                'flex h-3.5 gap-[3px] overflow-hidden rounded-[7px] bg-surface-2',
                className,
            )}
        >
            {STATE_ORDER.filter((state) => counts[state] > 0).map((state) => (
                <span
                    key={state}
                    className={cn(
                        STATE_META[state].dot,
                        state === 'present' && 'bg-grad-merek-x',
                    )}
                    style={{ flexGrow: counts[state], flexBasis: 0 }}
                />
            ))}
        </div>
    );
}

function personStatus(person: TodayPerson): string {
    switch (person.state) {
        case 'late':
            return `Terlambat ${person.late_minutes} menit`;
        case 'away':
            return person.request_type ?? person.status_label ?? 'Cuti';
        case 'not_checked_in':
            return 'Belum check-in';
        case 'absent':
            return 'Alpha';
        default:
            return person.status === 'wfh' ? 'Hadir · WFH' : 'Hadir';
    }
}

/** Person rows (DBeranda): avatar 40, name, status text, check-in time. */
export function AttendancePeople({
    people,
    limit,
    className,
}: {
    people: TodayPerson[];
    limit?: number;
    className?: string;
}) {
    if (people.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={UserRoundCheck}
                title="Tidak ada yang terjadwal hari ini"
                className={className}
            />
        );
    }

    return (
        <ul className={cn('flex flex-col', className)}>
            {(limit ? people.slice(0, limit) : people).map((person) => (
                <li
                    key={person.user.id}
                    className="flex min-h-[60px] items-center gap-3 border-t border-divider py-1.5"
                >
                    <UserAvatar
                        name={person.user.name}
                        src={person.user.avatar}
                        className="size-10 text-[15px]"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[16px] font-semibold">
                            {person.user.name}
                        </span>
                        <span
                            className={cn(
                                'truncate text-label',
                                STATE_META[person.state].text,
                            )}
                        >
                            {personStatus(person)}
                        </span>
                    </span>
                    <span className="shrink-0 font-mono text-[15px] text-text-muted tnum">
                        {person.check_in_at
                            ? formatTime(person.check_in_at)
                            : '—'}
                    </span>
                </li>
            ))}
        </ul>
    );
}
