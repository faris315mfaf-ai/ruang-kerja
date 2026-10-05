import { FolderOpen, Upload, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useAttachActions } from '@/features/drive/attach-actions';
import { DriveFileCard } from '@/features/drive/drive-file-card';
import { DriveFileIcon } from '@/features/drive/drive-file-icon';
import { formatFileSize } from '@/features/drive/drive-files';
import { NewItemDialog } from '@/features/drive/new-item-dialog';
import { newItemOption } from '@/features/drive/new-item-options';
import type { NewItemType } from '@/features/drive/new-item-options';
import type {
    AttachmentData,
    AttachmentsDriveInfo,
    PickedDriveFile,
} from '@/features/drive/types';
import { UploadProgressList } from '@/features/drive/upload-progress-list';
import { errorMessage } from '@/features/drive/upload-transport';
import { useDriveUploads } from '@/features/drive/use-drive-uploads';
import { requestJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import {
    document as documentRoute,
    drive as driveRoute,
    upload as uploadRoute,
} from '@/routes/attachments';

/** A file chosen in the composer, attached once the comment exists. */
export type PendingAttachment =
    | { key: string; kind: 'upload'; name: string; file: File }
    | { key: string; kind: 'drive'; name: string; file: PickedDriveFile }
    | { key: string; kind: 'document'; name: string; type: NewItemType };

let counter = 0;
const nextKey = () => `pending-${++counter}`;

/**
 * Attachments of a comment being written: "Unggah", "Pilih dari Drive" and
 * "Dokumen baru" only collect choices; `flush(commentId)` attaches them to
 * the posted comment (/lampiran/comment/{id}/…). Uploads run chunked with
 * the floating progress list.
 */
export function useCommentAttachments(drive: AttachmentsDriveInfo | null) {
    const [pending, setPending] = useState<PendingAttachment[]>([]);
    const [newItem, setNewItem] = useState<NewItemType | null>(null);
    const uploads = useDriveUploads();
    const enabled = drive?.enabled ?? false;

    const add = useCallback((items: PendingAttachment[]) => {
        setPending((current) => [...current, ...items]);
    }, []);

    const actions = useAttachActions({
        onFiles: (files) => {
            const max = drive?.max_upload_bytes ?? 0;
            const accepted = files.filter((file) => {
                if (file.size > max) {
                    toast.error(
                        `${file.name} terlalu besar. Ukuran file maksimal ${formatFileSize(max)}.`,
                    );

                    return false;
                }

                return true;
            });
            add(
                accepted.map((file) => ({
                    key: nextKey(),
                    kind: 'upload' as const,
                    name: file.name,
                    file,
                })),
            );
        },
        onPicked: (files) =>
            add(
                files.map((file) => ({
                    key: nextKey(),
                    kind: 'drive' as const,
                    name: file.name,
                    file,
                })),
            ),
        onNewDocument: setNewItem,
    });

    const remove = (key: string) =>
        setPending((current) => current.filter((item) => item.key !== key));

    /** Attach everything chosen to the posted comment, then clear the list. */
    const flush = async (commentId: string, onChanged: () => void) => {
        const items = pending;
        setPending([]);

        if (items.length === 0 || !drive) {
            return;
        }

        const args = { type: 'comment', id: commentId };
        let changed = false;
        const picked = items.flatMap((item) =>
            item.kind === 'drive' ? [item.file.id] : [],
        );

        if (picked.length > 0) {
            try {
                await requestJson(driveRoute.url(args), {
                    method: 'POST',
                    body: { file_ids: picked },
                });
                changed = true;
            } catch (exception) {
                toast.error(
                    errorMessage(exception, 'File Drive gagal dilampirkan.'),
                );
            }
        }

        for (const item of items) {
            if (item.kind !== 'document') {
                continue;
            }

            try {
                const created = await requestJson<{
                    message: string;
                    web_view_link: string;
                }>(documentRoute.url(args), {
                    method: 'POST',
                    body: { type: item.type, name: item.name },
                });
                changed = true;
                toast.success(
                    created.message,
                    drive.fake
                        ? undefined
                        : {
                              action: {
                                  label: 'Buka',
                                  onClick: () =>
                                      window.open(
                                          created.web_view_link,
                                          '_blank',
                                          'noopener,noreferrer',
                                      ),
                              },
                          },
                );
            } catch (exception) {
                toast.error(
                    errorMessage(exception, `${item.name} gagal dibuat.`),
                );
            }
        }

        const files = items.flatMap((item) =>
            item.kind === 'upload' ? [item.file] : [],
        );

        if (files.length > 0) {
            uploads.uploadMany(files, {
                url: uploadRoute.url(args),
                maxBytes: drive.max_upload_bytes,
                onDone: onChanged,
            });
        }

        if (changed) {
            onChanged();
        }
    };

    const elements = (
        <>
            {actions.elements}
            <NewItemDialog
                type={newItem}
                location="Dibuat di folder Drive workspace setelah komentar terkirim."
                hint="Dokumen dibuat dan dilampirkan saat komentar dikirim."
                submitLabel="Tambahkan"
                busy={false}
                onCancel={() => setNewItem(null)}
                onSubmit={(type, name) => {
                    add([
                        {
                            key: nextKey(),
                            kind: 'document',
                            type,
                            name: name || newItemOption(type).placeholder,
                        },
                    ]);
                    setNewItem(null);
                }}
            />
            <UploadProgressList
                items={uploads.items}
                onDismiss={uploads.dismiss}
            />
        </>
    );

    return { enabled, pending, actions, remove, flush, elements };
}

export type CommentAttachmentsState = ReturnType<typeof useCommentAttachments>;

/** Chips of the files waiting for the comment to be sent. */
export function PendingAttachmentChips({
    items,
    onRemove,
    mobile = false,
}: {
    items: PendingAttachment[];
    onRemove: (key: string) => void;
    mobile?: boolean;
}) {
    if (items.length === 0) {
        return null;
    }

    return (
        <ul aria-label="Lampiran komentar" className="flex flex-wrap gap-1.5">
            {items.map((item) => (
                <li
                    key={item.key}
                    className={cn(
                        'flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface-2 pl-2 text-text',
                        mobile ? 'h-11 text-[15px]' : 'h-7 text-xs',
                    )}
                >
                    {item.kind === 'upload' && (
                        <Upload
                            className="size-3.5 shrink-0 text-text-muted"
                            aria-hidden
                        />
                    )}
                    {item.kind === 'drive' && (
                        <FolderOpen
                            className="size-3.5 shrink-0 text-text-muted"
                            aria-hidden
                        />
                    )}
                    {item.kind === 'document' && (
                        <DriveFileIcon
                            kind={newItemOption(item.type).kind}
                            size="sm"
                        />
                    )}
                    <span className="max-w-48 truncate">{item.name}</span>
                    <button
                        type="button"
                        aria-label={`Batalkan lampiran ${item.name}`}
                        onClick={() => onRemove(item.key)}
                        className={cn(
                            'flex shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface hover:text-text',
                            mobile ? 'size-11' : 'size-7',
                        )}
                    >
                        <X className="size-3.5" aria-hidden />
                    </button>
                </li>
            ))}
        </ul>
    );
}

/** Attachments shown under a comment (read-only cards). */
export function CommentAttachmentList({
    attachments,
    mobile = false,
}: {
    attachments: AttachmentData[];
    mobile?: boolean;
}) {
    if (attachments.length === 0) {
        return null;
    }

    return (
        <ul
            aria-label="Lampiran"
            className={cn(
                'mt-2.5 grid gap-2',
                mobile ? 'grid-cols-1' : '@container sm:grid-cols-2',
            )}
        >
            {attachments.map((attachment) => (
                <li key={attachment.id}>
                    {attachment.drive_file ? (
                        <DriveFileCard
                            file={attachment.drive_file}
                            className="min-h-12 p-2.5 shadow-none"
                        />
                    ) : (
                        <p className="rounded-lg border border-border px-3 py-2 text-[13px] text-text-muted">
                            {attachment.filename}
                        </p>
                    )}
                </li>
            ))}
        </ul>
    );
}
