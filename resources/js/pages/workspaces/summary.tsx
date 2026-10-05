import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import type { ProjectSummaryProps } from '@/features/portfolio/types';
import {
    ProjectHeaderDesktop,
    ProjectHeaderMobile,
} from '@/features/projects/project-header';
import { SummaryDesktop } from '@/features/projects/summary.desktop';
import { SummaryMobile } from '@/features/projects/summary.mobile';
import { useProjectSummary } from '@/features/projects/use-project-summary';
import { workspaceLayout } from '@/features/workspaces/tab-layout';
import type { WorkspacePageProps } from '@/features/workspaces/types';
import { WorkspaceShell } from '@/features/workspaces/workspace-shell';
import { useBreakpoint } from '@/hooks/use-breakpoint';

type Props = WorkspacePageProps & ProjectSummaryProps;

/** Tab Ringkasan of a project workspace (mockups ProyekDetail / MProyekDetail). */
export default function ProjectSummaryPage(props: Props) {
    const breakpoint = useBreakpoint();
    const actions = useProjectSummary(props, props.members);
    const mobile = breakpoint === 'mobile';
    const Header = mobile ? ProjectHeaderMobile : ProjectHeaderDesktop;

    return (
        <>
            <Head title={`${props.workspace.name} · Ringkasan`} />
            <WorkspaceShell
                {...props}
                tab="summary"
                header={
                    <Header
                        workspace={props.workspace}
                        props={props}
                        actions={actions}
                    />
                }
            >
                {breakpoint === null ? (
                    <div className="space-y-4" aria-busy>
                        <Skeleton className="h-28 w-full" />
                        <Skeleton className="h-72 w-full" />
                    </div>
                ) : mobile ? (
                    <SummaryMobile props={props} actions={actions} />
                ) : (
                    <SummaryDesktop props={props} actions={actions} />
                )}
            </WorkspaceShell>
            {actions.dialogs}
        </>
    );
}

ProjectSummaryPage.layout = (props: Props) => {
    const layout = workspaceLayout(props, 'Ringkasan');

    // Direksi come from the portfolio: "Portofolio proyek / Nama proyek".
    return {
        ...layout,
        breadcrumbs: props.project_can.steer
            ? [
                  { title: 'Portofolio proyek', href: '/portofolio' },
                  { title: props.workspace.name, href: '' },
              ]
            : layout.breadcrumbs,
        title: props.workspace.key,
        back: props.project_can.steer ? '/portofolio' : layout.back,
    };
};
