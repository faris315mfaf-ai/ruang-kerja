import { FolderKanban } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { cn } from '@/lib/utils';
import { HEALTH_TONES, shortDay, weekdayDay } from './lib';
import {
    AttendanceWidget,
    DecisionsPanel,
    FeedPanel,
    ProjectCard,
} from './sections';
import type { PortfolioProps, ProjectHealth } from './types';
import type { PortfolioActions } from './use-portfolio';

const CHIPS: { value: ProjectHealth | null; label: string }[] = [
    { value: null, label: 'Semua' },
    { value: 'off_track', label: 'Bermasalah' },
    { value: 'at_risk', label: 'Berisiko' },
    { value: 'on_track', label: 'Sesuai jalur' },
];

function Tile({
    label,
    value,
    note,
    tone,
    highlight,
}: {
    label: string;
    value: number;
    note: string;
    tone?: 'danger';
    highlight?: boolean;
}) {
    return (
        <div
            className={cn(
                'rounded-lg border p-3.5',
                highlight
                    ? 'border-primary/40 bg-primary/8'
                    : 'border-border bg-surface',
            )}
        >
            <p className="text-[13px] text-text-muted">{label}</p>
            <p className="mt-1 flex items-baseline gap-2">
                <span
                    className={cn(
                        'text-2xl font-semibold tnum',
                        tone === 'danger' && value > 0
                            ? 'text-danger'
                            : 'text-text',
                    )}
                >
                    {value}
                </span>
                <span className="truncate text-[13px] text-text-muted">
                    {note}
                </span>
            </p>
        </div>
    );
}

/** Mobile portfolio (mockup MDashboardDireksi): cards, no roadmap. */
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
    const decisionKeys = [
        ...new Set(decisions.map((item) => item.project.key)),
    ];
    const counts: Record<string, number> = {
        all: kpis.active.count,
        off_track: health.off_track,
        at_risk: health.at_risk,
        on_track: health.on_track,
    };

    return (
        <div className="space-y-4">
            <p className="-mt-2 text-[13px] text-text-muted">
                {props.period_label} · per {weekdayDay(props.as_of)}
            </p>

            <div
                className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden"
                role="group"
                aria-label="Status"
            >
                {CHIPS.map((chip) => {
                    const active = filters.status === chip.value;

                    return (
                        <button
                            key={chip.label}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                                actions.setFilter({ status: chip.value })
                            }
                            className={cn(
                                'flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[15px]',
                                active
                                    ? 'border-primary/50 bg-primary/12 text-text'
                                    : 'border-border bg-surface text-text-muted',
                            )}
                        >
                            {chip.value && (
                                <span
                                    className={cn(
                                        'size-2 rounded-full',
                                        HEALTH_TONES[chip.value].dot,
                                    )}
                                />
                            )}
                            {chip.label}
                            <span className="text-text-muted tnum">
                                {counts[chip.value ?? 'all']}
                            </span>
                        </button>
                    );
                })}
            </div>

            {attendance && <AttendanceWidget attendance={attendance} compact />}

            <div className="grid grid-cols-2 gap-3">
                <Tile
                    label="Milestone 2 minggu"
                    value={kpis.upcoming_milestones.count}
                    note={
                        kpis.upcoming_milestones.items[0]
                            ? `terdekat ${shortDay(kpis.upcoming_milestones.items[0].target_date)}`
                            : ''
                    }
                />
                <Tile
                    label="Milestone terlewat"
                    value={kpis.missed_milestones.count}
                    note={kpis.missed_milestones.items
                        .map((item) => item.key)
                        .join(' · ')}
                    tone="danger"
                />
                <Tile
                    label="Tugas proyek terlambat"
                    value={kpis.overdue_tasks.count}
                    note={`di ${kpis.overdue_tasks.projects} proyek`}
                />
                <Tile
                    label="Butuh keputusan Anda"
                    value={decisions.length}
                    note={
                        decisionKeys.length === 1
                            ? `${decisions.length > 1 ? 'keduanya ' : ''}${decisionKeys[0]}`
                            : decisionKeys.join(', ')
                    }
                    highlight={decisions.length > 0}
                />
            </div>

            {(decisions.length > 0 || attention.length > 0) && (
                <DecisionsPanel
                    decisions={decisions}
                    attention={attention}
                    canSteer={can.steer}
                    actions={actions}
                    compact
                />
            )}

            <section className="space-y-3">
                <header className="flex items-center justify-between">
                    <h2 className="text-[17px] font-semibold text-text">
                        Proyek aktif{' '}
                        <span className="font-normal text-text-muted">
                            {projects.length}
                        </span>
                    </h2>
                    <span className="flex items-center gap-1.5 text-[13px] text-text-muted">
                        <span
                            aria-hidden
                            className="h-3.5 w-0.5 rounded-full bg-text"
                        />
                        rencana per hari ini
                    </span>
                </header>
                {projects.length === 0 ? (
                    <EmptyState
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
