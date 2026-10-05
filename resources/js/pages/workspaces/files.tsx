import { Head } from '@inertiajs/react';
import { FolderOpen } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { workspaceLayout } from '@/features/workspaces/tab-layout';
import type { WorkspacePageProps } from '@/features/workspaces/types';
import { WorkspaceShell } from '@/features/workspaces/workspace-shell';

/** Tab File — the workspace folder in Google Shared Drive arrives in Sprint 7. */
export default function WorkspaceFiles(props: WorkspacePageProps) {
    return (
        <>
            <Head title={`${props.workspace.name} · File`} />
            <WorkspaceShell {...props} tab="files">
                <EmptyState
                    icon={FolderOpen}
                    title="File segera tersedia"
                    description="Folder Google Drive workspace ini (unggah, pratinjau, buka di Drive) akan tampil di sini."
                />
            </WorkspaceShell>
        </>
    );
}

WorkspaceFiles.layout = (props: WorkspacePageProps) =>
    workspaceLayout(props, 'File');
