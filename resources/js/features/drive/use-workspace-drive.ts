import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    documents as documentsRoute,
    files as filesRoute,
} from '@/routes/workspaces';
import { store as storeDocument } from '@/routes/workspaces/documents';
import {
    link as linkRoute,
    refresh as refreshRoute,
    upload as uploadRoute,
} from '@/routes/workspaces/files';
import { store as storeFolder } from '@/routes/workspaces/files/folders';
import type { NewItemType } from './new-item-options';
import type { PickedDriveFile, WorkspaceDriveInfo } from './types';
import { useCreateDocument } from './use-create-document';
import { useDriveUploads } from './use-drive-uploads';

const POLL_MS = 2500;
const MAX_POLLS = 10;

type Options = {
    workspaceKey: string;
    drive: WorkspaceDriveInfo;
    /** Google id of the browsed sub-folder (null = workspace root). */
    folderId: string | null;
    /** Props reloaded after a change. */
    reload: string[];
};

/**
 * Actions shared by the File and Dokumen tabs (desktop and mobile): poll
 * while the queue refreshes Drive, new document/folder, chunked uploads,
 * Picker links and "Muat ulang".
 */
export function useWorkspaceDrive({
    workspaceKey,
    drive,
    folderId,
    reload,
}: Options) {
    const uploads = useDriveUploads();
    const { create, creating } = useCreateDocument({ fake: drive.fake });
    const [newItem, setNewItem] = useState<NewItemType | null>(null);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const polls = useRef(0);
    const reloadKey = reload.join(',');

    const refreshProps = useCallback(() => {
        router.reload({
            only: [...reloadKey.split(','), 'drive', 'drive_counts'],
        });
    }, [reloadKey]);

    // The server queued a Drive refresh: poll a few times for the result.
    useEffect(() => {
        if (!drive.syncing) {
            polls.current = 0;

            return;
        }

        if (polls.current >= MAX_POLLS) {
            return;
        }

        const timer = window.setTimeout(() => {
            polls.current++;
            refreshProps();
        }, POLL_MS);

        return () => window.clearTimeout(timer);
    }, [drive.syncing, drive, refreshProps]);

    const submitNewItem = useCallback(
        async (type: NewItemType, name: string) => {
            if (type === 'folder') {
                setCreatingFolder(true);
                router.post(
                    storeFolder.url(workspaceKey),
                    { name, parent: folderId },
                    {
                        onSuccess: () => setNewItem(null),
                        onFinish: () => setCreatingFolder(false),
                    },
                );

                return;
            }

            const created = await create(storeDocument.url(workspaceKey), {
                type,
                name,
                folder: folderId,
            });

            if (created) {
                setNewItem(null);
                refreshProps();
            }
        },
        [create, folderId, refreshProps, workspaceKey],
    );

    const uploadFiles = useCallback(
        (fileList: FileList | File[] | null) =>
            uploads.uploadMany(fileList, {
                url: uploadRoute.url(workspaceKey),
                body: folderId ? { folder: folderId } : {},
                maxBytes: drive.max_upload_bytes,
                onDone: refreshProps,
            }),
        [drive.max_upload_bytes, folderId, refreshProps, uploads, workspaceKey],
    );

    const linkPicked = useCallback(
        (picked: PickedDriveFile[]) => {
            if (picked.length === 0) {
                return;
            }

            router.post(
                linkRoute.url(workspaceKey),
                { file_ids: picked.map((file) => file.id) },
                {
                    preserveScroll: true,
                    onError: (errors) =>
                        toast.error(
                            Object.values(errors)[0] ?? 'File gagal ditautkan.',
                        ),
                },
            );
        },
        [workspaceKey],
    );

    const refreshNow = useCallback(() => {
        polls.current = 0;
        router.post(
            refreshRoute.url(workspaceKey),
            { folder: folderId },
            { preserveScroll: true },
        );
    }, [folderId, workspaceKey]);

    return {
        uploads,
        uploadFiles,
        linkPicked,
        refreshNow,
        newItem,
        setNewItem,
        submitNewItem,
        busy: creating || creatingFolder,
        folderHref: (id: string | null) =>
            filesRoute.url(
                workspaceKey,
                id ? { query: { folder: id } } : undefined,
            ),
        documentsHref: documentsRoute.url(workspaceKey),
    };
}
