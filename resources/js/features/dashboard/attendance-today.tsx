import { Cell, Pie, PieChart } from 'recharts';
import { UserAvatar } from '@/components/shell/user-avatar';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    TodayAttendance,
    TodayPerson,
    TodayState,
} from '@/types/dashboard';
import { PanelEmpty } from './panel';

/** Status colors carry state; every slice also has a text label + count. */
export const STATE_META: Record<
    TodayState,
    { label: string; text: string; dot: string; fill: string }
> = {
    present: {
        label: 'Hadir',
        text: 'text-success',
        dot: 'bg-success',
        fill: 'var(--success)',
    },
    late: {
        label: 'Terlambat',
        text: 'text-warning',
        dot: 'bg-warning',
        fill: 'var(--warning)',
    },
    away: {
        label: 'Cuti/izin/sakit',
        text: 'text-info',
        dot: 'bg-info',
        fill: 'var(--info)',
    },
    not_checked_in: {
        label: 'Belum',
        text: 'text-text-muted',
        dot: 'bg-border-strong',
        fill: 'var(--border-strong)',
    },
    absent: {
        label: 'Alpha',
        text: 'text-danger',
        dot: 'bg-danger',
        fill: 'var(--danger)',
    },
};

const ORDER: TodayState[] = [
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
                'flex flex-wrap gap-x-3 gap-y-1.5 text-[13px] text-text-muted',
                className,
            )}
        >
            {ORDER.filter(
                (state) => state !== 'absent' || counts.absent > 0,
            ).map((state) => (
                <li key={state} className="inline-flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className={cn(
                            'size-2 rounded-full',
                            STATE_META[state].dot,
                        )}
                    />
                    {STATE_META[state].label}{' '}
                    <span className="text-text tnum">{counts[state]}</span>
                </li>
            ))}
        </ul>
    );
}

/** Donut of today's states with the scheduled total in the middle. */
export function AttendanceDonut({
    data,
    size = 120,
}: {
    data: TodayAttendance;
    size?: number;
}) {
    const counts = stateCounts(data);
    const slices = ORDER.map((state) => ({
        state,
        value: counts[state],
    })).filter((slice) => slice.value > 0);

    return (
        <div
            className="relative shrink-0"
            style={{ width: size, height: size }}
            role="img"
            aria-label={`${data.counts.present} dari ${data.counts.scheduled} terjadwal hadir`}
        >
            <PieChart width={size} height={size}>
                <Pie
                    data={
                        slices.length > 0
                            ? slices
                            : [{ state: 'not_checked_in', value: 1 }]
                    }
                    dataKey="value"
                    innerRadius={size * 0.36}
                    outerRadius={size * 0.5}
                    paddingAngle={slices.length > 1 ? 2 : 0}
                    stroke="none"
                    isAnimationActive={false}
                >
                    {(slices.length > 0
                        ? slices
                        : [{ state: 'not_checked_in' as const, value: 1 }]
                    ).map((slice) => (
                        <Cell
                            key={slice.state}
                            fill={
                                slices.length > 0
                                    ? STATE_META[slice.state].fill
                                    : 'var(--surface-2)'
                            }
                        />
                    ))}
                </Pie>
            </PieChart>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-semibold text-text tnum">
                    {data.counts.present}
                </span>
                <span className="text-[11px] text-text-muted tnum">
                    / {data.counts.scheduled}
                </span>
            </div>
        </div>
    );
}

function personStatus(person: TodayPerson): string {
    switch (person.state) {
        case 'late':
            return `Terlambat ${person.late_minutes}m`;
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

/** Person rows: avatar, name, status text, check-in time (mono). */
export function AttendancePeople({
    people,
    limit,
}: {
    people: TodayPerson[];
    limit?: number;
}) {
    if (people.length === 0) {
        return <PanelEmpty>Tidak ada yang terjadwal hari ini.</PanelEmpty>;
    }

    return (
        <ul className="divide-y divide-border">
            {(limit ? people.slice(0, limit) : people).map((person) => (
                <li
                    key={person.user.id}
                    className="flex min-h-11 items-center gap-3 px-4 py-1.5"
                >
                    <UserAvatar
                        name={person.user.name}
                        src={person.user.avatar}
                        className="size-7"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-text">
                        {person.user.name}
                    </span>
                    <span
                        className={cn(
                            'shrink-0 text-[13px]',
                            STATE_META[person.state].text,
                        )}
                    >
                        {personStatus(person)}
                    </span>
                    <span className="w-11 shrink-0 text-right font-mono text-[13px] text-text-muted tnum">
                        {person.check_in_at
                            ? formatTime(person.check_in_at)
                            : '–'}
                    </span>
                </li>
            ))}
        </ul>
    );
}
