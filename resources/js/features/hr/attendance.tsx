import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    BarChart3,
    CalendarCheck2,
    ChevronRight,
    ClipboardCheck,
    Clock,
    Gauge,
    LogOut,
    UserCheck,
    Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Panel, PanelLink } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { LiveBadge } from '@/features/dashboard/live-badge';
import { formatDate, formatNumber, formatTime } from '@/lib/format';
import { formatRupiah } from '@/lib/requests';
import { cn, focusRing } from '@/lib/utils';
import { HubShell } from './hub-shell';
import { durationLabel, monthLabel } from './lib';
import { QuietLink } from './parts';
import type { HrAttendanceProps, PayrollSummary } from './types';

type Stat = { value: ReactNode; label: string; tone?: 'danger' | 'warning' };

/** One door into the Absensi module with its mini numbers (Absensi.dc.html). */
function Door({
    href,
    icon: Icon,
    title,
    description,
    stats,
    aside,
}: {
    href: string;
    icon: LucideIcon;
    title: string;
    description: string;
    stats: Stat[];
    aside?: ReactNode;
}) {
    return (
        <Link
            href={href}
            prefetch
            className={cn(
                'group flex min-w-0 flex-col gap-4 rounded-panel border border-border bg-surface p-5 shadow-card transition-colors duration-120 ease-brand hover:border-border-strong md:p-6',
                focusRing,
            )}
        >
            <div className="flex items-start gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-grad-soft text-link">
                    <Icon aria-hidden className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-title">{title}</span>
                    <span className="text-[15px] leading-[22px] text-text-muted">
                        {description}
                    </span>
                </span>
                <ChevronRight
                    aria-hidden
                    className="mt-1 size-5 shrink-0 text-text-subtle transition-transform duration-120 ease-brand group-hover:translate-x-0.5"
                />
            </div>
            {(stats.length > 0 || aside) && (
                <div className="mt-auto flex flex-wrap items-end gap-x-5 gap-y-2 border-t border-divider pt-3.5">
                    {stats.map((stat) => (
                        <span
                            key={stat.label}
                            className="flex items-baseline gap-1.5 text-meta text-text-muted"
                        >
                            <b
                                className={cn(
                                    'text-[22px] leading-7 font-bold text-text tnum',
                                    stat.tone === 'danger' && 'text-danger',
                                    stat.tone === 'warning' && 'text-warning',
                                )}
                            >
                                {stat.value}
                            </b>
                            {stat.label}
                        </span>
                    ))}
                    {aside}
                </div>
            )}
        </Link>
    );
}

function payrollStats(payroll: PayrollSummary | null | undefined): {
    stats: Stat[];
    aside?: ReactNode;
} {
    if (payroll === undefined) {
        return { stats: [], aside: <Skeleton className="h-7 w-40" /> };
    }

    if (payroll === null) {
        return { stats: [] };
    }

    return {
        stats: [
            {
                value: (
                    <span className="font-mono">
                        {formatRupiah(payroll.total)}
                    </span>
                ),
                label: monthLabel(payroll.month),
            },
            { value: formatNumber(payroll.paid_days), label: 'hari dibayar' },
        ],
    };
}

