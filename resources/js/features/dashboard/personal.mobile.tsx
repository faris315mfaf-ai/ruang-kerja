import { Link } from '@inertiajs/react';
import { TodayAttendanceCard } from '@/features/attendance/today-card';
import { formatNumber } from '@/lib/format';
import { formatShortDate } from '@/lib/requests';
import { compared, formatMetric, periodNoun } from './lib';
import { PanelSkeleton } from './panel';
import { FocusList } from './personal-parts';
import type { PersonalProps } from './personal-types';
import { RequestRows } from './request-rows';
import { StatCard, StatCardSkeleton } from './stat-card';
import { ViewPicker } from './view-picker';

function SectionHeader({
    title,
    href,
    link,
}: {
    title: string;
    href: string;
    link: string;
}) {
    return (
        <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-text">{title}</h2>
            <Link
                href={href}
                className="inline-flex min-h-11 items-center text-[15px] text-primary"
            >
                {link}
            </Link>
        </div>
    );
}

/** Beranda (mockup MBeranda): check-in card first, KPI 2×2, focus, requests. */
export function PersonalMobile(props: PersonalProps) {
    const { metrics, live, definitions } = props;
    const previous = props.filters.period.previous_label;

    return (
        <div className="space-y-5 pb-4">
            <ViewPicker views={props.views} />
            <TodayAttendanceCard />

            <div className="grid grid-cols-2 gap-3">
                {metrics ? (
                    <>
                        <StatCard
                            compact
                            label="Tugas terbuka"
                            value={formatNumber(metrics.kpis.open_tasks.value)}
                            caption={
                                metrics.kpis.open_tasks.overdue > 0 ? (
                                    <span className="text-danger">
                                        {metrics.kpis.open_tasks.overdue}{' '}
                                        terlambat
                                    </span>
                                ) : (
                                    'tidak ada yang terlambat'
                                )
                            }
                        />
                        <StatCard
                            compact
                            label={`Selesai ${periodNoun(props.filters.period.preset)}`}
                            value={formatNumber(
                                metrics.kpis.completed.value ?? 0,
                            )}
                            caption={`sejak ${formatShortDate(metrics.compared.current.from)}`}
                        />
                        <StatCard
                            compact
                            label="Ketepatan waktu"
                            definition={definitions.on_time_rate}
                            value={formatMetric(
                                metrics.kpis.on_time_rate.value,
                                'percent',
                            )}
                            delta={compared(
                                metrics.kpis.on_time_rate,
                                'percent',
                                previous,
                            )}
                        />
                        <StatCard
                            compact
                            label="Saldo cuti"
                            value={
                                live.leave_balance
                                    ? formatNumber(live.leave_balance.remaining)
                                    : '–'
                            }
                            suffix={live.leave_balance ? 'hari' : undefined}
                            caption={
                                live.leave_balance?.type ?? 'belum ada saldo'
                            }
                        />
                    </>
                ) : (
                    Array.from({ length: 4 }, (_, index) => (
                        <StatCardSkeleton key={index} />
                    ))
                )}
            </div>

            <section className="space-y-2">
                <SectionHeader
                    title="Fokus hari ini"
                    href="/tugas"
                    link={metrics ? `Semua ${metrics.focus.total}` : 'Semua'}
                />
                {metrics ? (
                    <div className="overflow-hidden rounded-xl border border-border bg-surface">
                        <FocusList
                            items={metrics.focus.items.slice(0, 3)}
                            today={props.today}
                            variant="mobile"
                        />
                    </div>
                ) : (
                    <PanelSkeleton rows={3} />
                )}
            </section>

            <section className="space-y-2">
                <SectionHeader
                    title="Pengajuan saya"
                    href="/pengajuan"
                    link="Semua"
                />
                <div className="overflow-hidden rounded-xl border border-border bg-surface">
                    <RequestRows items={live.requests.slice(0, 2)} />
                </div>
            </section>
        </div>
    );
}
