import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/features/dashboard/dashboard-ui';
import { ViewPicker } from '@/features/dashboard/view-picker';
import { formatLongDate } from '@/lib/format';
import { ActionNotes } from './action-notes';
import { DailyPanel } from './daily-panel';
import { ProjectsPanel } from './projects-panel';
import type { DireksiViewProps } from './direksi-page';
import { WeeklyPanel } from './weekly-panel';
import { WorkspaceGrid } from './workspace-grid';

/**
 * Dashboard Direksi, desktop & tablet (keputusan pemilik 6 Okt 2026):
 * daily monitoring next to the action notes, the weekly matrix, projects
 * and quick access to every workspace.
 */
export function DireksiDesktop({
    props,
    query,
    openReport,
    openReportId,
}: DireksiViewProps) {
    const { monitoring } = props;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                overline={formatLongDate(monitoring.today)}
                title="Monitoring kerja"
                subtitle={`${props.scope.label} · ${props.scope.member_count} karyawan aktif`}
            >
                <Button asChild variant="outline">
                    <a href={props.exportUrl} download>
                        <Download aria-hidden />
                        Ekspor
                    </a>
                </Button>
            </PageHeader>
            <ViewPicker views={props.views} />

            <section className="flex flex-wrap items-start gap-5">
                <DailyPanel
                    daily={props.daily}
                    date={monitoring.date}
                    today={monitoring.today}
                    loading={query.loading === 'daily'}
                    onDateChange={query.setDate}
                    onOpenReport={openReport}
                    className="min-w-0 flex-[1.6_1_560px]"
                />
                <ActionNotes
                    notes={props.notes}
                    today={monitoring.today}
                    className="min-w-0 flex-[1_1_340px]"
                />
            </section>

            <WeeklyPanel
                weekly={props.weekly}
                loading={query.loading === 'weekly'}
                onWeekChange={query.setWeek}
                onOpenReport={openReportId}
            />

            <ProjectsPanel
                projects={props.projects}
                weekLabel={props.weekly?.week.label}
            />

            <WorkspaceGrid workspaces={props.workspaces} />
        </div>
    );
}