/** Ruang HR › Absensi: doors into the module + who has not checked in. */
export function HrAttendance({
    props,
    mobile,
    live,
}: {
    props: HrAttendanceProps;
    mobile: boolean;
    live: boolean;
}) {
    const { hub, attendance } = props;
    const { counts, month } = attendance;
    const payroll = payrollStats(props.payroll);
    const missing = attendance.not_checked_in;
    const checkOut = attendance.missing_check_out;

    return (
        <HubShell hub={hub} title="Absensi · Ruang HR" mobile={mobile}>
            <section
                aria-label="Bagian absensi"
                className={cn(
                    'grid gap-4 md:gap-5',
                    !mobile && 'md:grid-cols-2 xl:grid-cols-3',
                )}
            >
                <Door
                    href="/absensi/hari-ini"
                    icon={ClipboardCheck}
                    title="Hari ini"
                    description="Siapa sudah masuk, terlambat, belum check-in."
                    stats={[
                        { value: formatNumber(counts.present), label: 'hadir' },
                        {
                            value: formatNumber(counts.not_checked_in),
                            label: 'belum',
                        },
                        {
                            value: formatNumber(counts.late),
                            label: 'terlambat',
                            tone: counts.late > 0 ? 'warning' : undefined,
                        },
                    ]}
                    aside={
                        attendance.review_count > 0 ? (
                            <Badge
                                variant="status"
                                tone="warning"
                                dot
                                className="h-7 text-[13px]"
                            >
                                {attendance.review_count} perlu ditinjau
                            </Badge>
                        ) : undefined
                    }
                />
                <Door
                    href="/absensi/pegawai"
                    icon={CalendarCheck2}
                    title="Absen pegawai"
                    description="Grid sebulan, tambah atau ubah absen, tetapkan Alpha/Izin."
                    stats={[
                        {
                            value: formatNumber(month.needs_correction),
                            label: 'perlu koreksi',
                            tone:
                                month.needs_correction > 0
                                    ? 'warning'
                                    : undefined,
                        },
                        {
                            value: formatNumber(month.absent),
                            label: 'alpha bulan ini',
                            tone: month.absent > 0 ? 'danger' : undefined,
                        },
                    ]}
                />
                <Door
                    href="/absensi/rekap"
                    icon={BarChart3}
                    title="Rekap"
                    description="Rekap bulanan per pegawai, ekspor Excel & PDF."
                    stats={[
                        {
                            value: formatNumber(month.late),
                            label: `hari terlambat ${monthLabel(month.from.slice(0, 7))}`,
                        },
                    ]}
                />
                <Door
                    href="/absensi/kedisiplinan"
                    icon={Gauge}
                    title="Kedisiplinan"
                    description="Tren terlambat & alpha 8 minggu per divisi dan orang."
                    stats={[]}
                />
                {props.payroll !== null && (
                    <Door
                        href="/absensi/gaji"
                        icon={Wallet}
                        title="Gaji harian"
                        description="Upah harian × hari dibayar, aturan, kunci periode."
                        stats={payroll.stats}
                        aside={payroll.aside}
                    />
                )}
                {!mobile && (
                    <Door
                        href="/admin/absensi"
                        icon={Clock}
                        title="Lokasi, shift & libur"
                        description="Geofence kantor, jadwal shift, hari libur, kiosk QR."
                        stats={attendance.shifts.slice(0, 3).map((shift) => ({
                            value: formatNumber(shift.count),
                            label: shift.name,
                        }))}
                    />
                )}
            </section>

            <div
                className={cn(
                    'grid gap-4 md:gap-5',
                    !mobile &&
                        'items-start lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]',
                )}
            >
                <Panel
                    title={`Belum check-in · jadwal sudah lewat${missing.count > 0 ? ` (${missing.count})` : ''}`}
                    action={<LiveBadge live={live} />}
                >
                    {missing.items.length === 0 ? (
                        <EmptyState
                            size="sm"
                            icon={UserCheck}
                            title="Semua yang terjadwal sudah check-in"
                            description="Karyawan yang jam masuknya sudah lewat tanpa check-in tampil di sini."
                        />
                    ) : (
                        <ul
                            className={cn(
                                'grid grid-cols-1',
                                !mobile &&
                                    'gap-x-8 2xl:grid-cols-[repeat(2,minmax(0,1fr))]',
                            )}
                        >
                            {missing.items.map((item) => (
                                <li
                                    key={item.user.id}
                                    className="flex min-h-15 items-center gap-3 border-t border-divider py-2"
                                >
                                    <UserAvatar
                                        name={item.user.name}
                                        src={item.user.avatar}
                                        className="size-9 text-[13px]"
                                    />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-[16px] font-semibold">
                                            {item.user.name}
                                        </span>
                                        <span className="truncate text-meta text-text-muted">
                                            {[
                                                item.user.division,
                                                `jadwal ${formatTime(item.scheduled_start)}`,
                                                `lewat ${durationLabel(item.minutes_late)}`,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </span>
                                    </span>
                                    <QuietLink
                                        href={`/absensi/pegawai/${item.user.id}/${hub.today}`}
                                        label={`Atur absen ${item.user.name}`}
                                    >
                                        Atur absen
                                    </QuietLink>
                                </li>
                            ))}
                        </ul>
                    )}
                    {missing.count > missing.items.length && (
                        <p className="mt-2 text-meta text-text-muted">
                            {missing.count - missing.items.length} lainnya di{' '}
                            <Link
                                href="/absensi/hari-ini"
                                className={cn(
                                    'font-semibold text-link',
                                    focusRing,
                                )}
                            >
                                Absensi hari ini
                            </Link>
                        </p>
                    )}
                </Panel>

                <div className="flex min-w-0 flex-col gap-4 md:gap-5">
                    <Panel
                        title="Lupa check-out"
                        action={
                            <span className="text-meta text-text-muted">
                                {formatDate(checkOut.date)}
                            </span>
                        }
                    >
                        {checkOut.items.length === 0 ? (
                            <EmptyState
                                size="sm"
                                icon={LogOut}
                                title="Tidak ada yang lupa check-out"
                            />
                        ) : (
                            <ul className="flex flex-col">
                                {checkOut.items.map((item) => (
                                    <li
                                        key={item.id}
                                        className="flex min-h-15 items-center gap-3 border-t border-divider py-2 first:border-t-0"
                                    >
                                        <UserAvatar
                                            name={item.user.name}
                                            src={item.user.avatar}
                                            className="size-9 text-[13px]"
                                        />
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate text-[16px] font-semibold">
                                                {item.user.name}
                                            </span>
                                            <span className="truncate text-meta text-text-muted">
                                                {[
                                                    item.shift,
                                                    item.check_in_at
                                                        ? `masuk ${formatTime(item.check_in_at)}`
                                                        : null,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </span>
                                        </span>
                                        {item.can_correct && (
                                            <QuietLink
                                                href={`/absensi/pegawai/${item.user.id}/${checkOut.date}`}
                                                label={`Koreksi absen ${item.user.name}`}
                                            >
                                                Koreksi
                                            </QuietLink>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {checkOut.count > checkOut.items.length && (
                            <p className="mt-2 text-meta text-text-muted">
                                {checkOut.count - checkOut.items.length} lainnya
                            </p>
                        )}
                    </Panel>

                    <Panel
                        title="Per divisi hari ini"
                        action={
                            <PanelLink href="/absensi/hari-ini">
                                Detail
                            </PanelLink>
                        }
                    >
                        {attendance.divisions.length === 0 ? (
                            <EmptyState
                                size="sm"
                                icon={ClipboardCheck}
                                title="Belum ada jadwal hari ini"
                            />
                        ) : (
                            <ul className="flex flex-col">
                                {attendance.divisions.map((division) => (
                                    <li
                                        key={division.id ?? 'none'}
                                        className="flex min-h-12 items-center justify-between gap-3 border-t border-divider py-2 text-[15px] first:border-t-0"
                                    >
                                        <span className="truncate font-semibold">
                                            {division.name}
                                        </span>
                                        <span className="shrink-0 text-meta text-text-muted tnum">
                                            <b className="text-text">
                                                {division.present}/
                                                {division.scheduled}
                                            </b>{' '}
                                            hadir
                                            {division.late > 0 &&
                                                ` · ${division.late} terlambat`}
                                            {division.not_checked_in > 0 && (
                                                <span className="text-danger">
                                                    {' '}
                                                    · {
                                                        division.not_checked_in
                                                    }{' '}
                                                    belum
                                                </span>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>
            </div>
        </HubShell>
    );
}
