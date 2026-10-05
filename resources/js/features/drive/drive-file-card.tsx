import { ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DriveFileIcon } from './drive-file-icon';
import { driveFileMeta } from './drive-files';
import type { DriveFileData } from './types';

type Props = {
    file: DriveFileData;
    /** Open the in-app preview; without it the card opens Drive in a new tab. */
    onPreview?: (file: DriveFileData) => void;
    /** Show a "lepas" button (attachments the user may remove). */
    onRemove?: (file: DriveFileData) => void;
    removing?: boolean;
    selected?: boolean;
    className?: string;
};

/**
 * Compact file card used for task/comment attachments and file lists
 * (mockups TaskDetail › Lampiran, WorkspaceFile, MFile).
 */
export function DriveFileCard({
    file,
    onPreview,
    onRemove,
    removing = false,
    selected = false,
    className,
}: Props) {
    const meta = driveFileMeta(file);
    const titleClass =
        'block truncate text-left text-sm font-medium text-text after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none';

    return (
        <div
            className={cn(
                'group relative flex min-h-14 w-full min-w-0 items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-card transition-colors duration-150 ease-brand focus-within:ring-[3px] focus-within:ring-ring/50 hover:border-border-strong',
                selected && 'border-primary bg-primary/5',
                file.deleted && 'opacity-70',
                className,
            )}
        >
            <DriveFileIcon kind={file.kind} />

            <div className="min-w-0 flex-1">
                {onPreview && !file.deleted ? (
                    <button
                        type="button"
                        className={titleClass}
                        onClick={() => onPreview(file)}
                    >
                        {file.name}
                    </button>
                ) : (
                    <a
                        href={file.web_view_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={titleClass}
                    >
                        {file.name}
                        <span className="sr-only"> (buka di tab baru)</span>
                    </a>
                )}
                <p className="truncate text-xs text-text-muted">
                    {file.deleted && (
                        <span className="text-warning">
                            Dihapus dari Drive ·{' '}
                        </span>
                    )}
                    {meta}
                </p>
            </div>

            {onPreview && !file.deleted && (
                <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="relative z-10 size-11 shrink-0 text-text-muted md:size-8"
                >
                    <a
                        href={file.web_view_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Buka ${file.name} di Google Drive`}
                    >
                        <ExternalLink />
                    </a>
                </Button>
            )}

            {onRemove && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={removing}
                    className="relative z-10 size-11 shrink-0 text-text-muted hover:text-danger md:size-8"
                    aria-label={`Lepas lampiran ${file.name}`}
                    onClick={() => onRemove(file)}
                >
                    <X />
                </Button>
            )}
        </div>
    );
}
