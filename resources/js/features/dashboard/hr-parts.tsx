import {
    CalendarCheck,
    Eye,
    MapPin,
    PencilLine,
    ShieldCheck,
    UserRoundCheck,
} from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    CorrectionDialog,
    type CorrectionTarget,
} from '@/features/attendance/review/correction-dialog';
import { ReviewButton } from '@/features/attendance/review/review-button';
import { formatRelative, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    DivisionAttendanceRow,
    HrToday,
    MissingCheckOut,
    ReviewItem,
    TodayPerson,
} from '@/types/dashboard';
import { STATE_META } from './attendance-today';
import { MetricKpi } from './dashboard-ui';
import { awayBreakdown, share } from './lib';

/** Phone KPI tile. */
const TILE = 'gap-0.5 rounded-card px-4 py-3.5 shadow-none';

/**
 * Today KPIs (DHR "Ringkasan"): present now on the highlight card with a
 * white progress bar, then late, not checked in and away.
 */
export function HrTodayKpis({
    attendance,
    compact = false,
}: {
    attendance: HrToday;
    compact?: boolean;
}) {
    const { counts } = attendance;
    const rate = Math.round(share(counts.present, counts.scheduled));
    const card = compact ? TILE : undefined;

    return (
        <>
            <MetricKpi
                tone="highlight"
                label="Hadir sekarang"
                value={String(counts.present)}
                suffix={`/ ${counts.scheduled}`}
                note={`${rate}% dari yang terjadwal · termasuk ${counts.late} terlambat`}
                className={compact ? 'col-span-2' : 'flex-[1.3_1_260px]'}
                cardClassName={card}
            >
                <span
                    aria-hidden
                    className="mt-1 block h-2 overflow-hidden rounded-full bg-on-brand/25"
                >
                    <span
                        className="block h-full rounded-full bg-on-brand"
                        style={{ width: `${rate}%` }}
                    />
                </span>
            </MetricKpi>
            <MetricKpi
                label="Terlambat"
                definition="Sudah check-in hari ini setelah batas toleransi shift."
                value={String(counts.late)}
                valueClassName={counts.late > 0 ? 'text-warning' : undefined}
                note={`dari ${counts.present} yang hadir`}
                className={compact ? undefined : 'flex-[1_1_200px]'}
                cardClassName={card}
            />
            <MetricKpi
                label="Belum check-in"
                definition="Terjadwal hari ini tetapi belum check-in. Pengingat otomatis dikirim 15 menit setelah jam masuk."
                value={String(counts.not_checked_in)}
                note={
                    counts.absent > 0
                        ? `${counts.absent} alpha`
                        : compact
                          ? 'pengingat otomatis aktif'
                          : 'pengingat otomatis 15 menit setelah jam masuk'
                }
                className={compact ? undefined : 'flex-[1_1_200px]'}
                cardClassName={card}
            />
            <MetricKpi
                label={compact ? 'Cuti/izin/sakit' : 'Cuti / izin / sakit'}
                definition="Tidak masuk karena pengajuan yang disetujui (cuti, izin, sakit, dinas)."
                value={String(counts.away)}
                valueClassName="text-info"
                note={awayBreakdown(counts)}
                className={compact ? 'col-span-2' : 'flex-[1_1_200px]'}
                cardClassName={card}
            />
        </>
    );
}

const SEGMENTS = [
    { key: 'on_time', state: 'present', label: 'Hadir' },
    { key: 'late', state: 'late', label: 'Terlambat' },
    { key: 'away', state: 'away', label: 'Cuti/izin' },
    { key: 'not_checked_in', state: 'not_checked_in', label: 'Belum' },
    { key: 'absent', state: 'absent', label: 'Alpha' },
] as const;

function segmentValues(row: DivisionAttendanceRow) {
    return {
        on_time: row.present - row.late,
        late: row.late,
        away: row.away,
        not_checked_in: row.not_checked_in,
        absent: row.absent,
    };
}

/** Stacked distribution bar (DHR "Kehadiran per divisi"). */
export function DistributionBar({
    row,
    className,
}: {
    row: DivisionAttendanceRow;
    className?: string;
}) {
    const values = segmentValues(row);

    return (
        <span
            className={cn(
                'flex h-4 gap-0.5 overflow-hidden rounded-lg bg-surface-2',
                className,
            )}
            aria-hidden
        >
            {SEGMENTS.filter(({ key }) => values[key] > 0).map(
                ({ key, state }) => (
                    <span
                        key={key}
                        className={cn('h-full', STATE_META[state].dot)}
                        style={{
                            width: `${share(values[key], row.scheduled)}%`,
                        }}
                    />
                ),
            )}
        </span>
    );
}

