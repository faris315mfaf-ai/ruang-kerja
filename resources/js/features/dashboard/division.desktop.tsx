import { Link } from '@inertiajs/react';
import { formatDate } from '@/lib/format';
import { AtRiskProjects } from './at-risk-projects';
import { ComparedNote } from './compared-note';
import {
    AttendanceDonut,
    AttendancePeople,
    StateLegend,
} from './attendance-today';
import { DivisionKpis, SecondaryKpis, useExpandable } from './division-parts';
import type { DivisionProps } from './division-types';
import { FilterBar } from './filter-bar';
import { LiveBadge } from './live-badge';
import { MetricInfo } from './metric-info';
import { OverdueList } from './overdue-list';
import { Panel, PanelSkeleton } from './panel';
import { RequestRows } from './request-rows';
import { StatCardSkeleton } from './stat-card';
import { TrendChart } from './trend-chart';
import { ViewPicker } from './view-picker';
import { WorkloadBars } from './workload-bars';

/** Dashboard Kepala Divisi, desktop & tablet (mockup Main). */
export function DivisionDesktop({
    live,
    ...props
}: DivisionProps & { live: boolean }) {
    const { metrics, attendance, approvals, definitions } = props;
    const people = useExpandable(6);

    return (
        <div className="space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl leading-8 font-semibold text-text">
                        Dashboard Divisi
                    </h1>
                    <p className="text-sm text-text-muted">
                        {props.scope.label} · {props.scope.member_count} anggota
                        · {formatDate(new Date())}
                    </p>
                </div>
                <FilterBar
                    filters={props.filters}
                    exportUrl={props.exportUrl}
                />
            </header>
            <ViewPicker views={props.views} />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DivisionKpis props={props} />
                {!metrics &&
                    Array.from({ length: 3 }, (_, index) => (
                        <StatCardSkeleton key={index} />
                    ))}
            </div>
            {metrics && (
                <div className="grid gap-4 md:grid-cols-3">
                    <SecondaryKpis
                        metrics={metrics}
                        definitions={definitions}
                        previousLabel={props.filters.period.previous_label}
                    />
                </div>
            )}
            {metrics && <ComparedNote compared={metrics.compared} />}

            <div className="grid gap-4 xl:grid-cols-12">
                {metrics ? (
                    <Panel
                        id="trend"
                        title={
                            <>
                                Tren penyelesaian · 8 minggu
                                <MetricInfo
                                    definition={definitions.completion_rate}
                                />
                            </>
                        }
                        aside="% tugas bertenggat yang selesai"
                        className="xl:col-span-7"
                    >
                        <TrendChart
                            points={metrics.trend}
                            description="Tingkat penyelesaian per minggu"
                            numeratorLabel="selesai"
                            denominatorLabel="bertenggat"
                            height={260}
                        />
                    </Panel>
                ) : (
                    <PanelSkeleton className="xl:col-span-7" rows={6} />
                )}
                <Panel
                    id="today"
                    title="Kehadiran hari ini"
                    aside={<LiveBadge live={live} />}
                    className="xl:col-span-5"
                    flush
                >
                    <div className="flex items-center gap-4 px-4 pb-3">
                        <AttendanceDonut data={attendance} size={96} />
                        <StateLegend data={attendance} />
                    </div>
                    <AttendancePeople
                        people={attendance.people}
                        limit={people.limit}
                    />
                    {attendance.people.length > 6 && (
                        <button
                            type="button"
                            onClick={people.toggle}
                            className="mx-4 mt-1 inline-flex min-h-9 items-center text-[13px] text-primary hover:underline"
                        >
                            {people.expanded
                                ? 'Tampilkan lebih sedikit'
                                : `Lihat semua ${attendance.people.length} anggota →`}
                        </button>
                    )}
                </Panel>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                {metrics ? (
                    <>
                        <Panel
                            id="workload"
                            title={
                                <>
                                    Beban kerja
                                    <MetricInfo
                                        definition={definitions.workload}
                                    />
                                </>
                            }
                            aside="tugas terbuka"
                        >
                            <WorkloadBars rows={metrics.workload} limit={8} />
                        </Panel>
                        <Panel
                            id="overdue"
                            title="Tugas terlambat"
                            aside={`${metrics.overdue.total} tugas`}
                            flush
                        >
                            <OverdueList items={metrics.overdue.items} />
                        </Panel>
                    </>
                ) : (
                    <>
                        <PanelSkeleton />
                        <PanelSkeleton />
                    </>
                )}
                <Panel
                    id="approvals"
                    title="Menunggu persetujuan Anda"
                    aside={String(approvals.count)}
                    flush
                >
                    <RequestRows
                        items={approvals.items}
                        showUser
                        hrefBase="/persetujuan"
                        empty="Tidak ada yang menunggu persetujuan Anda."
                    />
                    {approvals.count > 0 && (
                        <Link
                            href="/persetujuan"
                            className="mx-4 mt-1 inline-flex min-h-9 items-center text-[13px] text-primary hover:underline"
                        >
                            Lihat {approvals.count} pengajuan →
                        </Link>
                    )}
                </Panel>
            </div>

            {metrics ? (
                <Panel
                    id="projects"
                    title="Workspace proyek berisiko"
                    aside="status PIC Berisiko/Bermasalah atau update > 7 hari"
                    flush
                >
                    <AtRiskProjects projects={metrics.projects} />
                </Panel>
            ) : (
                <PanelSkeleton rows={2} />
            )}
        </div>
    );
}
