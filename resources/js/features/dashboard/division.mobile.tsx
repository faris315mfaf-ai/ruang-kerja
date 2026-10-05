import { Link } from '@inertiajs/react';
import { CheckCheck, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { AtRiskProjects } from './at-risk-projects';
import { AttendancePeople, StateLegend } from './attendance-today';
import { DivisionKpis, useExpandable } from './division-parts';
import type { DivisionProps } from './division-types';
import { Segmented } from './filter-bar';
import { LiveBadge } from './live-badge';
import { OverdueList } from './overdue-list';
import { Panel, PanelSkeleton } from './panel';
import { StatCardSkeleton } from './stat-card';
import { TrendChart } from './trend-chart';
import { useDashboardFilters } from './use-dashboard-filters';
import { ViewPicker } from './view-picker';
import { WorkloadBars } from './workload-bars';

/** Dashboard Kepala Divisi on phones (mockup MDashboardKadiv): one column. */
export function DivisionMobile({
    live,
    ...props
}: DivisionProps & { live: boolean }) {
    const { metrics, attendance, approvals } = props;
    const { current, apply } = useDashboardFilters(props.filters);
    const people = useExpandable(6);

    return (
        <div className="space-y-4 pb-4">
            <header>
                <h1 className="text-[22px] leading-7 font-semibold text-text">
                    {props.scope.label}
                </h1>
                <p className="text-sm text-text-muted">
                    {props.scope.member_count} anggota ·{' '}
                    {formatDate(new Date())}
                </p>
            </header>
            <ViewPicker views={props.views} />
            <Segmented
                label="Periode"
                className="flex w-full"
                options={[
                    { value: 'minggu', label: 'Minggu ini' },
                    { value: 'bulan', label: 'Bulan ini' },
                ]}
                value={current.periode === 'bulan' ? 'bulan' : 'minggu'}
                onChange={(value) => apply({ periode: value })}
            />

            <div className="grid grid-cols-2 gap-3">
                <DivisionKpis props={props} compact />
                {!metrics &&
                    Array.from({ length: 3 }, (_, index) => (
                        <StatCardSkeleton key={index} />
                    ))}
            </div>

            {metrics ? (
                <Panel
                    id="m-trend"
                    title="Tren penyelesaian"
                    aside="8 minggu · % selesai"
                >
                    <TrendChart
                        points={metrics.trend}
                        description="Tingkat penyelesaian per minggu"
                        numeratorLabel="selesai"
                        denominatorLabel="bertenggat"
                        height={150}
                        compact
                    />
                </Panel>
            ) : (
                <PanelSkeleton rows={3} />
            )}

            <Panel
                id="m-today"
                title="Kehadiran hari ini"
                aside={<LiveBadge live={live} />}
                flush
            >
                <StateLegend data={attendance} className="px-4 pb-2" />
                <AttendancePeople
                    people={attendance.people}
                    limit={people.limit}
                />
                {attendance.people.length > 6 && (
                    <button
                        type="button"
                        onClick={people.toggle}
                        className="mx-4 inline-flex min-h-11 items-center text-[15px] text-primary"
                    >
                        {people.expanded
                            ? 'Tampilkan lebih sedikit'
                            : 'Lihat semua'}
                    </button>
                )}
            </Panel>

            {metrics ? (
                <>
                    <Panel
                        id="m-workload"
                        title="Beban kerja"
                        aside="tugas terbuka"
                    >
                        <WorkloadBars rows={metrics.workload} limit={6} />
                    </Panel>
                    <Panel
                        id="m-overdue"
                        title="Tugas terlambat"
                        aside={`${metrics.overdue.total} tugas`}
                        flush
                    >
                        <OverdueList
                            items={metrics.overdue.items.slice(0, 5)}
                        />
                    </Panel>
                    {metrics.projects.length > 0 && (
                        <Panel id="m-projects" title="Proyek berisiko" flush>
                            <AtRiskProjects projects={metrics.projects} />
                        </Panel>
                    )}
                </>
            ) : (
                <PanelSkeleton />
            )}

            <Link
                href="/persetujuan"
                className="flex min-h-16 items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"
            >
                <span className="flex size-10 items-center justify-center rounded-lg bg-link-soft text-primary">
                    <CheckCheck className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[15px] font-semibold text-text">
                        Menunggu persetujuan Anda
                        <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground tnum">
                            {approvals.count}
                        </span>
                    </span>
                    <span className="block truncate text-[13px] text-text-muted">
                        {approvals.items.length > 0
                            ? approvals.items
                                  .map(
                                      (item) =>
                                          `${item.user.name.split(' ')[0]} ${item.type.name.toLowerCase()}`,
                                  )
                                  .join(' · ')
                            : 'Tidak ada antrean'}
                    </span>
                </span>
                <ChevronRight className="size-5 text-text-subtle" aria-hidden />
            </Link>
        </div>
    );
}
