import { Head } from '@inertiajs/react';
import { DriveUnavailable } from '@/features/drive/drive-unavailable';
import { NewItemDialog } from '@/features/drive/new-item-dialog';
import type { DriveFileRow, WorkspaceDriveInfo } from '@/features/drive/types';
import { UploadProgressList } from '@/features/drive/upload-progress-list';
import { useWorkspaceDrive } from '@/features/drive/use-workspace-drive';
import { WorkspaceFilesDesktop } from '@/features/drive/workspace-files.desktop';
import type { FolderCrumb } from '@/features/drive/workspace-files.desktop';
import { WorkspaceFilesMobile } from '@/features/drive/workspace-files.mobile';
import { workspaceLayout } from '@/features/workspaces/tab-layout';
import type { WorkspacePageProps } from '@/features/workspaces/types';
import { WorkspaceShell } from '@/features/workspaces/workspace-shell';
import { useBreakpoint } from '@/hooks/use-breakpoint';

type Props = WorkspacePageProps & {
    drive: WorkspaceDriveInfo;
    folder: { id: string; name: string; url: string } | null;
    breadcrumbs: FolderCrumb[];
    files: DriveFileRow[];
};

/**
 * Tab File (mockups WorkspaceFile / MFile): the workspace folder in the
 * Shared Drive, read from the drive_files cache (refreshed in the queue when
 * older than 5 minutes), sub-folders, chunked upload ≤ 100 MB, new
 * Docs/Sheets/Slides/folder, Google Picker and an iframe preview.
 */
export default function WorkspaceFiles(props: Props) {
    const { workspace, drive, folder, breadcrumbs, files, drive_counts } =
        props;
    const mobile = useBreakpoint() === 'mobile';
    const actions = useWorkspaceDrive({
        workspaceKey: workspace.key,
        drive,
        folderId: folder?.id ?? null,
        reload: ['files', 'breadcrumbs', 'folder'],
    });
    const location = `Disimpan di Shared Drive › ${breadcrumbs.map((crumb) => crumb.name).join(' › ')}`;
    const shared = {
        drive,
        files,
        breadcrumbs,
        folderHref: actions.folderHref,
        onNewItem: actions.setNewItem,
        onUpload: actions.uploadFiles,
        onPicked: actions.linkPicked,
        onRefresh: actions.refreshNow,
    };

    return (
        <>
            <Head title={`${workspace.name} · File`} />
            <WorkspaceShell {...props} tab="files">
                {!drive.enabled ? (
                    <DriveUnavailable missing={drive.missing_settings} />
                ) : mobile ? (
                    <WorkspaceFilesMobile
                        {...shared}
                        workspaceKey={workspace.key}
                    />
                ) : (
                    <WorkspaceFilesDesktop
                        {...shared}
                        totalFiles={drive_counts?.files ?? 0}
                    />
                )}
            </WorkspaceShell>
            <NewItemDialog
                type={actions.newItem}
                location={location}
                busy={actions.busy}
                onCancel={() => actions.setNewItem(null)}
                onSubmit={(type, name) =>
                    void actions.submitNewItem(type, name)
                }
            />
            <UploadProgressList
                items={actions.uploads.items}
                onDismiss={actions.uploads.dismiss}
            />
        </>
    );
}

WorkspaceFiles.layout = (props: Props) => workspaceLayout(props, 'File');
