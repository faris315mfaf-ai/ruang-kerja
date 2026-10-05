import { Link } from '@inertiajs/react';
import { CircleCheck, Download, FolderKanban } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { summary } from '@/routes/projects';
import { HEALTH_LABELS, weekdayDay } from './lib';
import { Panel } from './parts';
import {
    AttendanceWidget,
    DecisionsPanel,
    FeedPanel,
    KpiRow,
    PortfolioFootnote,
    ProjectTable,
    RoadmapPanel,
} from './sections';
import type { PortfolioFilters, PortfolioProps, ProjectHealth } from './types';
import type { PortfolioActions } from './use-portfolio';

const PERIODS: { value: PortfolioFilters['periode']; label: string }[] = [
    { value: 'kuartal', label: 'Kuartal ini' },
    { value: 'bulan', label: 'Bulan ini' },
    { value: 'semua', label: 'Semua' },
];

const ALL = 'semua';

/** Dashboard Direksi = portofolio proyek (mockup DashboardDireksi). */
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
        <div className="space-y-5 print:space-y-3">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-xl leading-7 font-semibold text-text">
                        Portofolio proyek
                    </h1>
                    <p className="text-[13px] text-text-muted">
                        {props.period_label} · per {weekdayDay(props.as_of)}{' '}
                        {props.as_of.slice(0, 4)}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                    <div
                        role="group"
                        aria-label="Periode"
                        className="flex rounded-md border border-border bg-surface p-0.5"
                    >
                        {PERIODS.map((period) => (
                            <button
                                key={period.value}
                                type="button"
                                aria-pressed={filters.periode === period.value}
                                onClick={() =>
                                    actions.setFilter({ periode: period.value })
                                }
                                className={cn(
                                    'h-8 rounded px-3 text-[13px] transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                    filters.periode === period.value
                                        ? 'bg-surface-2 font-medium text-text'
                                        : 'text-text-muted hover:text-text',
                                )}
                            >
                                {period.label}
                            </button>
                        ))}
                    </div>
                    <Select
                        value={filters.divisi ?? ALL}
                        onValueChange={(value) =>
                            actions.setFilter({
                                divisi: value === ALL ? null : value,
                            })
                        }
                    >
                        <SelectTrigger
                            className="h-9 w-auto min-w-36 text-[13px]"
                            aria-label="Divisi"
                        >
                            <span className="text-text-muted">Divisi</span>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>Semua</SelectItem>
                            {props.division_options.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
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
                                    value === ALL
                                        ? null
                                        : (value as ProjectHealth),
                            })
                        }
                    >
                        <SelectTrigger
                            className="h-9 w-auto min-w-36 text-[13px]"
                            aria-label="Status"
                        >
                            <span className="text-text-muted">Status</span>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>Semua</SelectItem>
                            {(
                                Object.keys(HEALTH_LABELS) as ProjectHealth[]
                            ).map((health) => (
                                <SelectItem key={health} value={health}>
                                    {HEALTH_LABELS[health]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => window.print()}
                    >
                        <Download aria-hidden />
                        Ekspor ringkasan (PDF)
                    </Button>
                </div>
            </header>

            <KpiRow kpis={kpis} decisions={decisions} />

            <Panel
                title={
                    filters.arsip
                        ? 'Proyek selesai & dibatalkan'
                        : 'Proyek aktif'
                }
                count={projects.length}
                aside={
                    <span className="text-[12px] text-text-muted">
                        Urut: status, lalu target
                    </span>
                }
            >
                {projects.length === 0 ? (
                    <EmptyState
                        icon={FolderKanban}
                        title={
                            filters.arsip
                                ? 'Belum ada proyek selesai'
                                : 'Tidak ada proyek'
                        }
                        description="Ubah periode atau filter untuk melihat proyek lain."
                    />
                ) : (
                    <ProjectTable projects={projects} today={props.as_of} />
                )}
                <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[13px] text-text-muted">
                    <span className="flex items-center gap-1.5">
                        <CircleCheck
                            className="size-4 text-success"
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
                                            className="hover:underline"
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
                    <button
                        type="button"
                        className="shrink-0 text-primary hover:underline print:hidden"
                        onClick={() =>
                            actions.setFilter({ arsip: !filters.arsip })
                        }
                    >
                        {filters.arsip
                            ? 'Kembali ke proyek aktif'
                            : 'Lihat arsip'}
                    </button>
                </footer>
            </Panel>

            <RoadmapPanel roadmap={roadmap} />

            <div className="grid items-start gap-5 xl:grid-cols-2">
                <div className="space-y-5">
                    <DecisionsPanel
                        decisions={decisions}
                        attention={attention}
                        canSteer={can.steer}
                        actions={actions}
                    />
                    {attendance && <AttendanceWidget attendance={attendance} />}
                </div>
                <FeedPanel feed={feed} canSteer={can.steer} actions={actions} />
            </div>

            <PortfolioFootnote />
            {actions.dialogs}
        </div>
    );
}
