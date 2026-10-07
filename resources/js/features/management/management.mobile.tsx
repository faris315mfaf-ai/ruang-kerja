import { Link } from '@inertiajs/react';
import { ActionNotes } from '@/features/monitoring/action-notes';
import { formatTime } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import type { KpiCard } from './lib';
import {
    attentionCard,
    clampPercent,
    periodNote,
    shortDate,
    thirdCard,
} from './lib';
import { AgendaPanel, NotesPanel } from './meetings-panels';
import { MilestonesPanel, MilestonesPanelSkeleton } from './milestones-panel';
import { WorkloadPanel } from './workload-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { PANEL_ID, PeriodTabs, tabId } from './period-tabs';
import { ProjectsList, ProjectsPanelSkeleton } from './projects-panel';
import type { ManagementProps, PeriodBlock, PeriodKey } from './types';
import { WorkChart, WorkChartSkeleton } from './work-chart';
import { QuickMinutesButton } from '@/features/notes/quick-minutes-button';

const TASK_CAPTION: Record<PeriodKey, string> = {
    harian: 'tugas hari ini selesai',
    mingguan: 'tugas minggu lalu selesai',
    bulanan: 'tugas 4 minggu terakhir selesai',
};

/** Gradient hero: presence + tasks of the selected period (MgPDashboard). */
function Hero({
    period,
    block,
    today,
    generatedAt,
}: {
    period: PeriodKey;
    block: PeriodBlock;
    today: string;
    generatedAt: string;
}) {
    const attendance = block.attendance;
    // Today's presence lives in the Absensi module (keputusan pemilik 6 Okt 2026).
    const presence =
        attendance.kind === 'today'
            ? null
            : {
                  value: attendance.rate === null ? '–' : `${attendance.rate}%`,
                  caption: 'kehadiran rata-rata',
              };
    const progress = clampPercent(block.tasks.rate) ?? 0;

    return (
        <div className="flex flex-col gap-3 rounded-panel bg-grad-highlight p-[18px] text-on-brand shadow-glow">
            <span className="text-[15px] font-bold">
                {shortDate(today)} · per {formatTime(generatedAt)} ·{' '}
                {periodNote(period, block)}
            </span>
            <div
                className={cn(
                    'grid gap-3',
                    presence ? 'grid-cols-2' : 'grid-cols-1',
                )}
            >
                {presence && (
                    <span className="flex flex-col">
                        <span className="text-[36px] leading-[42px] font-extrabold">
                            {presence.value}
                        </span>
                        <span className="text-[15px]">{presence.caption}</span>
                    </span>
                )}
                <span className="flex flex-col">
                    <span className="text-[36px] leading-[42px] font-extrabold">
                        {block.tasks.done}/{block.tasks.planned}
                    </span>
                    <span className="text-[15px]">{TASK_CAPTION[period]}</span>
                </span>
            </div>
            <span
                role="progressbar"
                aria-label="Tugas selesai dari rencana"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="relative block h-2 rounded-full bg-on-brand/30"
            >
                <span
                    className="absolute inset-y-0 left-0 rounded-full bg-on-brand"
                    style={{ width: `${progress}%` }}
                />
            </span>
        </div>
    );
}

/** On-time rate (week/month) next to the attention tile; nothing for today. */
function SecondaryTile({
    period,
    block,
}: {
    period: PeriodKey;
    block: PeriodBlock;
}) {
    const card = thirdCard(period, block);

    return card ? <Tile card={card} /> : null;
}

/** Small KPI tile; a link when there is somewhere to go. */
function Tile({ card, href }: { card: KpiCard; href?: string }) {
    const warm = card.tone === 'warm';
    const className = cn(
        'flex min-w-0 flex-col gap-0.5 rounded-[20px] p-3.5',
        warm
            ? 'bg-grad-hangat text-on-brand'
            : 'border border-border bg-surface text-text',
    );
    const content = (
        <>
            <span
                className={cn(
                    'text-[15px] font-semibold',
                    !warm && 'text-text-muted',
                )}
            >
                {card.label}
            </span>
            <span
                className={cn(
                    'text-[28px] leading-[34px] font-extrabold',
                    card.alert && !warm && 'text-danger',
                )}
            >
                {card.value}
            </span>
            <span
                className={cn(
                    'text-[14px] leading-5',
                    !warm && 'text-text-muted',
                )}
            >
                {card.note}
            </span>
        </>
    );

    return href ? (
        <Link href={href} prefetch className={cn(className, focusRing)}>
            {content}
        </Link>
    ) : (
        <div className={className}>{content}</div>
    );
}

/** Phone (< 768px, design MgPDashboard): stacked cards, same data as desktop. */
export function ManagementMobile({
    props,
    period,
    onPeriodChange,
}: {
    props: ManagementProps;
    period: PeriodKey;
    onPeriodChange: (period: PeriodKey) => void;
}) {
    const { summary, portfolio } = props;
    const block = summary?.periods[period];

    return (
        <div className="flex flex-col gap-3 px-4 pt-4 pb-8">
            <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-extrabold tracking-[0.02em] text-link uppercase">
                    {props.company} · Manajemen
                </span>
                <h1 className="text-[26px] leading-8 font-extrabold tracking-[-0.02em]">
                    Ringkasan
                </h1>
            </div>

            <QuickMinutesButton mobile />
            <PeriodTabs
                value={period}
                onChange={onPeriodChange}
                className="w-full"
            />

            <div
                role="tabpanel"
                id={PANEL_ID}
                aria-labelledby={tabId(period)}
                className="flex flex-col gap-3"
            >
                {block && summary ? (
                    <Hero
                        period={period}
                        block={block}
                        today={props.today}
                        generatedAt={summary.generated_at}
                    />
                ) : (
                    <Skeleton className="h-[164px] rounded-panel" />
                )}

                <div className="grid grid-cols-2 gap-2.5">
                    {block ? (
                        <SecondaryTile period={period} block={block} />
                    ) : (
                        <Skeleton className="h-[112px] rounded-[20px]" />
                    )}
                    {portfolio ? (
                        <Tile
                            card={attentionCard(portfolio.attention)}
                            href={
                                props.can.portfolio ? '/portofolio' : undefined
                            }
                        />
                    ) : (
                        <Skeleton className="h-[112px] rounded-[20px]" />
                    )}
                </div>

                {block && summary ? (
                    <WorkChart
                        period={period}
                        block={block}
                        generatedAt={summary.generated_at}
                        compact
                        className="py-4"
                    />
                ) : (
                    <WorkChartSkeleton period={period} />
                )}
            </div>

            {portfolio ? (
                <ProjectsList
                    portfolio={portfolio}
                    canSeePortfolio={props.can.portfolio}
                />
            ) : (
                <ProjectsPanelSkeleton />
            )}

            {portfolio ? (
                <MilestonesPanel
                    milestones={portfolio.milestones}
                    canSeePortfolio={props.can.portfolio}
                    className="py-4"
                />
            ) : (
                <MilestonesPanelSkeleton />
            )}

            <WorkloadPanel workload={props.workload} className="py-4" />
            <ActionNotes notes={props.notes} today={props.today} compact />

            <AgendaPanel
                agenda={props.agenda}
                today={props.today}
                className="py-4"
            />
            <NotesPanel notes={props.minutes} className="py-4" />
        </div>
    );
}
