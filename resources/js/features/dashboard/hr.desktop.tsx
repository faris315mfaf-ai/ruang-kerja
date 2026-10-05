import { Link } from '@inertiajs/react';
import { CalendarRange, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelLink } from '@/components/ui/panel';
import { formatLongDate, formatTime } from '@/lib/format';
import { formatShortDate } from '@/lib/requests';
import { ComparedNote } from './compared-note';
import {
    KpiSkeleton,
    MetricKpi,
    PageHeader,
    PanelHint,
    PanelSkeleton,
} from './dashboard-ui';
import { FilterBar } from './filter-bar';
import {
    DistributionLegend,
    DivisionRows,
    HrTodayKpis,
    MissingCheckOutList,
    NotCheckedInList,
    ReviewList,
} from './hr-parts';
import type { HrProps } from './hr-types';
import { compared, formatMetric } from './lib';
import { LiveBadge } from './live-badge';
import { MetricInfo } from './metric-info';
import { RequestRows } from './request-rows';
import { TrendChart } from './trend-chart';
import { ViewPicker } from './view-picker';

/** "48 karyawan terjadwal hari ini di 6 divisi · 40 Reguler · 8 Pagi". */
export function hrSubtitle(props: HrProps): string {
    const { attendance } = props;
    const shifts = attendance.shifts
        .map((shift) => `${shift.count} ${shift.name}`)
        .join(' · ');

    return [
        `${attendance.counts.scheduled} karyawan terjadwal hari ini di ${attendance.divisions.length} divisi`,
        shifts || null,
    ]
        .filter(Boolean)
        .join(' · ');
}

/** Dashboard HR, desktop & tablet (design DHR). */
export function HrDesktop({ live, ...props }: HrProps & { live: boolean }) {
    const { attendance, review, pending, missingCheckOut, recap, definitions } =
        props;
    const previous = props.filters.period.previous_label;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                overline={`${formatLongDate(props.today)} · ${formatTime(new Date())}`}
                title="Dashboard HR"
                subtitle={
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {hrSubtitle(props)}
                        <LiveBadge live={live} />
                    </span>
                }
            >
                <Button asChild variant="outline">
                    <Link href="/absensi/rekap">
                        <CalendarRange aria-hidden />
                        Rekap absensi
                    </Link>
                </Button>
            </PageHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <ViewPicker views={props.views} />
                <FilterBar
                    filters={props.filters}
                    exportUrl={props.exportUrl}
                    className="ml-auto"
                />
            </div>

            <section aria-label="Ringkasan" className="flex flex-wrap gap-5">
                <HrTodayKpis attendance={attendance} />
            </section>

            <section className="flex flex-wrap items-start gap-5">
                <div className="flex min-w-0 flex-[1.5_1_560px] flex-col gap-5">
                    <Panel
                        title={
                            props.scope.label === 'Semua divisi'
                                ? 'Kehadiran per divisi'
                                : `Kehadiran · ${props.scope.label}`
                        }
                        action={<DistributionLegend />}
                        bodyClassName="gap-2"
                    >
                        <DivisionRows rows={attendance.divisions} />
                        <p className="text-meta text-text-muted">
                            Angka hadir sudah termasuk yang terlambat.
                        </p>
                    </Panel>

                    <Panel
                        title={
                            <>
                                Belum check-in
                                <Badge
                                    variant="status"
                                    tone="warning"
                                    className="h-7"
                                >
                                    {attendance.counts.not_checked_in}
                                </Badge>
                            </>
                        }
                        action={
                            <PanelHint>
                                pengingat otomatis 15 menit setelah jam masuk
                            </PanelHint>
                        }
                        flush
                        className="pb-2"
                    >
                        <NotCheckedInList people={attendance.people} />
                    </Panel>

                    <Panel
                        title={
                            <>
                                Lupa check-out kemarin
                                <Badge
                                    variant="status"
                                    tone="neutral"
                                    className="h-7"
                                >
                                    {missingCheckOut.count}
                                </Badge>
                            </>
                        }
                        action={
                            <PanelHint>
                                {formatShortDate(missingCheckOut.date)}
                            </PanelHint>
                        }
                        flush
                        className="pb-2"
                    >
                        <MissingCheckOutList data={missingCheckOut} />
                    </Panel>
                </div>

                <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
                    <Panel
                        title={
                            <>
                                Perlu ditinjau
                                <Badge className="h-7 bg-grad-hangat px-2.5 text-[15px]">
                                    {review.count}
                                </Badge>
                            </>
                        }
                        action={
                            <PanelHint>absensi tidak biasa · 7 hari</PanelHint>
                        }
                        bodyClassName="gap-3.5"
                    >
                        <ReviewList items={review.items} />
                        <p className="flex items-center gap-1.5 text-meta text-text-muted">
                            <ShieldCheck
                                aria-hidden
                                className="size-4 shrink-0"
                            />
                            Melihat selfie selalu tercatat di audit log.
                        </p>
                    </Panel>

                    <Panel
                        title={
                            <>
                                Pengajuan menunggu HR
                                <Badge className="h-7 px-2.5 text-[15px]">
                                    {pending.count}
                                </Badge>
                            </>
                        }
                        flush
                        className="pb-3"
                    >
                        <RequestRows
                            items={pending.items}
                            showUser
                            hrefBase="/persetujuan"
                            empty="Tidak ada pengajuan yang menunggu HR."
                        />
                        <div className="border-t border-divider px-6 pt-3 md:px-7">
                            <PanelLink href="/persetujuan">
                                Buka antrean ({pending.count})
                            </PanelLink>
                        </div>
                    </Panel>
                </div>
            </section>

            <section aria-labelledby="recap" className="flex flex-col gap-4">
                <h2 id="recap" className="text-h2">
                    Rekap {recap ? recap.compared.current.label : 'periode'}
                </h2>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {recap ? (
                        <>
                            <MetricKpi
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
                                note={`${recap.kpis.attendance_discipline.numerator} dari ${recap.kpis.attendance_discipline.denominator} hari kerja`}
                            />
                            <MetricKpi
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
                                note={`${recap.kpis.average_lateness.denominator} hari terlambat`}
                            />
                            <MetricKpi
                                label="Hari alpha"
                                definition="Hari berstatus Alpha (tidak check-in tanpa pengajuan) dalam periode."
                                value={formatMetric(
                                    recap.kpis.absent_days.value,
                                    'count',
                                )}
                                valueClassName={
                                    (recap.kpis.absent_days.value ?? 0) > 0
                                        ? 'text-danger'
                                        : undefined
                                }
                                delta={compared(
                                    recap.kpis.absent_days,
                                    'count',
                                    previous,
                                    'lower',
                                )}
                            />
                            <MetricKpi
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
                            <KpiSkeleton key={index} />
                        ))
                    )}
                </div>
                {recap && <ComparedNote compared={recap.compared} />}
                {recap ? (
                    <Panel
                        title={
                            <>
                                Tren kedisiplinan hadir
                                <MetricInfo
                                    definition={
                                        definitions.attendance_discipline
                                    }
                                />
                            </>
                        }
                        action={
                            <PanelHint>
                                % hari kerja tepat waktu · 8 minggu
                            </PanelHint>
                        }
                    >
                        <TrendChart
                            points={recap.trend}
                            description="Kedisiplinan hadir per minggu"
                            numeratorLabel="hari tepat waktu"
                            denominatorLabel="hari kerja"
                        />
                    </Panel>
                ) : (
                    <PanelSkeleton title="Tren kedisiplinan hadir" rows={5} />
                )}
            </section>
        </div>
    );
}
