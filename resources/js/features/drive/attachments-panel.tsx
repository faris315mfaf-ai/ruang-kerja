import {
    Camera,
    ChevronDown,
    FolderOpen,
    Paperclip,
    Plus,
    Upload,
} from 'lucide-react';
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
import { Spinner } from '@/components/ui/spinner';
import { requestJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import {
    destroy as destroyRoute,
    document as documentRoute,
    drive as driveRoute,
    index as indexRoute,
    upload as uploadRoute,
} from '@/routes/attachments';
import {
    AttachMenuItems,
    AttachSheet,
    DOCUMENT_OPTIONS,
    useAttachActions,
} from './attach-actions';
import { DriveFileCard } from './drive-file-card';
import { DriveFileIcon } from './drive-file-icon';
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
    /** URL alias of the parent (AttachableTypes::MAP): 'task' or 'comment'. */
    attachableType: string;
    attachableId: string;
    /**
     * Data already loaded by the parent (task detail). Without it the panel
     * fetches GET /lampiran/{type}/{id}; when it changes the panel follows.
     */
    initial?: AttachmentsPayload;
    /**
     * Hide the add/remove controls even when the server allows them (e.g. a
     * read-only view). The server still decides: `true` here never grants.
     */
    canEdit?: boolean;
    /**
     * `desktop`: header with "Lampirkan dari Drive · Unggah · Dokumen baru",
     * 2–3 column grid (mockup TaskDetail). `mobile`: "Lampirkan" + Kamera /
     * Drive / File, cards scroll sideways (MTaskDetail). `compact`: one
     * "Lampirkan" menu (inside a comment being edited).
     */
    variant?: 'desktop' | 'mobile' | 'compact';
    title?: string;
    className?: string;
    /** Called after the list changed here (e.g. to refresh the timeline). */
    onChange?: (count: number) => void;
};

/**
 * Drive attachments of any parent (task, comment) as a self-contained
 * panel: list (DriveFileCard), "Unggah" (chunked, ≤ 100 MB; camera on
 * phones), "Pilih dari Drive" (Google Picker), "Dokumen baru" (opens in
 * Google) and "lepas". Talks to /lampiran/{type}/{id} (AttachmentController).
 */
