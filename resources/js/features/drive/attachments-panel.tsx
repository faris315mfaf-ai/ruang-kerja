import { ChevronDown, Paperclip, Plus, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { requestJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import {
    destroy as destroyRoute,
    document as documentRoute,
    drive as driveRoute,
    index as indexRoute,
    upload as uploadRoute,
} from '@/routes/attachments';
import { DriveFileCard } from './drive-file-card';
import { DriveFileIcon } from './drive-file-icon';
import { DrivePicker } from './drive-picker';
import { NEW_ITEM_OPTIONS } from './new-item-options';
import type { NewItemType } from './new-item-options';
import { NewItemDialog } from './new-item-dialog';
import type {
    AttachmentsPayload,
    DriveFileData,
    PickedDriveFile,
} from './types';
import { UploadProgressList } from './upload-progress-list';
import { useCreateDocument } from './use-create-document';
import { useDriveUploads } from './use-drive-uploads';
import { errorMessage } from './upload-transport';

type Props = {
    /** URL alias of the parent (AttachableTypes::MAP): 'task', later 'comment'. */
    attachableType: string;
    attachableId: string;
    /**
     * Hide the add/remove controls even when the server allows them (e.g. a
     * read-only view). The server still decides: `false` here never grants.
     */
    canEdit?: boolean;
    title?: string;
    className?: string;
    /** Called after the list changed (e.g. to refresh an attachment count). */
    onChange?: (count: number) => void;
};

const DOC_OPTIONS = NEW_ITEM_OPTIONS.filter(
    (option) => option.type !== 'folder',
);

/**
 * Drive attachments of any parent (task now, comment in Sprint 6) as a
 * self-contained panel: list (DriveFileCard), "Unggah" (chunked, ≤ 100 MB),
 * "Pilih dari Drive" (Google Picker), "Dokumen baru" (opens in Google) and
 * "lepas". Talks to /lampiran/{type}/{id} (AttachmentController) only.
 *
 * Usage in the TaskSheet: <AttachmentsPanel attachableType="task" attachableId={task.id} />
 */
export function AttachmentsPanel({
    attachableType,
    attachableId,
    canEdit = true,
    title = 'Lampiran',
    className,
    onChange,
}: Props) {
    const args = { type: attachableType, id: attachableId };
    const [data, setData] = useState<AttachmentsPayload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [newItem, setNewItem] = useState<NewItemType | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const uploads = useDriveUploads();
    const { create, creating } = useCreateDocument();
    const input = useRef<HTMLInputElement>(null);
    const indexUrl = indexRoute.url(args);

    const apply = useCallback(
        (payload: AttachmentsPayload) => {
            setData(payload);
            setError(null);
            onChange?.(payload.attachments.length);
        },
        [onChange],
    );

    const load = useCallback(async () => {
        try {
            apply(await requestJson<AttachmentsPayload>(indexUrl));
        } catch (exception) {
            setError(errorMessage(exception, 'Lampiran gagal dimuat.'));
        }
    }, [apply, indexUrl]);

    useEffect(() => {
        void load();
    }, [load]);

    const editable =
        canEdit && (data?.can_edit ?? false) && (data?.drive.enabled ?? false);

    const picked = async (files: PickedDriveFile[]) => {
        if (files.length === 0) {
            return;
        }

        try {
            apply(
                await requestJson<AttachmentsPayload>(driveRoute.url(args), {
                    method: 'POST',
                    body: { file_ids: files.map((file) => file.id) },
                }),
            );
            toast.success(`${files.length} file dilampirkan.`);
        } catch (exception) {
            toast.error(errorMessage(exception, 'File gagal dilampirkan.'));
        }
    };

    const createDocument = async (type: NewItemType, name: string) => {
        const created = await create<
            AttachmentsPayload & { message: string; web_view_link: string }
        >(documentRoute.url(args), { type, name });

        if (created) {
            apply(created);
            setNewItem(null);
        }
    };

    const remove = async (file: DriveFileData, attachmentId: string) => {
        setRemoving(attachmentId);

        try {
            const result = await requestJson<{ message: string }>(
                destroyRoute.url(attachmentId),
                { method: 'DELETE' },
            );
            toast.success(result.message);
            await load();
        } catch (exception) {
            toast.error(errorMessage(exception, `${file.name} gagal dilepas.`));
        } finally {
            setRemoving(null);
        }
    };

    return (
        <section aria-label={title} className={cn('space-y-2', className)}>
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-text">
                    <Paperclip aria-hidden className="size-4 text-text-muted" />
                    {title}
                    {data && data.attachments.length > 0 && (
                        <span className="font-normal text-text-muted tnum">
                            {data.attachments.length}
                        </span>
                    )}
                </h3>
                {editable && data && (
                    <div className="ml-auto flex flex-wrap gap-1.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-11 md:min-h-0"
                            onClick={() => input.current?.click()}
                        >
                            <Upload />
                            Unggah
                        </Button>
                        <input
                            ref={input}
                            type="file"
                            multiple
                            hidden
                            onChange={(event) => {
                                uploads.uploadMany(event.target.files, {
                                    url: uploadRoute.url(args),
                                    maxBytes: data.drive.max_upload_bytes,
                                    onDone: () => void load(),
                                });
                                event.target.value = '';
                            }}
                        />
                        <DrivePicker onPicked={(files) => void picked(files)} />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="min-h-11 md:min-h-0"
                                >
                                    <Plus />
                                    Dokumen baru
                                    <ChevronDown />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                                {DOC_OPTIONS.map((option) => (
                                    <DropdownMenuItem
                                        key={option.type}
                                        className="gap-3 py-2"
                                        onSelect={() => setNewItem(option.type)}
                                    >
                                        <DriveFileIcon
                                            kind={option.kind}
                                            size="sm"
                                        />
                                        <span>
                                            <span className="block text-[13px] font-medium">
                                                {option.label}
                                            </span>
                                            <span className="block text-[12px] text-text-muted">
                                                {option.description}
                                            </span>
                                        </span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>

            {error ? (
                <p
                    role="alert"
                    className="flex items-center gap-2 text-[13px] text-danger"
                >
                    {error}
                    <button
                        type="button"
                        className="font-medium underline"
                        onClick={() => void load()}
                    >
                        Coba lagi
                    </button>
                </p>
            ) : data === null ? (
                <div className="space-y-2" aria-busy>
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                </div>
            ) : data.attachments.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border-strong px-3 py-4 text-center text-[13px] text-text-muted">
                    {data.drive.enabled
                        ? 'Belum ada lampiran.'
                        : 'Belum ada lampiran. Integrasi Google Drive belum diaktifkan.'}
                </p>
            ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                    {data.attachments.map((attachment) => (
                        <li key={attachment.id}>
                            {attachment.drive_file ? (
                                <DriveFileCard
                                    file={attachment.drive_file}
                                    removing={removing === attachment.id}
                                    onRemove={
                                        canEdit && attachment.can_remove
                                            ? (file) =>
                                                  void remove(
                                                      file,
                                                      attachment.id,
                                                  )
                                            : undefined
                                    }
                                />
                            ) : (
                                <p className="rounded-lg border border-border px-3 py-2 text-[13px] text-text-muted">
                                    {attachment.filename}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <NewItemDialog
                type={newItem}
                location="Disimpan di folder Drive workspace dan dilampirkan."
                busy={creating}
                onCancel={() => setNewItem(null)}
                onSubmit={(type, name) => void createDocument(type, name)}
            />
            <UploadProgressList
                items={uploads.items}
                onDismiss={uploads.dismiss}
            />
        </section>
    );
}
