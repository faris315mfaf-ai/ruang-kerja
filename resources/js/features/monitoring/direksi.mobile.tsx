import { useState } from 'react';
import { SegmentedTabs } from '@/components/ui/tabs';
import { ViewPicker } from '@/features/dashboard/view-picker';
import { formatLongDate } from '@/lib/format';
import { ActionNotes } from './action-notes';
import { DailyPanel } from './daily-panel';
import { MOBILE_TABS } from './direksi-page';
import type { DireksiViewProps, MobileTab } from './direksi-page';
import { ProjectsPanel } from './projects-panel';
import { WeeklyPanel } from './weekly-panel';
import { WorkspaceGrid } from './workspace-grid';
import { QuickMinutesButton } from '@/features/notes/quick-minutes-button';

const PANEL_ID = 'direksi-panel';

/**
 * Dashboard Direksi on phones (keputusan pemilik 6 Okt 2026): tabs Harian ·
 * Mingguan · Proyek · Catatan with stacked cards; quick workspace access
 * sits under Proyek. Export stays on desktop.
 */
export function DireksiMobile({
    props,
    query,
    openReport,
    openReportId,
}: DireksiViewProps) {
    const [tab, setTab] = useState<MobileTab>('harian');
    const { monitoring } = props;

    return (
        <div className="flex flex-col gap-3.5 pb-4">
            <div className="flex flex-col gap-1 px-1">
                <p className="text-overline text-link">
                    {formatLongDate(monitoring.today)}
                </p>
                <p className="text-title">Monitoring kerja</p>
                <p className="text-meta text-text-muted">
                    {props.scope.label} · {props.scope.member_count} karyawan
                    aktif
                </p>
            </div>
            <ViewPicker views={props.views} />
            <QuickMinutesButton mobile />
            <SegmentedTabs
                label="Bagian monitoring"
                value={tab}
                onValueChange={setTab}
                options={MOBILE_TABS.map((item) => ({
                    ...item,
                    id: `direksi-tab-${item.value}`,
                    controls: PANEL_ID,
                }))}
                className="w-full [&>button]:flex-1 [&>button]:px-2"
            />
            <div
                id={PANEL_ID}
                role="tabpanel"
                aria-labelledby={`direksi-tab-${tab}`}
                className="flex flex-col gap-3.5"
            >
                {tab === 'harian' && (
                    <DailyPanel
                        daily={props.daily}
                        date={monitoring.date}
                        today={monitoring.today}
                        loading={query.loading === 'daily'}
                        onDateChange={query.setDate}
                        onOpenReport={openReport}
                        compact
                    />
                )}
                {tab === 'mingguan' && (
                    <WeeklyPanel
                        weekly={props.weekly}
                        loading={query.loading === 'weekly'}
                        onWeekChange={query.setWeek}
                        onOpenReport={openReportId}
                        compact
                    />
                )}
                {tab === 'proyek' && (
                    <>
                        <ProjectsPanel
                            projects={props.projects}
                            weekLabel={props.weekly?.week.label}
                            compact
                        />
                        <WorkspaceGrid workspaces={props.workspaces} compact />
                    </>
                )}
                {tab === 'catatan' && (
                    <ActionNotes
                        notes={props.notes}
                        today={monitoring.today}
                        compact
                    />
                )}
            </div>
        </div>
    );
}