export function AttachmentsPanel({
    attachableType,
    attachableId,
    initial,
    canEdit = true,
    variant = 'desktop',
    title = 'Lampiran',
    className,
    onChange,
}: Props) {
    const args = { type: attachableType, id: attachableId };
    const [data, setData] = useState<AttachmentsPayload | null>(
        initial ?? null,
    );
    const [error, setError] = useState<string | null>(null);
    const [newItem, setNewItem] = useState<NewItemType | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [removing, setRemoving] = useState<string | null>(null);
    const uploads = useDriveUploads();
    const { create, creating } = useCreateDocument({
        fake: data?.drive.fake ?? false,
    });
    const indexUrl = indexRoute.url(args);
    const changed = useRef(onChange);

    useEffect(() => {
        changed.current = onChange;
    });

    // The parent refreshed its copy (realtime event, other edits): follow it.
    useEffect(() => {
        if (initial) {
            setData(initial);
            setError(null);
        }
    }, [initial]);

    const apply = useCallback((payload: AttachmentsPayload) => {
        setData(payload);
        setError(null);
        changed.current?.(payload.attachments.length);
    }, []);

    const load = useCallback(async () => {
        try {
            apply(await requestJson<AttachmentsPayload>(indexUrl));
        } catch (exception) {
            setError(errorMessage(exception, 'Lampiran gagal dimuat.'));
        }
    }, [apply, indexUrl]);

    const hasInitial = initial !== undefined;

    useEffect(() => {
        if (!hasInitial) {
            void load();
        }
    }, [hasInitial, load]);

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

    const actions = useAttachActions({
        onFiles: (files) => {
            if (!data) {
                return;
            }

            uploads.uploadMany(files, {
                url: uploadRoute.url(args),
                maxBytes: data.drive.max_upload_bytes,
                onDone: () => void load(),
            });
        },
        onPicked: (files) => void picked(files),
        onNewDocument: setNewItem,
    });

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

    const mobile = variant === 'mobile';
    const count = data?.attachments.length ?? 0;
    const touch = 'min-h-11 md:min-h-0';

    let controls = null;

    if (editable && variant === 'desktop') {
        controls = (
            <div className="ml-auto flex flex-wrap justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={touch}
                    disabled={actions.pickerLoading}
                    aria-busy={actions.pickerLoading}
                    onClick={actions.openPicker}
                >
                    {actions.pickerLoading ? <Spinner /> : <FolderOpen />}
                    Lampirkan dari Drive
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={touch}
                    onClick={actions.chooseFiles}
                >
                    <Upload />
                    Unggah
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={touch}
                        >
                            <Plus />
                            Dokumen baru
                            <ChevronDown />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                        {DOCUMENT_OPTIONS.map((option) => (
                            <DropdownMenuItem
                                key={option.type}
                                className="gap-3 py-2"
                                onSelect={() => setNewItem(option.type)}
                            >
                                <DriveFileIcon kind={option.kind} size="sm" />
                                <span>
                                    <span className="block text-[15px] font-semibold">
                                        {option.label}
                                    </span>
                                    <span className="block text-meta text-text-muted">
                                        {option.description}
                                    </span>
                                </span>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
    } else if (editable && mobile) {
        controls = (
            <Button
                type="button"
                variant="tonal"
                className="ml-auto"
                onClick={() => setSheetOpen(true)}
            >
                <Paperclip />
                Lampirkan
            </Button>
        );
    } else if (editable) {
        controls = (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn('ml-auto', touch)}
                    >
                        <Paperclip />
                        Lampirkan
                        <ChevronDown />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <AttachMenuItems actions={actions} />
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    let body;

    if (error) {
        body = (
            <p
                role="alert"
                className="flex items-center gap-2 text-[15px] text-danger"
            >
                {error}
                <button
                    type="button"
                    className="min-h-11 font-medium underline md:min-h-0"
                    onClick={() => void load()}
                >
                    Coba lagi
                </button>
            </p>
        );
    } else if (data === null) {
        body = (
            <div className="grid gap-2 @md:grid-cols-2" aria-busy>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
            </div>
        );
    } else if (data.attachments.length === 0) {
        body =
            variant === 'compact' ? null : (
                <p className="rounded-lg border border-dashed border-border-strong px-4 py-5 text-center text-[15px] text-text-muted">
                    {data.drive.enabled
                        ? 'Belum ada lampiran.'
                        : 'Belum ada lampiran. Integrasi Google Drive belum diaktifkan.'}
                </p>
            );
    } else {
        body = (
            <ul
                className={cn(
                    mobile &&
                        '-mx-4 flex snap-x scroll-px-4 [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1',
                    variant === 'desktop' &&
                        'grid gap-2 @md:grid-cols-2 @2xl:grid-cols-3',
                    variant === 'compact' && 'grid gap-2 @md:grid-cols-2',
                )}
            >
                {data.attachments.map((attachment) => (
                    <li
                        key={attachment.id}
                        className={cn(
                            mobile && 'w-[78%] max-w-72 shrink-0 snap-start',
                        )}
                    >
                        {attachment.drive_file ? (
                            <DriveFileCard
                                file={attachment.drive_file}
                                removing={removing === attachment.id}
                                onRemove={
                                    canEdit && attachment.can_remove
                                        ? (file) =>
                                              void remove(file, attachment.id)
                                        : undefined
                                }
                            />
                        ) : (
                            <p className="rounded-lg border border-border px-4 py-3 text-[15px] text-text-muted">
                                {attachment.filename}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <section
            aria-label={title}
            className={cn(
                '@container',
                variant === 'compact'
                    ? 'space-y-2'
                    : 'space-y-3 rounded-panel border border-border bg-surface shadow-card',
                mobile && 'px-4 pt-3 pb-4',
                variant === 'desktop' && 'px-6 pt-5 pb-6',
                className,
            )}
        >
            <header className="flex min-h-11 flex-wrap items-center gap-2">
                <h2
                    className={cn(
                        variant === 'compact'
                            ? 'text-meta font-semibold text-text-muted'
                            : 'font-bold text-text',
                        mobile && 'text-[17px]',
                        variant === 'desktop' && 'text-[21px] leading-7',
                    )}
                >
                    {title}
                </h2>
                {count > 0 && (
                    <span
                        className={cn(
                            'text-text-muted tnum',
                            variant === 'compact'
                                ? 'text-meta'
                                : 'text-[16px] font-bold',
                        )}
                    >
                        {count}
                    </span>
                )}
                {controls}
            </header>

            {mobile && editable && (
                <div className="grid grid-cols-3 gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-12 text-[15px]"
                        onClick={actions.takePhoto}
                    >
                        <Camera className="size-5" />
                        Kamera
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-12 text-[15px]"
                        disabled={actions.pickerLoading}
                        onClick={actions.openPicker}
                    >
                        <FolderOpen className="size-5" />
                        Drive
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-12 text-[15px]"
                        onClick={actions.chooseFiles}
                    >
                        <Upload className="size-5" />
                        File
                    </Button>
                </div>
            )}

            {body}

            {actions.elements}
            {mobile && (
                <AttachSheet
                    open={sheetOpen}
                    onOpenChange={setSheetOpen}
                    actions={actions}
                />
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
