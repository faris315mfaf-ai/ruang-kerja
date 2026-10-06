import { ExternalLink, X } from 'lucide-react';
import { DriveFileIcon } from '@/features/drive/drive-file-icon';
import { cn, focusRing } from '@/lib/utils';
import type { MessageAttachment } from './types';

const KIND_LABEL: Record<MessageAttachment['kind'], string> = {
    doc: 'Google Dokumen',
    sheet: 'Google Spreadsheet',
    slide: 'Google Slide',
    pdf: 'PDF',
    image: 'Gambar',
    folder: 'Folder',
    other: 'File',
};

/** "2,4 MB" */
export function formatBytes(bytes: number | null): string | null {
    if (bytes === null) {
        return null;
    }

    if (bytes < 1_000_000) {
        return `${Math.max(1, Math.round(bytes / 1000))} KB`;
    }

    return `${(bytes / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
}

/** Drive file card under a message (opens Drive in a new tab). */
export function AttachmentCard({
    file,
    onRemove,
    className,
}: {
    file: MessageAttachment;
    /** Composer: drop a pending attachment. */
    onRemove?: () => void;
    className?: string;
}) {
    const size = formatBytes(file.size_bytes);

    return (
        <div
            className={cn(
                'relative flex min-h-14 w-full max-w-[360px] min-w-0 items-center gap-3 rounded-lg border border-border bg-surface p-2.5 pr-3 transition-colors duration-120 ease-brand hover:border-border-strong',
                className,
            )}
        >
            <DriveFileIcon kind={file.kind} />
            <span className="flex min-w-0 flex-1 flex-col">
                {onRemove ? (
                    <span className="truncate text-[15px] font-semibold text-text">
                        {file.name}
                    </span>
                ) : (
                    <a
                        href={file.web_view_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                            'truncate rounded-xs text-[15px] font-semibold text-text after:absolute after:inset-0 after:rounded-lg',
                            focusRing,
                        )}
                    >
                        {file.name}
                    </a>
                )}
                <span className="truncate text-[13px] text-text-muted">
                    {KIND_LABEL[file.kind]}
                    {size && ` · ${size}`} · Google Drive
                </span>
            </span>
            {onRemove ? (
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={`Lepas ${file.name}`}
                    className={cn(
                        'relative flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text md:size-8',
                        focusRing,
                    )}
                >
                    <X className="size-4" aria-hidden />
                </button>
            ) : (
                <ExternalLink
                    aria-hidden
                    className="size-4 shrink-0 text-text-subtle"
                />
            )}
        </div>
    );
}
