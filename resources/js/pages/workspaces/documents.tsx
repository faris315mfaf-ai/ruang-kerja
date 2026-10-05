import { Head } from '@inertiajs/react';
import { DriveUnavailable } from '@/features/drive/drive-unavailable';
import { NewItemDialog } from '@/features/drive/new-item-dialog';
import type { DriveFileRow, WorkspaceDriveInfo } from '@/features/drive/types';
import { useWorkspaceDrive } from '@/features/drive/use-workspace-drive';
import { WorkspaceDocuments as DocumentsList } from '@/features/drive/workspace-documents';
import { workspaceLayout } from '@/features/workspaces/tab-layout';
import type { WorkspacePageProps } from '@/features/workspaces/types';
import { WorkspaceShell } from '@/features/workspaces/workspace-shell';
import { useBreakpoint } from '@/hooks/use-breakpoint';

type Props = WorkspacePageProps & {
    drive: WorkspaceDriveInfo;
    documents: DriveFileRow[];
};

/** Tab Dokumen: Google Docs/Sheets/Slides of the workspace + "Dokumen baru". */
export default function WorkspaceDocuments(props: Props) {
    const { workspace, drive, documents } = props;
    const mobile = useBreakpoint() === 'mobile';
    const actions = useWorkspaceDrive({
        workspaceKey: workspace.key,
        drive,
        folderId: null,
        reload: ['documents'],
    });

    return (
        <>
            <Head title={`${workspace.name} · Dokumen`} />
            <WorkspaceShell {...props} tab="documents">
                {drive.enabled ? (
                    <DocumentsList
                        workspaceKey={workspace.key}
                        mobile={mobile}
                        drive={drive}
                        documents={documents}
                        onNewItem={actions.setNewItem}
                    />
                ) : (
                    <DriveUnavailable missing={drive.missing_settings} />
                )}
            </WorkspaceShell>
            <NewItemDialog
                type={actions.newItem}
                location={`Disimpan di Shared Drive › ${drive.folder_name}`}
                busy={actions.busy}
                onCancel={() => actions.setNewItem(null)}
                onSubmit={(type, name) =>
                    void actions.submitNewItem(type, name)
                }
            />
        </>
    );
}

WorkspaceDocuments.layout = (props: Props) => workspaceLayout(props, 'Dokumen');
