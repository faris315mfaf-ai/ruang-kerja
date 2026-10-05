import { Link } from '@inertiajs/react';
import { CheckCheck, ChevronRight, Clock, Monitor } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/format';
import { formatShortDate } from '@/lib/requests';
import { DistributionBar, HrTodayKpis, ReviewList, totalRow } from './hr-parts';
import type { HrProps } from './hr-types';
import { LiveBadge } from './live-badge';
import { Panel } from './panel';
import { ViewPicker } from './view-picker';

/** Dashboard HR on phones (mockup MDashboardHR): summary, export on desktop. */
export function HrMobile({ live, ...props }: HrProps & { live: boolean }) {
    const { attendance, review, pending, missingCheckOut } = props;
    const total = totalRow(attendance.divisions);

    return (
        <div className="space-y-4 pb-4">
            <header>
                <h1 className="flex items-center gap-2 text-[22px] leading-7 font-semibold text-text">
                    Absensi hari ini
                    <LiveBadge live={live} />
                </h1>
                <p className="text-sm text-text-muted">
                    {formatDate(new Date())} · {props.scope.label.toLowerCase()}{' '}
                    · diperbarui{' '}
                    <span className="font-mono tnum">
                        {formatTime(new Date())}
                    </span>
                </p>
            </header>
            <ViewPicker views={props.views} />

            <div className="grid grid-cols-2 gap-3">
                <HrTodayKpis attendance={attendance} compact />
            </div>

            <Panel
                id="m-per-division"
                title="Per divisi"
                aside="Hadir termasuk terlambat"
                flush
            >
                <ul className="divide-y divide-border">
                    {[...attendance.divisions, total].map((row) => (
                        <li key={row.id ?? row.name} className="px-4 py-2.5">
                            <div className="flex items-baseline gap-2 text-[15px] tnum">
                                <span className="min-w-0 flex-1 truncate text-text">
                                    {row.name}{' '}
                                    <span className="text-text-muted">
                                        · {row.scheduled}
                                    </span>
                                </span>
                                <span className="w-7 text-right">
                                    {row.present}
                                </span>
                                <span className="w-7 text-right text-warning">
                                    {row.late}
                                </span>
                                <span className="w-7 text-right text-info">
                                    {row.away}
                                </span>
                                <span className="w-7 text-right text-text-muted">
                                    {row.not_checked_in}
                                </span>
                            </div>
                            <DistributionBar row={row} className="mt-2" />
                        </li>
                    ))}
                </ul>
                <p className="px-4 pt-2 text-xs text-text-muted">
                    Kolom: hadir · telat · cuti/izin/sakit · belum
                </p>
            </Panel>

            <Panel
                id="m-review"
                title={`Perlu ditinjau · ${review.count}`}
                aside="absensi tidak biasa"
                flush
            >
                <ReviewList items={review.items} />
            </Panel>

            <div className="overflow-hidden rounded-xl border border-border bg-surface">
                <Link
                    href="/persetujuan"
                    className="flex min-h-16 items-center gap-3 px-4 py-3"
                >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-info-soft text-info">
                        <CheckCheck className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium text-text">
                            Pengajuan menunggu HR
                        </span>
                        <span className="block truncate text-[13px] text-text-muted">
                            {pending.items
                                .map((item) => item.user.name.split(' ')[0])
                                .join(', ') || 'Tidak ada'}
                        </span>
                    </span>
                    <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground tnum">
                        {pending.count}
                    </span>
                    <ChevronRight
                        className="size-5 text-text-subtle"
                        aria-hidden
                    />
                </Link>
                <div className="flex min-h-16 items-center gap-3 border-t border-border px-4 py-3">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-warning-soft text-warning">
                        <Clock className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium text-text">
                            Lupa check-out kemarin
                        </span>
                        <span className="block truncate text-[13px] text-text-muted">
                            {missingCheckOut.items
                                .map((item) => item.user.name.split(' ')[0])
                                .join(', ') || 'Tidak ada'}{' '}
                            · {formatShortDate(missingCheckOut.date)}
                        </span>
                    </span>
                    <span className="rounded-full bg-warning-soft px-2 text-xs text-warning tnum">
                        {missingCheckOut.count}
                    </span>
                </div>
            </div>

            <p className="flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-3 text-[13px] text-text-muted">
                <Monitor className="size-4" aria-hidden />
                Rekap & ekspor bulanan tersedia di desktop.
            </p>
        </div>
    );
}
