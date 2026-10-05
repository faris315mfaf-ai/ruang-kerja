import { Link } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/format';
import { formatShortDate } from '@/lib/requests';
import { cn } from '@/lib/utils';
import {
    DistributionBar,
    DistributionLegend,
    HrTodayKpis,
    MissingCheckOutList,
    ReviewList,
    totalRow,
} from './hr-parts';
import type { HrProps } from './hr-types';
import { FilterBar } from './filter-bar';
import { ComparedNote } from './compared-note';
import { compared, formatMetric } from './lib';
import { LiveBadge } from './live-badge';
import { MetricInfo } from './metric-info';
import { Panel, PanelSkeleton } from './panel';
import { RequestRows } from './request-rows';
import { StatCard, StatCardSkeleton } from './stat-card';
import { TrendChart } from './trend-chart';
import { ViewPicker } from './view-picker';

function CountBadge({
    count,
    tone = 'warning',
}: {
    count: number;
    tone?: 'warning' | 'muted';
}) {
    return (
        <span
            className={cn(
                'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-medium tnum',
                tone === 'warning' && count > 0
                    ? 'bg-warning/12 text-warning'
                    : 'bg-surface-2 text-text-muted',
            )}
        >
            {count}
        </span>
    );
}

/** Dashboard HR, desktop & tablet (mockup DashboardHR). */
export function HrDesktop({ live, ...props }: HrProps & { live: boolean }) {
    const { attendance, review, pending, missingCheckOut, recap, definitions } =
        props;
    const total = totalRow(attendance.divisions);
    const previous = props.filters.period.previous_label;

    return (
        <div className="space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-3 text-2xl leading-8 font-semibold text-text">
                        Absensi hari ini ·{' '}
                        {props.scope.label === 'Semua divisi'
                            ? 'seluruh perusahaan'
                            : props.scope.label}
                        <LiveBadge live={live} />
                    </h1>
                    <p className="text-sm text-text-muted">
                        {formatDate(new Date())} · {props.scope.member_count}{' '}
                        karyawan aktif · diperbarui{' '}
                        <span className="font-mono tnum">
                            {formatTime(new Date())}
                        </span>
                    </p>
                </div>
                <FilterBar
                    filters={props.filters}
                    exportUrl={props.exportUrl}
                />
            </header>
            <ViewPicker views={props.views} />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <HrTodayKpis attendance={attendance} />
            </div>

            <div className="grid gap-4 xl:grid-cols-12">
                <Panel
                    id="per-division"
                    title="Per divisi"
                    aside={<DistributionLegend />}
                    className="xl:col-span-7"
                    flush
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm tnum">
                            <thead className="bg-surface-2 text-[13px] text-text-muted">
                                <tr>
                                    <th
                                        scope="col"
                                        className="px-4 py-2 text-left font-normal"
                                    >
                                        Divisi
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-2 py-2 text-right font-normal"
                                    >
                                        Terjadwal
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-1/4 px-3 py-2 text-left font-normal"
                                    >
                                        Distribusi
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-2 py-2 text-right font-normal"
                                    >
                                        Hadir
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-2 py-2 text-right font-normal"
                                    >
                                        Terlambat
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-2 py-2 text-right font-normal"
                                    >
                                        Cuti/izin/sakit
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-2 text-right font-normal"
                                    >
                                        Belum
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {[...attendance.divisions, total].map((row) => (
                                    <tr
                                        key={row.id ?? row.name}
                                        className={cn(
                                            row === total &&
                                                'bg-surface-2 font-semibold',
                                        )}
                                    >
                                        <th
                                            scope="row"
                                            className="px-4 py-2.5 text-left font-normal text-text"
                                        >
                                            {row.name}
                                        </th>
                                        <td className="px-2 text-right">
                                            {row.scheduled}
                                        </td>
                                        <td className="px-3">
                                            <DistributionBar row={row} />
                                        </td>
                                        <td className="px-2 text-right">
                                            {row.present}
                                        </td>
                                        <td
                                            className={cn(
                                                'px-2 text-right',
                                                row.late > 0
                                                    ? 'text-warning'
                                                    : 'text-text-muted',
                                            )}
                                        >
                                            {row.late}
                                        </td>
                                        <td className="px-2 text-right">
                                            {row.away}
                                        </td>
                                        <td className="px-4 text-right">
                                            {row.not_checked_in}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="px-4 pt-3 text-[13px] text-text-muted">
                        Kolom Hadir sudah termasuk yang terlambat.
                    </p>
                </Panel>
                <Panel
                    id="review"
                    title={
                        <>
                            Perlu ditinjau <CountBadge count={review.count} />
                        </>
                    }
                    aside="absensi tidak biasa · 7 hari"
                    className="xl:col-span-5"
                    flush
                >
                    <ReviewList items={review.items} />
                    <p className="flex items-center gap-1.5 px-4 pt-2 text-xs text-text-muted">
                        <ShieldCheck className="size-3.5" aria-hidden />
                        Lihat selfie: akses tercatat di audit log.
                    </p>
                </Panel>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Panel
                    id="pending-hr"
                    title={
                        <>
                            Pengajuan menunggu HR{' '}
                            <CountBadge count={pending.count} tone="muted" />
                        </>
                    }
                    aside={
                        <Link
                            href="/persetujuan"
                            className="text-primary hover:underline"
                        >
                            Buka persetujuan →
                        </Link>
                    }
                    flush
                >
                    <RequestRows
                        items={pending.items}
                        showUser
                        hrefBase="/persetujuan"
                        empty="Tidak ada pengajuan yang menunggu HR."
                    />
                </Panel>
                <Panel
                    id="missing-checkout"
                    title={
                        <>
                            Lupa check-out kemarin{' '}
                            <CountBadge
                                count={missingCheckOut.count}
                                tone="muted"
                            />
                        </>
                    }
                    aside={formatShortDate(missingCheckOut.date)}
                    flush
                >
                    <MissingCheckOutList data={missingCheckOut} />
                </Panel>
            </div>

            <section aria-labelledby="recap" className="space-y-3">
                <h2 id="recap" className="text-[15px] font-semibold text-text">
                    Rekap {recap ? recap.compared.current.label : 'periode'}
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {recap ? (
                        <>
                            <StatCard
                                label="Kedisiplinan hadir"
                                definition={definitions.attendance_discipline}
                                value={formatMetric(
                                    recap.kpis.attendance_discipline.value,
                                    'percent',
                                )}
                                delta={compared(
                                    recap.kpis.attendance_discipline,
                                    'percent',
                                    previous,
                                )}
                                caption={`${recap.kpis.attendance_discipline.numerator} dari ${recap.kpis.attendance_discipline.denominator} hari kerja`}
                            />
                            <StatCard
                                label="Rata-rata terlambat"
                                definition={definitions.average_lateness}
                                value={formatMetric(
                                    recap.kpis.average_lateness.value,
                                    'minutes',
                                )}
                                delta={compared(
                                    recap.kpis.average_lateness,
                                    'minutes',
                                    previous,
                                    'lower',
                                )}
                                caption={`${recap.kpis.average_lateness.denominator} hari terlambat`}
                            />
                            <StatCard
                                label="Hari alpha"
                                definition="Hari berstatus Alpha (tidak check-in tanpa pengajuan) dalam periode."
                                value={formatMetric(
                                    recap.kpis.absent_days.value,
                                    'count',
                                )}
                                valueTone={
                                    (recap.kpis.absent_days.value ?? 0) > 0
                                        ? 'danger'
                                        : 'default'
                                }
                                delta={compared(
                                    recap.kpis.absent_days,
                                    'count',
                                    previous,
                                    'lower',
                                )}
                            />
                            <StatCard
                                label="Hari terlambat"
                                definition="Hari berstatus Terlambat dalam periode."
                                value={formatMetric(
                                    recap.kpis.late_days.value,
                                    'count',
                                )}
                                delta={compared(
                                    recap.kpis.late_days,
                                    'count',
                                    previous,
                                    'lower',
                                )}
                            />
                        </>
                    ) : (
                        Array.from({ length: 4 }, (_, index) => (
                            <StatCardSkeleton key={index} />
                        ))
                    )}
                </div>
                {recap && <ComparedNote compared={recap.compared} />}
                {recap ? (
                    <Panel
                        id="discipline-trend"
                        title={
                            <>
                                Tren kedisiplinan hadir · 8 minggu
                                <MetricInfo
                                    definition={
                                        definitions.attendance_discipline
                                    }
                                />
                            </>
                        }
                        aside="% hari kerja tepat waktu"
                    >
                        <TrendChart
                            points={recap.trend}
                            description="Kedisiplinan hadir per minggu"
                            numeratorLabel="hari tepat waktu"
                            denominatorLabel="hari kerja"
                            height={220}
                        />
                    </Panel>
                ) : (
                    <PanelSkeleton rows={5} />
                )}
            </section>
        </div>
    );
}
