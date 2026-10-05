import { Link } from '@inertiajs/react';
import { CircleCheck, Download, FolderKanban } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PageHeader, PanelHint } from '@/features/dashboard/dashboard-ui';
import { Segmented } from '@/features/dashboard/filter-bar';
import { summary } from '@/routes/projects';
import { DecisionsPanel } from './decisions-panel';
import { AttendanceWidget, FeedPanel, PortfolioFootnote } from './feed-panel';
import { KpiRow } from './kpi-row';
import { HEALTH_LABELS, weekdayDay } from './lib';
import { ProjectTable } from './project-table';
import { RoadmapPanel } from './roadmap-panel';
import type { PortfolioFilters, PortfolioProps, ProjectHealth } from './types';
import type { PortfolioActions } from './use-portfolio';

const PERIODS: { value: PortfolioFilters['periode']; label: string }[] = [
    { value: 'kuartal', label: 'Kuartal ini' },
    { value: 'bulan', label: 'Bulan ini' },
    { value: 'semua', label: 'Semua' },
];

const ALL = 'semua';

/** Dashboard Direksi = portofolio proyek (design DPortofolio). */
export function PortfolioDesktop({
    props,
    actions,
}: {
    props: PortfolioProps;
    actions: PortfolioActions;
}) {
    const {
        filters,
        kpis,
        projects,
        completed,
        roadmap,
        decisions,
        attention,
        feed,
        attendance,
        can,
    } = props;

    return (
        <div className="flex flex-col gap-6 print:gap-3">
            <PageHeader
                overline={`${props.period_label} · per ${weekdayDay(props.as_of)} ${props.as_of.slice(0, 4)}`}
                title="Portofolio proyek"
                subtitle={`${kpis.active.count} proyek aktif · ${decisions.length} butuh keputusan Anda`}
            >
                <div className="flex flex-wrap items-center gap-3 print:hidden">
                    <Segmented
                        label="Periode"
                        options={PERIODS}
                        value={filters.periode}
                        onChange={(value) =>
                            actions.setFilter({ periode: value })
                        }
                    />
                    <Button variant="outline" onClick={() => window.print()}>
                        <Download aria-hidden />
                        Ekspor PDF
                    </Button>
                </div>
            </PageHeader>

            <div className="flex flex-wrap items-center gap-3 print:hidden">
                <Select
                    value={filters.divisi ?? ALL}
                    onValueChange={(value) =>
                        actions.setFilter({
                            divisi: value === ALL ? null : value,
                        })
                    }
                >
                    <SelectTrigger
                        className="w-auto min-w-48"
                        aria-label="Divisi"
                    >
                        <span className="text-text-muted">Divisi</span>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>Semua</SelectItem>
                        {props.division_options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={filters.status ?? ALL}
                    onValueChange={(value) =>
                        actions.setFilter({
                            status:
                                value === ALL ? null : (value as ProjectHealth),
                        })
                    }
                >
                    <SelectTrigger
                        className="w-auto min-w-48"
                        aria-label="Status"
                    >
                        <span className="text-text-muted">Status</span>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>Semua</SelectItem>
                        {(Object.keys(HEALTH_LABELS) as ProjectHealth[]).map(
                            (health) => (
                                <SelectItem key={health} value={health}>
                                    {HEALTH_LABELS[health]}
                                </SelectItem>
                            ),
                        )}
                    </SelectContent>
                </Select>
            </div>

            <KpiRow kpis={kpis} decisions={decisions} />

            <Panel
                title={
                    <>
                        {filters.arsip
                            ? 'Proyek selesai & dibatalkan'
                            : 'Proyek aktif'}
                        <span className="text-label font-normal text-text-muted tnum">
                            {projects.length}
                        </span>
                    </>
                }
                action={
                    <PanelHint>
                        Urut: status, lalu target · garis hitam = rencana hari
                        ini
                    </PanelHint>
                }
                flush
                className="pb-0"
            >
                {projects.length === 0 ? (
                    <div className="px-6 pb-4 md:px-7">
                        <EmptyState
                            size="sm"
                            icon={FolderKanban}
                            title={
                                filters.arsip
                                    ? 'Belum ada proyek selesai'
                                    : 'Tidak ada proyek'
                            }
                            description="Ubah periode atau filter untuk melihat proyek lain."
                        />
                    </div>
                ) : (
                    <ProjectTable projects={projects} today={props.as_of} />
                )}
                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-6 py-2 text-label font-normal text-text-muted md:px-7">
                    <span className="flex items-center gap-2">
                        <CircleCheck
                            className="size-4 shrink-0 text-success"
                            aria-hidden
                        />
                        {completed.length > 0 ? (
                            <span>
                                {completed.length} proyek selesai
                                {completed[0]?.quarter &&
                                    ` di ${[...new Set(completed.map((item) => item.quarter))].join(' & ')}`}
                                {' · '}
                                {completed.map((project, index) => (
                                    <span key={project.id}>
                                        {index > 0 ? ', ' : ''}
                                        <Link
                                            href={summary.url(project.key)}
                                            className="text-link hover:underline"
                                        >
                                            {project.name}
                                        </Link>
                                    </span>
                                ))}
                            </span>
                        ) : (
                            'Belum ada proyek selesai baru-baru ini'
                        )}
                    </span>
                    <Button
                        type="button"
                        variant="quiet"
                        className="shrink-0 print:hidden"
                        onClick={() =>
                            actions.setFilter({ arsip: !filters.arsip })
                        }
                    >
                        {filters.arsip
                            ? 'Kembali ke proyek aktif'
                            : 'Lihat arsip'}
                    </Button>
                </footer>
            </Panel>

            <RoadmapPanel roadmap={roadmap} />

            <section className="flex flex-wrap items-start gap-5">
                <DecisionsPanel
                    decisions={decisions}
                    attention={attention}
                    canSteer={can.steer}
                    actions={actions}
                    className="min-w-0 flex-[2_1_600px]"
                />
                <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
                    {attendance && <AttendanceWidget attendance={attendance} />}
                    <FeedPanel
                        feed={feed}
                        canSteer={can.steer}
                        actions={actions}
                    />
                </div>
            </section>

            <PortfolioFootnote />
            {actions.dialogs}
        </div>
    );
}
