import { formatNumber } from '@/lib/format';
import { formatShortDate } from '@/lib/requests';
import {
    KpiSkeleton,
    MetricKpi,
    MobileCard,
    SectionHeader,
} from './dashboard-ui';
import { compared, formatMetric, periodNoun } from './lib';
import { MyAttendanceCard } from './my-attendance-card';
import { FocusList } from './personal-parts';
import type { PersonalProps } from './personal-types';
import { RequestRows } from './request-rows';
import { ViewPicker } from './view-picker';

/** Small phone KPI tile (MSBeranda "Saldo cuti", "Tepat waktu"). */
const TILE = 'gap-0.5 rounded-card px-4 py-3.5 shadow-none';

/**
 * Beranda (design MSBeranda): the shell app bar holds the greeting; then the
 * attendance hero, "Fokus hari ini", KPI tiles 2×2 and "Pengajuan saya".
 */
export function PersonalMobile(props: PersonalProps) {
    const { metrics, live, definitions } = props;
    const previous = props.filters.period.previous_label;

    return (
        <div className="flex flex-col gap-3.5 pb-4">
            <ViewPicker views={props.views} />
            <MyAttendanceCard compact />

            <section
                aria-labelledby="focus-heading"
                className="flex flex-col gap-2"
            >
                <SectionHeader
                    id="focus-heading"
                    title="Fokus hari ini"
                    href="/tugas"
                    link="Semua"
                    linkLabel={`Semua tugas (${live.focus.total} terbuka)`}
                />
                <MobileCard>
                    <FocusList
                        items={live.focus.items.slice(0, 3)}
                        today={props.today}
                        variant="mobile"
                    />
                </MobileCard>
            </section>

            <section
                aria-label="Ringkasan"
                className="grid grid-cols-2 gap-2.5"
            >
                <MetricKpi
                    href="/pengajuan"
                    linkLabel="Saldo cuti, buka pengajuan saya"
                    label="Saldo cuti"
                    value={
                        live.leave_balance
                            ? formatNumber(live.leave_balance.remaining)
                            : '–'
                    }
                    suffix={live.leave_balance ? 'hari' : undefined}
                    note={live.leave_balance?.type ?? 'belum ada saldo'}
                    cardClassName={TILE}
                />
                {metrics ? (
                    <>
                        <MetricKpi
                            label="Tepat waktu"
                            definition={definitions.on_time_rate}
                            value={formatMetric(
                                metrics.kpis.on_time_rate.value,
                                'percent',
                            )}
                            note={
                                compared(
                                    metrics.kpis.on_time_rate,
                                    'percent',
                                    previous,
                                )?.text ??
                                periodNoun(props.filters.period.preset)
                            }
                            cardClassName={TILE}
                        />
                        <MetricKpi
                            href="/tugas"
                            linkLabel="Tugas terbuka, buka tugas saya"
                            label="Tugas terbuka"
                            value={formatNumber(metrics.kpis.open_tasks.value)}
                            note={
                                metrics.kpis.open_tasks.overdue > 0 ? (
                                    <b className="text-danger">
                                        {metrics.kpis.open_tasks.overdue}{' '}
                                        terlambat
                                    </b>
                                ) : (
                                    'tidak ada yang terlambat'
                                )
                            }
                            cardClassName={TILE}
                        />
                        <MetricKpi
                            label={`Selesai ${periodNoun(props.filters.period.preset)}`}
                            value={formatNumber(
                                metrics.kpis.completed.value ?? 0,
                            )}
                            note={`sejak ${formatShortDate(metrics.compared.current.from)}`}
                            cardClassName={TILE}
                        />
                    </>
                ) : (
                    Array.from({ length: 3 }, (_, index) => (
                        <KpiSkeleton key={index} className={TILE} />
                    ))
                )}
            </section>

            <section
                aria-labelledby="requests-heading"
                className="flex flex-col gap-2"
            >
                <SectionHeader
                    id="requests-heading"
                    title="Pengajuan saya"
                    href="/pengajuan"
                    link="Semua"
                    linkLabel="Semua pengajuan saya"
                />
                <MobileCard className="[&>div]:pt-4 [&>ul]:border-t-0">
                    <RequestRows items={live.requests.slice(0, 2)} />
                </MobileCard>
            </section>
        </div>
    );
}