export function totalRow(rows: DivisionAttendanceRow[]): DivisionAttendanceRow {
    return rows.reduce<DivisionAttendanceRow>(
        (total, row) => ({
            ...total,
            scheduled: total.scheduled + row.scheduled,
            present: total.present + row.present,
            late: total.late + row.late,
            away: total.away + row.away,
            not_checked_in: total.not_checked_in + row.not_checked_in,
            absent: total.absent + row.absent,
        }),
        {
            id: null,
            name: 'Total',
            scheduled: 0,
            present: 0,
            late: 0,
            away: 0,
            not_checked_in: 0,
            absent: 0,
        },
    );
}

export function DistributionLegend({ className }: { className?: string }) {
    return (
        <ul
            className={cn(
                'flex flex-wrap gap-x-3.5 gap-y-1 text-meta font-normal text-text-muted',
                className,
            )}
        >
            {SEGMENTS.slice(0, 4).map(({ key, state, label }) => (
                <li key={key} className="inline-flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className={cn(
                            'size-2.5 rounded-full',
                            STATE_META[state].dot,
                        )}
                    />
                    {label}
                </li>
            ))}
        </ul>
    );
}

/** "2 terlambat · 1 cuti/izin · 0 belum" under a division name. */
function rowBreakdown(row: DivisionAttendanceRow): string {
    return [
        `${row.late} telat`,
        `${row.away} cuti/izin`,
        `${row.not_checked_in} belum`,
        row.absent > 0 ? `${row.absent} alpha` : null,
    ]
        .filter(Boolean)
        .join(' · ');
}

/**
 * Division rows (DHR): name + breakdown, stacked bar, present/scheduled.
 * The last row is the company total.
 */
export function DivisionRows({ rows }: { rows: DivisionAttendanceRow[] }) {
    const total = totalRow(rows);

    if (rows.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={CalendarCheck}
                title="Tidak ada karyawan terjadwal hari ini"
            />
        );
    }

    return (
        <ul className="flex flex-col">
            {[...rows, total].map((row) => (
                <li
                    key={row.id ?? row.name}
                    className={cn(
                        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-divider py-3 first:border-t-0 md:grid-cols-[minmax(0,190px)_1fr_70px]',
                        row === total && 'border-t-border-strong',
                    )}
                >
                    <span className="flex min-w-0 flex-col">
                        <span
                            className={cn(
                                'truncate text-[16px]',
                                row === total ? 'font-bold' : 'font-semibold',
                            )}
                        >
                            {row.name}
                        </span>
                        <span className="truncate text-meta font-normal text-text-muted tnum">
                            {rowBreakdown(row)}
                        </span>
                    </span>
                    <DistributionBar
                        row={row}
                        className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto"
                    />
                    <span className="col-start-2 row-start-1 text-right text-[16px] font-bold tnum md:col-start-auto md:row-start-auto">
                        {row.present}/{row.scheduled}
                        <span className="sr-only"> hadir</span>
                    </span>
                </li>
            ))}
        </ul>
    );
}

/** "Belum check-in" (DHR): people scheduled today without a check-in. */
export function NotCheckedInList({
    people,
    limit = 6,
}: {
    people: TodayPerson[];
    limit?: number;
}) {
    const [expanded, setExpanded] = useState(false);
    const all = people.filter((person) => person.state === 'not_checked_in');
    const rows = expanded ? all : all.slice(0, limit);

    if (rows.length === 0) {
        return (
            <div className="px-6 pb-2 md:px-7">
                <EmptyState
                    size="sm"
                    icon={UserRoundCheck}
                    title="Semua sudah check-in"
                />
            </div>
        );
    }

    return (
        <ul className="divide-y divide-divider border-t border-divider">
            {rows.map((person) => (
                <li
                    key={person.user.id}
                    className="flex min-h-16 items-center gap-3.5 px-5 py-2 md:px-7"
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
                        <span className="truncate text-label font-normal text-text-muted">
                            {person.user.division ?? 'Tanpa divisi'} · tidak ada
                            pengajuan
                        </span>
                    </span>
                    <Badge variant="status" tone="warning" className="h-[30px]">
                        Belum
                    </Badge>
                </li>
            ))}
            {all.length > limit && (
                <li className="px-5 pt-2 md:px-7">
                    <Button
                        type="button"
                        variant="quiet"
                        onClick={() => setExpanded((value) => !value)}
                        aria-expanded={expanded}
                        className="px-1"
                    >
                        {expanded
                            ? 'Tampilkan lebih sedikit'
                            : `Lihat semua ${all.length} orang`}
                    </Button>
                </li>
            )}
        </ul>
    );
}

