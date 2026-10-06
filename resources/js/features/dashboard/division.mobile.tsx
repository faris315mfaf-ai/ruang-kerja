import { Link } from '@inertiajs/react';
import { CheckCheck, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { formatLongDate } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { AtRiskProjects } from './at-risk-projects';
import {
    AttendanceBar,
    AttendancePeople,
    StateLegend,
} from './attendance-today';
import { KpiSkeleton, PanelHint, PanelSkeleton } from './dashboard-ui';
import { DivisionKpis, KPI_TILE, useExpandable } from './division-parts';
import type { DivisionProps } from './division-types';
import { Segmented } from './filter-bar';
import { LiveBadge } from './live-badge';
import { TeamReportsPanel } from './team-reports';
import { OverdueList } from './overdue-list';
import { TrendChart } from './trend-chart';
import { useDashboardFilters } from './use-dashboard-filters';
import { ViewPicker } from './view-picker';
import { WorkloadBars } from './workload-bars';

/**
 * Dashboard Kepala Divisi on phones (MBeranda vocabulary: overline, gradient
 * KPI first, 2-column tiles, panels stacked in one column).
 */
export function DivisionMobile({
    live,
    ...props
}: DivisionProps & { live: boolean }) {
    const { metrics, attendance, approvals } = props;
    const { current, apply } = useDashboardFilters(props.filters);
    const people = useExpandable(4);

    return (
        <div className="flex flex-col gap-3.5 pb-4">
            <div className="flex flex-col gap-0.5 px-1">
                <p className="text-overline text-link">
                    {formatLongDate(props.today)}
                </p>
                <p className="text-title text-text-muted">
                    {props.scope.label} · {props.scope.member_count} anggota
                </p>
            </div>
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

            <section
                aria-label="Ringkasan"
                className="grid grid-cols-2 gap-2.5"
            >
                <DivisionKpis props={props} compact />
                {!metrics &&
                    Array.from({ length: 3 }, (_, index) => (
                        <KpiSkeleton key={index} className={KPI_TILE} />
                    ))}
            </section>

            <Link
                href="/persetujuan"
                prefetch
                className={cn(
                    'flex min-h-[72px] items-center gap-3.5 rounded-[22px] border border-border bg-surface px-4 py-3',
                    focusRing,
                )}
            >
                <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-control bg-link-soft text-link"
                >
                    <CheckCheck className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-[17px] font-semibold">
                        Menunggu persetujuan
                        <Badge className="tnum">{approvals.count}</Badge>
                    </span>
                    <span className="truncate text-label font-normal text-text-muted">
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
                <ChevronRight
                    aria-hidden
                    className="size-5 shrink-0 text-text-subtle"
                />
            </Link>

            {metrics ? (
                <Panel
                    title="Tren penyelesaian"
                    action={<PanelHint>8 minggu · % selesai</PanelHint>}
                    className="py-5"
                >
                    <TrendChart
                        points={metrics.trend}
                        description="Tingkat penyelesaian per minggu"
                        numeratorLabel="selesai"
                        denominatorLabel="bertenggat"
                        height={170}
                        compact
                    />
                </Panel>
            ) : (
                <PanelSkeleton title="Tren penyelesaian" rows={3} />
            )}

            <Panel
                title="Kehadiran hari ini"
                action={<LiveBadge live={live} />}
                className="py-5"
                bodyClassName="gap-4"
            >
                <AttendanceBar data={attendance} />
                <StateLegend data={attendance} />
                <AttendancePeople
                    people={attendance.people}
                    limit={people.limit}
                />
                {attendance.people.length > 4 && (
                    <Button
                        type="button"
                        variant="quiet"
                        onClick={people.toggle}
                        aria-expanded={people.expanded}
                        className="-mt-2 self-start px-1"
                    >
                        {people.expanded
                            ? 'Tampilkan lebih sedikit'
                            : `Lihat semua ${attendance.people.length} anggota`}
                    </Button>
                )}
            </Panel>

            <TeamReportsPanel reports={props.reports} mobile />

            {metrics ? (
                <>
                    <Panel
                        title="Beban kerja"
                        action={<PanelHint>tugas terbuka</PanelHint>}
                        className="py-5"
                    >
                        <WorkloadBars rows={metrics.workload} limit={6} />
                    </Panel>
                    <Panel
                        title={
                            <>
                                Tugas terlambat
                                <Badge
                                    variant="status"
                                    tone="danger"
                                    className="h-7"
                                >
                                    {metrics.overdue.total}
                                </Badge>
                            </>
                        }
                        flush
                        className="pt-5 pb-1"
                    >
                        <OverdueList
                            items={metrics.overdue.items.slice(0, 5)}
                            compact
                            className="border-t border-divider"
                        />
                    </Panel>
                    {metrics.projects.length > 0 && (
                        <Panel
                            title="Proyek berisiko"
                            flush
                            className="pt-5 pb-1"
                        >
                            <AtRiskProjects projects={metrics.projects} />
                        </Panel>
                    )}
                </>
            ) : (
                <PanelSkeleton title="Beban kerja" />
            )}
        </div>
    );
}
