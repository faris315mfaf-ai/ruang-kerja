import { formatLongDate, formatTime } from '@/lib/format';
import { AttendancePanel, AttendancePanelSkeleton } from './attendance-panel';
import { KpiCardSkeleton, KpiCardView } from './kpi-cards';
import {
    attendanceCard,
    attentionCard,
    periodNote,
    tasksCard,
    thirdCard,
} from './lib';
import { AgendaPanel, NotesPanel } from './meetings-panels';
import { MilestonesPanel, MilestonesPanelSkeleton } from './milestones-panel';
import { PANEL_ID, PeriodTabs, tabId } from './period-tabs';
import { ProjectsPanel, ProjectsPanelSkeleton } from './projects-panel';
import type { ManagementProps, PeriodKey } from './types';
import { WorkChart, WorkChartSkeleton } from './work-chart';

/**
 * Desktop & tablet (design MgDashboard): sections are flex-wrap rows, so on
 * a tablet the 2:1 rows stack into single columns by themselves.
 */
export function ManagementDesktop({
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
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-5 pt-8 pb-10 md:px-8 lg:px-10 lg:pt-10">
            <section className="flex flex-wrap items-end justify-between gap-5">
                <div className="flex flex-col gap-2">
                    <span className="inline-flex h-8 items-center self-start rounded-2xl border border-arus-border bg-arus-badge px-3 text-[14px] font-extrabold text-arus-link">
                        {props.company} · Manajemen
                    </span>
                    <h1 className="text-[36px] leading-[44px] font-extrabold tracking-[-0.03em] lg:text-[44px] lg:leading-[52px]">
                        Ringkasan perusahaan
                    </h1>
                    <p className="text-[18px] text-arus-text-2">
                        {formatLongDate(props.today)} ·{' '}
                        {summary
                            ? `data per ${formatTime(summary.generated_at)}`
                            : 'memuat data…'}{' '}
                        · {periodNote(period, block)}
                    </p>
                </div>
                <PeriodTabs value={period} onChange={onPeriodChange} />
            </section>

            <div
                role="tabpanel"
                id={PANEL_ID}
                aria-labelledby={tabId(period)}
                className="flex flex-col gap-6"
            >
                <section
                    aria-label="Ringkasan"
                    className="flex flex-wrap gap-5"
                >
                    {block ? (
                        <>
                            <KpiCardView card={attendanceCard(block)} />
                            <KpiCardView card={tasksCard(period, block)} />
                            <KpiCardView card={thirdCard(period, block)} />
                        </>
                    ) : (
                        <>
                            <KpiCardSkeleton tone="highlight" />
                            <KpiCardSkeleton tone="plain" />
                            <KpiCardSkeleton tone="plain" />
                        </>
                    )}
                    {portfolio ? (
                        <KpiCardView
                            card={attentionCard(portfolio.attention)}
                        />
                    ) : (
                        <KpiCardSkeleton tone="warm" />
                    )}
                </section>

                <section className="flex flex-wrap items-stretch gap-5">
                    {block && summary ? (
                        <>
                            <WorkChart
                                period={period}
                                block={block}
                                generatedAt={summary.generated_at}
                                className="flex-[2_1_620px] px-1"
                            />
                            <AttendancePanel
                                attendance={summary.attendance}
                                className="flex-[1_1_360px]"
                            />
                        </>
                    ) : (
                        <>
                            <WorkChartSkeleton
                                period={period}
                                className="flex-[2_1_620px]"
                            />
                            <AttendancePanelSkeleton className="flex-[1_1_360px]" />
                        </>
                    )}
                </section>
            </div>

            <section className="flex flex-wrap items-start gap-5">
                {portfolio ? (
                    <>
                        <ProjectsPanel
                            portfolio={portfolio}
                            canSeePortfolio={props.can.portfolio}
                            className="flex-[2_1_620px]"
                        />
                        <MilestonesPanel
                            milestones={portfolio.milestones}
                            canSeePortfolio={props.can.portfolio}
                            className="flex-[1_1_360px]"
                        />
                    </>
                ) : (
                    <>
                        <ProjectsPanelSkeleton className="flex-[2_1_620px]" />
                        <MilestonesPanelSkeleton className="flex-[1_1_360px]" />
                    </>
                )}
            </section>

            <section className="flex flex-wrap items-stretch gap-5">
                <AgendaPanel
                    agenda={props.agenda}
                    today={props.today}
                    className="flex-[1_1_420px]"
                />
                <NotesPanel notes={props.notes} className="flex-[1_1_420px]" />
            </section>
        </div>
    );
}
