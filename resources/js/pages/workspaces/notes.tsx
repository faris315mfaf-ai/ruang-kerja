import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import type { WorkspaceNotesProps } from '@/features/notes/types';
import { WorkspaceNotes } from '@/features/notes/workspace-notes';
import { workspaceLayout } from '@/features/workspaces/tab-layout';
import type { WorkspacePageProps } from '@/features/workspaces/types';
import { WorkspaceShell } from '@/features/workspaces/workspace-shell';
import { useBreakpoint } from '@/hooks/use-breakpoint';

type Props = WorkspacePageProps & { notes: WorkspaceNotesProps };

/** Tab "Catatan" of a workspace (F2-2): folders and notes, personal notebook included. */
export default function WorkspaceNotesPage(props: Props) {
    const breakpoint = useBreakpoint();
    const name =
        props.workspace.type === 'personal' ? 'Pribadi' : props.workspace.name;

    return (
        <>
            <Head title={`${name} · Catatan`} />
            <WorkspaceShell {...props} tab="notes">
                {breakpoint === null ? (
                    <Skeleton className="h-64 w-full max-w-4xl" />
                ) : (
                    <WorkspaceNotes
                        workspace={props.workspace}
                        props={props.notes}
                        mobile={breakpoint === 'mobile'}
                    />
                )}
            </WorkspaceShell>
        </>
    );
}

WorkspaceNotesPage.layout = (props: Props) => workspaceLayout(props, 'Catatan');