/**
 * "Perlu ditinjau" (DHR): unreviewed suspicious check-ins as soft cards with
 * the reasons in red, "Lihat selfie" and "Tandai wajar".
 */
export function ReviewList({ items }: { items: ReviewItem[] }) {
    if (items.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={ShieldCheck}
                title="Tidak ada absensi tidak biasa"
            />
        );
    }

    return (
        <ul className="flex flex-col gap-3">
            {items.map((item) => (
                <li
                    key={item.id}
                    className="flex flex-col gap-2.5 rounded-[18px] bg-background p-4"
                >
                    <span className="flex items-center gap-3">
                        <UserAvatar
                            name={item.user.name}
                            src={item.user.avatar}
                            className="size-10 text-[15px]"
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[16px] font-bold">
                                {item.user.name}
                            </span>
                            <span className="text-label font-normal text-text-muted">
                                <MapPin
                                    aria-hidden
                                    className="mr-1 inline size-3.5 align-[-2px]"
                                />
                                {item.type === 'check_in'
                                    ? 'Check-in'
                                    : 'Check-out'}{' '}
                                <span className="font-mono tnum">
                                    {formatTime(item.occurred_at)}
                                </span>{' '}
                                · {item.location ?? item.method_label} ·{' '}
                                {formatRelative(item.occurred_at)}
                            </span>
                        </span>
                    </span>
                    <span className="text-label text-danger">
                        {item.flags
                            .map(
                                (flag) =>
                                    `${flag.label}${
                                        flag.key === 'low_accuracy' &&
                                        item.accuracy_m !== null
                                            ? ` ${Math.round(item.accuracy_m)} m`
                                            : ''
                                    }`,
                            )
                            .join(' · ')}
                    </span>
                    {(item.selfie_url || item.can_review) && (
                        <span className="flex flex-wrap gap-2">
                            {item.selfie_url && (
                                <Button asChild variant="outline" size="sm">
                                    <a
                                        href={item.selfie_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="max-md:h-11"
                                    >
                                        <Eye aria-hidden />
                                        Lihat selfie
                                    </a>
                                </Button>
                            )}
                            {item.can_review && (
                                <ReviewButton
                                    logId={item.id}
                                    only={['review', 'attendance']}
                                    className="h-9 max-md:h-11"
                                />
                            )}
                        </span>
                    )}
                </li>
            ))}
        </ul>
    );
}

/** Office time "HH:MM" of an ISO instant (prefills the correction form). */
function officeHourMinute(iso: string | null): string | null {
    return iso === null ? null : formatTime(iso).replace('.', ':');
}

/** "Lupa check-out kemarin" with the HR correction dialog. */
export function MissingCheckOutList({ data }: { data: MissingCheckOut }) {
    const [target, setTarget] = useState<CorrectionTarget | null>(null);

    if (data.items.length === 0) {
        return (
            <div className="px-6 pb-2 md:px-7">
                <EmptyState
                    size="sm"
                    icon={UserRoundCheck}
                    title="Semua sudah check-out kemarin"
                />
            </div>
        );
    }

    return (
        <>
            <ul className="divide-y divide-divider border-t border-divider">
                {data.items.map((item) => (
                    <li
                        key={item.id}
                        className="flex min-h-16 items-center gap-3.5 px-5 py-2 md:px-7"
                    >
                        <UserAvatar
                            name={item.user.name}
                            src={item.user.avatar}
                            className="size-10 text-[15px]"
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[16px] font-semibold">
                                {item.user.name}
                            </span>
                            <span className="truncate text-label font-normal text-text-muted">
                                {item.shift ?? 'Tanpa shift'} · masuk{' '}
                                <span className="font-mono tnum">
                                    {formatTime(item.check_in_at)}
                                </span>{' '}
                                · keluar –
                            </span>
                        </span>
                        {item.can_correct && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="max-md:h-11"
                                aria-label={`Koreksi absensi ${item.user.name}`}
                                onClick={() =>
                                    setTarget({
                                        userId: item.user.id,
                                        name: item.user.name,
                                        workDate: data.date,
                                        checkIn: officeHourMinute(
                                            item.check_in_at,
                                        ),
                                    })
                                }
                            >
                                <PencilLine aria-hidden />
                                Koreksi
                            </Button>
                        )}
                    </li>
                ))}
            </ul>
            {target !== null && (
                <CorrectionDialog
                    key={target.userId}
                    target={target}
                    today={data.date}
                    reload={['missingCheckOut', 'attendance']}
                    onClose={() => setTarget(null)}
                />
            )}
        </>
    );
}
