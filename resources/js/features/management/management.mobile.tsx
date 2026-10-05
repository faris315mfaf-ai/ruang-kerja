import { Link } from '@inertiajs/react';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AttendancePanel, AttendancePanelSkeleton } from './attendance-panel';
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
import { ArusSkeleton, FOCUS_RING } from './panel';
import { PANEL_ID, PeriodTabs, tabId } from './period-tabs';
import { ProjectsList, ProjectsPanelSkeleton } from './projects-panel';
import type { ManagementProps, PeriodBlock, PeriodKey } from './types';
import { WorkChart, WorkChartSkeleton } from './work-chart';

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
    const presence =
        attendance.kind === 'today'
            ? {
                  value:
                      attendance.scheduled === 0
                          ? '–'
                          : `${attendance.present}/${attendance.scheduled}`,
                  caption:
                      attendance.rate === null
                          ? 'tidak ada jadwal hari ini'
                          : `hadir · ${attendance.rate}%`,
              }
            : {
                  value: attendance.rate === null ? '–' : `${attendance.rate}%`,
                  caption: 'kehadiran rata-rata',
              };
    const progress = clampPercent(block.tasks.rate) ?? 0;

    return (
        <div className="flex flex-col gap-3 rounded-arus-panel bg-arus-highlight p-[18px] text-arus-on-gradient shadow-arus-action">
            <span className="text-[15px] font-bold">
                {shortDate(today)} · per {formatTime(generatedAt)} ·{' '}
                {periodNote(period, block)}
            </span>
            <div className="grid grid-cols-2 gap-3">
                <span className="flex flex-col">
                    <span className="text-[36px] leading-[42px] font-extrabold">
                        {presence.value}
                    </span>
                    <span className="text-[15px]">{presence.caption}</span>
                </span>
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
                className="relative block h-2 rounded-full bg-arus-on-gradient/30"
            >
                <span
                    className="absolute inset-y-0 left-0 rounded-full bg-arus-on-gradient"
                    style={{ width: `${progress}%` }}
                />
            </span>
        </div>
    );
}

/** Small KPI tile; a link when there is somewhere to go. */
function Tile({ card, href }: { card: KpiCard; href?: string }) {
    const warm = card.tone === 'warm';
    const className = cn(
        'flex min-w-0 flex-col gap-0.5 rounded-[20px] p-3.5',
        warm
            ? 'bg-arus-warm text-arus-on-gradient'
            : 'border border-arus-border bg-arus-surface text-arus-text',
    );
    const content = (
        <>
            <span
                className={cn(
                    'text-[15px] font-semibold',
                    !warm && 'text-arus-text-2',
                )}
            >
                {card.label}
            </span>
            <span
                className={cn(
                    'text-[28px] leading-[34px] font-extrabold',
                    card.alert && !warm && 'text-arus-danger',
                )}
            >
                {card.value}
            </span>
            <span
                className={cn(
                    'text-[14px] leading-5',
                    !warm && 'text-arus-text-2',
                )}
            >
                {card.note}
            </span>
        </>
    );

    return href ? (
        <Link href={href} prefetch className={cn(className, FOCUS_RING)}>
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
                <span className="text-[14px] font-extrabold tracking-[0.02em] text-arus-link uppercase">
                    {props.company} · Manajemen
                </span>
                <h1 className="text-[26px] leading-8 font-extrabold tracking-[-0.02em]">
                    Ringkasan
                </h1>
            </div>

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
                    <ArusSkeleton className="h-[164px] rounded-arus-panel" />
                )}

                <div className="grid grid-cols-2 gap-2.5">
                    {block ? (
                        <Tile card={thirdCard(period, block)} />
                    ) : (
                        <ArusSkeleton className="h-[112px] rounded-[20px]" />
                    )}
                    {portfolio ? (
                        <Tile
                            card={attentionCard(portfolio.attention)}
                            href={
                                props.can.portfolio ? '/portofolio' : undefined
                            }
                        />
                    ) : (
                        <ArusSkeleton className="h-[112px] rounded-[20px]" />
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

            {summary ? (
                <AttendancePanel
                    attendance={summary.attendance}
                    className="py-4"
                />
            ) : (
                <AttendancePanelSkeleton />
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

            <AgendaPanel
                agenda={props.agenda}
                today={props.today}
                className="py-4"
            />
            <NotesPanel notes={props.notes} className="py-4" />
        </div>
    );
}
