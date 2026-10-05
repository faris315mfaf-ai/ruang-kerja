import { FolderKanban } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { MetricKpi, SectionHeader } from '@/features/dashboard/dashboard-ui';
import { DecisionsPanel } from './decisions-panel';
import { AttendanceWidget, FeedPanel } from './feed-panel';
import { decisionNote } from './kpi-row';
import { shortDay, weekdayDay } from './lib';
import { ProjectCard } from './project-table';
import type { PortfolioProps, ProjectHealth } from './types';
import type { PortfolioActions } from './use-portfolio';

type StatusChip = ProjectHealth | 'all';

/** Phone KPI tile. */
const TILE = 'gap-0.5 rounded-card px-4 py-3.5 shadow-none';

/**
 * Phone portfolio (PDirutPortofolio / PeranMDirut): status chips, KPI tiles,
 * decisions, project cards with a progress ring, PIC updates. No roadmap.
 */
export function PortfolioMobile({
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
        decisions,
        attention,
        feed,
        attendance,
        can,
    } = props;
    const health = kpis.active.health;

    return (
        <div className="flex flex-col gap-3.5 pb-4">
            <p className="px-1 text-label font-normal text-text-muted">
                {kpis.active.count} proyek aktif · {props.period_label} · per{' '}
                {weekdayDay(props.as_of)}
            </p>

            <ChipScroller<StatusChip>
                label="Status"
                value={filters.status ?? 'all'}
                onChange={(value) =>
                    actions.setFilter({
                        status: value === 'all' ? null : value,
                    })
                }
                chips={[
                    { value: 'all', label: 'Semua', count: kpis.active.count },
                    {
                        value: 'off_track',
                        label: 'Bermasalah',
                        count: health.off_track,
                    },
                    {
                        value: 'at_risk',
                        label: 'Berisiko',
                        count: health.at_risk,
                    },
                    {
                        value: 'on_track',
                        label: 'Sesuai jalur',
                        count: health.on_track,
                    },
                ]}
            />

            {attendance && <AttendanceWidget attendance={attendance} compact />}

            <section
                aria-label="Ringkasan"
                className="grid grid-cols-2 gap-2.5"
            >
                <MetricKpi
                    tone={decisions.length > 0 ? 'warm' : 'plain'}
                    // Only a link while the panel below is rendered.
                    href={
                        decisions.length > 0 || attention.length > 0
                            ? '#keputusan'
                            : undefined
                    }
                    linkLabel={`${decisions.length} butuh keputusan Anda`}
                    label="Butuh keputusan"
                    value={decisions.length}
                    note={decisionNote(decisions)}
                    className="col-span-2"
                    cardClassName={TILE}
                />
                <MetricKpi
                    label="Milestone 2 minggu"
                    value={kpis.upcoming_milestones.count}
                    note={
                        kpis.upcoming_milestones.items[0]
                            ? `terdekat ${shortDay(kpis.upcoming_milestones.items[0].target_date)}`
                            : 'tidak ada'
                    }
                    cardClassName={TILE}
                />
                <MetricKpi
                    label="Milestone terlewat"
                    value={kpis.missed_milestones.count}
                    valueClassName={
                        kpis.missed_milestones.count > 0
                            ? 'text-danger'
                            : undefined
                    }
                    note={
                        kpis.missed_milestones.items
                            .map((item) => item.key)
                            .join(' · ') || 'tidak ada'
                    }
                    cardClassName={TILE}
                />
                <MetricKpi
                    label="Tugas terlambat"
                    value={kpis.overdue_tasks.count}
                    valueClassName={
                        kpis.overdue_tasks.count > 0 ? 'text-danger' : undefined
                    }
                    note={`di ${kpis.overdue_tasks.projects} proyek`}
                    className="col-span-2"
                    cardClassName={TILE}
                />
            </section>

            {(decisions.length > 0 || attention.length > 0) && (
                <DecisionsPanel
                    decisions={decisions}
                    attention={attention}
                    canSteer={can.steer}
                    actions={actions}
                    compact
                />
            )}

            <section
                aria-labelledby="projects-heading"
                className="flex flex-col gap-2.5"
            >
                <SectionHeader
                    id="projects-heading"
                    title={`Proyek aktif · ${projects.length}`}
                />
                {projects.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={FolderKanban}
                        title="Tidak ada proyek"
                        description="Tidak ada proyek dengan status ini."
                    />
                ) : (
                    projects.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                    ))
                )}
            </section>

            <FeedPanel
                feed={feed}
                canSteer={can.steer}
                actions={actions}
                compact
            />
            {actions.dialogs}
        </div>
    );
}
