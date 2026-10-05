import { Link } from '@inertiajs/react';
import { CheckCheck, ChevronRight, Clock, Monitor } from 'lucide-react';
import { useState } from 'react';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { formatLongDate, formatTime } from '@/lib/format';
import { formatShortDate } from '@/lib/requests';
import { cn, focusRing } from '@/lib/utils';
import type { TodayState } from '@/types/dashboard';
import { AttendanceBar, AttendancePeople } from './attendance-today';
import { MobileCard } from './dashboard-ui';
import { DivisionRows, HrTodayKpis, ReviewList } from './hr-parts';
import type { HrProps } from './hr-types';
import { LiveBadge } from './live-badge';
import { ViewPicker } from './view-picker';

type PeopleFilter = 'all' | TodayState;

const PEOPLE_LIMIT = 8;

/**
 * Dashboard HR on phones (PHRLive / PeranMHR): live bar, KPI tiles, people
 * filtered by status chips, per-division rows, review queue and shortcuts.
 * Recap & export stay on desktop.
 */
export function HrMobile({ live, ...props }: HrProps & { live: boolean }) {
    const { attendance, review, pending, missingCheckOut } = props;
    const [filter, setFilter] = useState<PeopleFilter>('all');
    const [expanded, setExpanded] = useState(false);
    const count = (state: TodayState) =>
        attendance.people.filter((person) => person.state === state).length;
    const people =
        filter === 'all'
            ? attendance.people
            : attendance.people.filter((person) => person.state === filter);

    return (
        <div className="flex flex-col gap-3.5 pb-4">
            <div className="flex flex-col gap-1 px-1">
                <p className="text-overline text-link">
                    {formatLongDate(props.today)}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 text-title">
                    Kehadiran langsung
                    <LiveBadge live={live} />
                </p>
                <p className="text-meta text-text-muted">
                    {props.scope.label} · diperbarui{' '}
                    <span className="font-mono tnum">
                        {formatTime(new Date())}
                    </span>
                </p>
            </div>
            <ViewPicker views={props.views} />
            <AttendanceBar data={attendance} />

            <section
                aria-label="Ringkasan"
                className="grid grid-cols-2 gap-2.5"
            >
                <HrTodayKpis attendance={attendance} compact />
            </section>

            <section
                aria-label="Karyawan hari ini"
                className="flex flex-col gap-2.5"
            >
                <ChipScroller<PeopleFilter>
                    label="Status"
                    value={filter}
                    onChange={(value) => {
                        setFilter(value);
                        setExpanded(false);
                    }}
                    chips={[
                        {
                            value: 'all',
                            label: 'Semua',
                            count: attendance.people.length,
                        },
                        {
                            value: 'late',
                            label: 'Terlambat',
                            count: count('late'),
                        },
                        {
                            value: 'not_checked_in',
                            label: 'Belum',
                            count: count('not_checked_in'),
                        },
                        {
                            value: 'away',
                            label: 'Cuti/izin',
                            count: count('away'),
                        },
                        {
                            value: 'present',
                            label: 'Hadir',
                            count: count('present'),
                        },
                    ]}
                />
                <MobileCard>
                    <AttendancePeople
                        people={people}
                        limit={expanded ? undefined : PEOPLE_LIMIT}
                        className="px-4 [&>li:first-child]:border-t-0"
                    />
                </MobileCard>
                {people.length > PEOPLE_LIMIT && (
                    <Button
                        type="button"
                        variant="quiet"
                        onClick={() => setExpanded((value) => !value)}
                        aria-expanded={expanded}
                        className="self-start"
                    >
                        {expanded
                            ? 'Tampilkan lebih sedikit'
                            : `Lihat semua ${people.length}`}
                    </Button>
                )}
            </section>

            <Panel title="Per divisi" className="py-5" bodyClassName="gap-2">
                <DivisionRows rows={attendance.divisions} />
                <p className="text-meta text-text-muted">
                    Angka hadir sudah termasuk yang terlambat.
                </p>
            </Panel>

            <Panel
                title={
                    <>
                        Perlu ditinjau
                        <Badge className="h-7 bg-grad-hangat px-2.5 text-[15px]">
                            {review.count}
                        </Badge>
                    </>
                }
                className="py-5"
            >
                <ReviewList items={review.items} />
            </Panel>

            <MobileCard className="divide-y divide-divider">
                <Link
                    href="/persetujuan"
                    prefetch
                    className={cn(
                        'flex min-h-[72px] items-center gap-3.5 px-4 py-3',
                        focusRing,
                        'focus-visible:ring-inset',
                    )}
                >
                    <span
                        aria-hidden
                        className="flex size-11 shrink-0 items-center justify-center rounded-control bg-info-soft text-info"
                    >
                        <CheckCheck className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[17px] font-semibold">
                            Pengajuan menunggu HR
                        </span>
                        <span className="truncate text-label font-normal text-text-muted">
                            {pending.items
                                .map((item) => item.user.name.split(' ')[0])
                                .join(', ') || 'Tidak ada'}
                        </span>
                    </span>
                    <Badge className="tnum">{pending.count}</Badge>
                    <ChevronRight
                        aria-hidden
                        className="size-5 shrink-0 text-text-subtle"
                    />
                </Link>
                <div className="flex min-h-[72px] items-center gap-3.5 px-4 py-3">
                    <span
                        aria-hidden
                        className="flex size-11 shrink-0 items-center justify-center rounded-control bg-warning-soft text-warning"
                    >
                        <Clock className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[17px] font-semibold">
                            Lupa check-out kemarin
                        </span>
                        <span className="truncate text-label font-normal text-text-muted">
                            {missingCheckOut.items
                                .map((item) => item.user.name.split(' ')[0])
                                .join(', ') || 'Tidak ada'}{' '}
                            · {formatShortDate(missingCheckOut.date)}
                        </span>
                    </span>
                    <Badge variant="status" tone="warning" className="tnum">
                        {missingCheckOut.count}
                    </Badge>
                </div>
            </MobileCard>

            <p className="flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-3 text-meta text-text-muted">
                <Monitor className="size-4 shrink-0" aria-hidden />
                Rekap & ekspor bulanan tersedia di desktop.
            </p>
        </div>
    );
}
