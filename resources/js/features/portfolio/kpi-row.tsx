import { MetricKpi } from '@/features/dashboard/dashboard-ui';
import { cn } from '@/lib/utils';
import { HEALTH_TONES, shortDay } from './lib';
import type { DecisionItem, PortfolioKpis } from './types';

/** Metric definitions shown by the info buttons (PRD M10). */
export const DEFINITIONS = {
    active: 'Proyek berstatus berjalan/direncanakan/ditunda dalam periode ini, dikelompokkan menurut status dari PIC.',
    upcoming: 'Milestone belum selesai dengan target dalam 14 hari ke depan.',
    missed: 'Milestone yang target tanggalnya sudah lewat dan belum ditandai selesai.',
    overdue:
        'Tugas belum selesai (bukan Selesai/Dibatalkan) dengan tenggat sebelum hari ini, di proyek aktif.',
    decisions:
        'Update PIC yang meminta keputusan Direksi dan belum ditandai selesai.',
    progress:
        'Progres = tugas selesai ÷ tugas non-batal (berbobot estimasi jam bila ≥ 80% tugas punya estimasi). Garis = rencana: waktu berjalan ÷ durasi proyek.',
};

const HEALTH_KEYS = ['on_track', 'at_risk', 'off_track'] as const;

function joinDated(items: { key: string; target_date: string }[]) {
    return items
        .map((item) => `${shortDay(item.target_date)} ${item.key}`)
        .join(' · ');
}

/** "Semua dari PLQ · tinjau di bawah". */
export function decisionNote(decisions: DecisionItem[]): string {
    const keys = [...new Set(decisions.map((item) => item.project.key))];

    if (decisions.length === 0) {
        return 'Tidak ada keputusan tertunda';
    }

    return keys.length === 1
        ? `${decisions.length > 1 ? 'Semua dari' : 'Dari'} ${keys[0]} · tinjau di bawah`
        : `Dari ${keys.join(', ')} · tinjau di bawah`;
}

/** Health split bar of the active projects (3 sesuai · 2 berisiko · 1 …). */
export function HealthSplit({
    health,
    className,
}: {
    health: PortfolioKpis['active']['health'];
    className?: string;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex h-2.5 gap-[3px] overflow-hidden rounded-full bg-surface-2',
                className,
            )}
        >
            {HEALTH_KEYS.filter((key) => health[key] > 0).map((key) => (
                <span
                    key={key}
                    className={HEALTH_TONES[key].bar}
                    style={{ flexGrow: health[key], flexBasis: 0 }}
                />
            ))}
        </span>
    );
}

/** KPI row (DPortofolio "Ringkasan"). */
export function KpiRow({
    kpis,
    decisions,
}: {
    kpis: PortfolioKpis;
    decisions: DecisionItem[];
}) {
    const health = kpis.active.health;

    return (
        <section aria-label="Ringkasan" className="flex flex-wrap gap-5">
            <MetricKpi
                tone={decisions.length > 0 ? 'warm' : 'plain'}
                href="#keputusan"
                linkLabel={`${decisions.length} butuh keputusan Anda, tinjau di bawah`}
                label="Butuh keputusan Anda"
                value={decisions.length}
                note={decisionNote(decisions)}
                className="flex-[1.2_1_240px]"
            />
            <MetricKpi
                label="Proyek aktif"
                definition={DEFINITIONS.active}
                value={kpis.active.count}
                note={[
                    `${health.on_track} sesuai jalur`,
                    `${health.at_risk} berisiko`,
                    `${health.off_track} bermasalah`,
                    health.none > 0 ? `${health.none} belum ada update` : null,
                ]
                    .filter(Boolean)
                    .join(' · ')}
                className="flex-[1.3_1_260px]"
                bar={<HealthSplit health={health} />}
            />
            <MetricKpi
                label="Milestone 2 minggu ke depan"
                definition={DEFINITIONS.upcoming}
                value={kpis.upcoming_milestones.count}
                note={joinDated(kpis.upcoming_milestones.items) || 'Tidak ada'}
                className="flex-[1_1_190px]"
            />
            <MetricKpi
                label="Milestone terlewat"
                definition={DEFINITIONS.missed}
                value={kpis.missed_milestones.count}
                valueClassName={
                    kpis.missed_milestones.count > 0 ? 'text-danger' : undefined
                }
                note={
                    kpis.missed_milestones.items
                        .map((item) => `${item.name} ${item.key}`)
                        .join(' · ') || 'Tidak ada'
                }
                className="flex-[1_1_190px]"
            />
            <MetricKpi
                label="Tugas proyek terlambat"
                definition={DEFINITIONS.overdue}
                value={kpis.overdue_tasks.count}
                valueClassName={
                    kpis.overdue_tasks.count > 0 ? 'text-danger' : undefined
                }
                note={`di ${kpis.overdue_tasks.projects} dari ${kpis.overdue_tasks.total_projects} proyek${
                    kpis.overdue_tasks.top
                        ? ` · terbanyak ${kpis.overdue_tasks.top.key} (${kpis.overdue_tasks.top.count})`
                        : ''
                }`}
                className="flex-[1_1_190px]"
            />
        </section>
    );
}
