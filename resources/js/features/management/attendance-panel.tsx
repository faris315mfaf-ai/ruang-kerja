import { UserRoundCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { attendanceSegments, share } from './lib';
import { ArusSkeleton, EmptyState, Panel, PanelLink } from './panel';
import type { AttendanceToday } from './types';

/** Divisions at or above this share present get the brand fill, else amber. */
const GOOD_SHARE = 90;

/**
 * "Absensi hari ini": stacked bar + legend over the people scheduled today
 * (TodayAttendance, the same numbers as Absensi hari ini / Dashboard HR) and
 * present/scheduled per division.
 */
export function AttendancePanel({
    attendance,
    className,
}: {
    attendance: AttendanceToday;
    className?: string;
}) {
    const { counts } = attendance;
    const segments = attendanceSegments(counts);

    return (
        <Panel
            title="Absensi hari ini"
            action={
                <PanelLink
                    href="/absensi/hari-ini"
                    label="Detail absensi hari ini"
                >
                    Detail
                </PanelLink>
            }
            className={className}
            bodyClassName="gap-4"
        >
            {counts.scheduled === 0 ? (
                <EmptyState
                    icon={UserRoundCheck}
                    title="Tidak ada karyawan terjadwal hari ini"
                >
                    Hari libur atau belum ada jadwal shift untuk hari ini.
                </EmptyState>
            ) : (
                <>
                    <div
                        aria-hidden
                        className="flex h-[18px] gap-0.5 overflow-hidden rounded-[9px] bg-arus-surface-2"
                    >
                        {segments
                            .filter((segment) => segment.value > 0)
                            .map((segment) => (
                                <span
                                    key={segment.key}
                                    className={segment.fill}
                                    style={{
                                        flexGrow: segment.value,
                                        flexBasis: 0,
                                    }}
                                />
                            ))}
                    </div>
                    <ul
                        aria-label={`${counts.present} dari ${counts.scheduled} karyawan terjadwal hadir`}
                        className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[15px]"
                    >
                        {segments.map((segment) => (
                            <li
                                key={segment.key}
                                className="flex items-center gap-2"
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        'size-2.5 shrink-0 rounded-full',
                                        segment.fill,
                                    )}
                                />
                                {segment.label}
                                <b className="ml-auto font-extrabold">
                                    {segment.value}
                                </b>
                            </li>
                        ))}
                    </ul>
                    <ul
                        aria-label="Kehadiran per divisi"
                        className="flex flex-col"
                    >
                        {attendance.divisions.map((division) => {
                            const pct = share(
                                division.present,
                                division.scheduled,
                            );

                            return (
                                <li
                                    key={division.id ?? 'none'}
                                    className="grid min-h-arus-control grid-cols-[minmax(0,1fr)_minmax(64px,120px)_auto] items-center gap-3 border-t border-arus-surface-2"
                                >
                                    <span className="truncate text-[15px] font-semibold">
                                        {division.name}
                                    </span>
                                    <span
                                        aria-hidden
                                        className="relative block h-2 rounded-full bg-arus-surface-2"
                                    >
                                        <span
                                            className={cn(
                                                'absolute inset-y-0 left-0 rounded-full',
                                                pct >= GOOD_SHARE
                                                    ? 'bg-arus-brand-x'
                                                    : 'bg-arus-fill-warning',
                                            )}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </span>
                                    <span className="min-w-[52px] text-right text-[15px] font-extrabold">
                                        {division.present}/{division.scheduled}
                                        <span className="sr-only"> hadir</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </Panel>
    );
}

export function AttendancePanelSkeleton({ className }: { className?: string }) {
    return (
        <Panel
            title="Absensi hari ini"
            className={className}
            bodyClassName="gap-4"
        >
            <ArusSkeleton className="h-[18px] w-full rounded-[9px]" />
            <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((key) => (
                    <ArusSkeleton key={key} className="h-5" />
                ))}
            </div>
            {[0, 1, 2, 3].map((key) => (
                <ArusSkeleton key={key} className="h-8" />
            ))}
        </Panel>
    );
}
