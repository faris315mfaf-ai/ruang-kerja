import { usePage } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelLink } from '@/components/ui/panel';
import { formatLongDate } from '@/lib/format';
import { AtRiskProjects } from './at-risk-projects';
import {
    AttendanceBar,
    AttendancePeople,
    StateLegend,
} from './attendance-today';
import { ComparedNote } from './compared-note';
import {
    KpiSkeleton,
    PageHeader,
    PanelHint,
    PanelSkeleton,
} from './dashboard-ui';
import { DivisionKpis, SecondaryKpis, useExpandable } from './division-parts';
import type { DivisionProps } from './division-types';
import { FilterBar } from './filter-bar';
import { LiveBadge } from './live-badge';
import { greeting } from './lib';
import { MetricInfo } from './metric-info';
import { OverdueList } from './overdue-list';
import { RequestRows } from './request-rows';
import { TeamReportsPanel } from './team-reports';
import { TrendChart } from './trend-chart';
import { ViewPicker } from './view-picker';
import { WorkloadBars } from './workload-bars';

/** "Divisi Operasional · 14 anggota · 5 menunggu Anda" (DBeranda). */
export function divisionSubtitle(props: DivisionProps): string {
    return [
        props.scope.label,
        `${props.scope.member_count} anggota`,
        props.approvals.count > 0
            ? `${props.approvals.count} menunggu persetujuan Anda`
            : null,
    ]
        .filter(Boolean)
        .join(' · ');
}

/** Dashboard Kepala Divisi, desktop & tablet (design DBeranda). */
export function DivisionDesktop({
    live,
    ...props
}: DivisionProps & { live: boolean }) {
    const { auth } = usePage().props;
    const { metrics, attendance, approvals, definitions } = props;
    const people = useExpandable(4);
    const firstName = auth.user?.name.split(' ')[0] ?? '';

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                overline={formatLongDate(props.today)}
                title={`${greeting()}, ${firstName}`}
                subtitle={divisionSubtitle(props)}
            >
                <FilterBar
                    filters={props.filters}
                    exportUrl={props.exportUrl}
                />
            </PageHeader>
            <ViewPicker views={props.views} />

            <section aria-label="Ringkasan" className="flex flex-col gap-5">
                <div className="flex flex-wrap gap-5">
                    <DivisionKpis props={props} />
                    {!metrics &&
                        Array.from({ length: 3 }, (_, index) => (
                            <KpiSkeleton
                                key={index}
                                className="flex-[1_1_240px]"
                            />
                        ))}
                </div>
                {metrics && (
                    <div className="grid gap-5 md:grid-cols-3">
                        <SecondaryKpis
                            metrics={metrics}
                            definitions={definitions}
                            previousLabel={props.filters.period.previous_label}
                        />
                    </div>
                )}
                {metrics && <ComparedNote compared={metrics.compared} />}
            </section>

            <section className="flex flex-wrap items-start gap-5">
                <div className="flex min-w-0 flex-[2_1_620px] flex-col gap-5">
                    {metrics ? (
                        <Panel
                            title={
                                <>
                                    Tren penyelesaian
                                    <MetricInfo
                                        definition={definitions.completion_rate}
                                    />
                                </>
                            }
                            bodyClassName="gap-6"
                        >
                            <p className="-mt-2 text-label font-normal text-text-muted">
                                Persentase tugas bertenggat yang selesai, 8
                                minggu terakhir
                            </p>
                            <TrendChart
                                points={metrics.trend}
                                description="Tingkat penyelesaian per minggu"
                                numeratorLabel="selesai"
                                denominatorLabel="bertenggat"
                            />
                        </Panel>
                    ) : (
                        <PanelSkeleton title="Tren penyelesaian" rows={5} />
                    )}

                    {metrics ? (
                        <>
                            <Panel
                                title={
                                    <>
                                        Beban kerja
                                        <MetricInfo
                                            definition={definitions.workload}
                                        />
                                    </>
                                }
                                action={
                                    <PanelHint>
                                        tugas terbuka · terlambat
                                    </PanelHint>
                                }
                            >
                                <WorkloadBars
                                    rows={metrics.workload}
                                    limit={8}
                                />
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
                                className="pb-2"
                            >
                                <OverdueList
                                    items={metrics.overdue.items}
                                    className="border-t border-divider"
                                />
                            </Panel>
                        </>
                    ) : (
                        <>
                            <PanelSkeleton title="Beban kerja" />
                            <PanelSkeleton title="Tugas terlambat" />
                        </>
                    )}
                </div>

                <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
                    <Panel
                        title="Kehadiran hari ini"
                        action={<LiveBadge live={live} />}
                        bodyClassName="gap-4"
                    >
                        <AttendanceBar data={attendance} className="mt-2" />
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

                    <TeamReportsPanel reports={props.reports} />

                    <Panel
                        title={
                            <>
                                Menunggu persetujuan
                                <Badge className="h-7 px-2.5 text-[15px]">
                                    {approvals.count}
                                </Badge>
                            </>
                        }
                        flush
                        className="pb-3"
                    >
                        <RequestRows
                            items={approvals.items}
                            showUser
                            hrefBase="/persetujuan"
                            empty="Tidak ada yang menunggu persetujuan Anda."
                        />
                        {approvals.count > 0 && (
                            <div className="border-t border-divider px-6 pt-3 md:px-7">
                                <PanelLink href="/persetujuan">
                                    Lihat {approvals.count} pengajuan
                                </PanelLink>
                            </div>
                        )}
                    </Panel>
                </div>
            </section>

            {metrics ? (
                <Panel
                    title="Workspace proyek berisiko"
                    action={
                        <PanelHint>
                            status PIC Berisiko/Bermasalah atau update &gt; 7
                            hari
                        </PanelHint>
                    }
                    flush
                    className="pb-2"
                >
                    <AtRiskProjects projects={metrics.projects} />
                </Panel>
            ) : (
                <PanelSkeleton title="Workspace proyek berisiko" rows={2} />
            )}
        </div>
    );
}
