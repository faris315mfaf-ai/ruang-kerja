import { ExternalLink, FileX, Folder, Link2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClipboard } from '@/hooks/use-clipboard';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DriveFileIcon } from './drive-file-icon';
import { formatFileSize, isGoogleNative, openLabel } from './drive-files';
import type { DriveFileData } from './types';

type Props = {
    file: DriveFileData;
    onClose?: () => void;
    className?: string;
};

/**
 * Preview panel (mockup WorkspaceFile, right column): Google's `/preview`
 * page in an iframe, file details and "Buka di Google Docs".
 */
export function DriveFilePreview({ file, onClose, className }: Props) {
    const [loaded, setLoaded] = useState(false);
    const [, copy] = useClipboard();

    const copyLink = async () => {
        if (await copy(file.web_view_link)) {
            toast.success('Tautan disalin.');
        } else {
            toast.error('Tautan tidak bisa disalin.');
        }
    };

    const owner = file.added_by?.name ?? file.owner_email;

    return (
        <section
            aria-label={`Pratinjau ${file.name}`}
            className={cn(
                'flex flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-card',
                className,
            )}
        >
            <header className="flex items-start gap-3 border-b border-divider p-5">
                <DriveFileIcon kind={file.kind} size="sm" />
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-title font-bold text-text">
                        {file.name}
                    </h3>
                    <p className="text-meta text-text-muted">
                        {file.kind_label}
                    </p>
                </div>
                {onClose && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="-m-1 text-text-muted"
                        aria-label="Tutup pratinjau"
                        onClick={onClose}
                    >
                        <X />
                    </Button>
                )}
            </header>

            <div className="p-5">
                {file.deleted ? (
                    <EmptyState
                        icon={FileX}
                        title="File sudah dihapus dari Google Drive"
                        description="Lampiran ini hanya menyimpan nama file terakhir."
                    />
                ) : file.preview_url ? (
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-surface-2">
                        {!loaded && (
                            <Skeleton className="absolute inset-0 rounded-none" />
                        )}
                        <iframe
                            src={file.preview_url}
                            title={`Pratinjau ${file.name}`}
                            loading="lazy"
                            allow="autoplay"
                            className="absolute inset-0 size-full border-0 bg-surface"
                            onLoad={() => setLoaded(true)}
                        />
                    </div>
                ) : (
                    <EmptyState
                        icon={Folder}
                        title="Pratinjau tidak tersedia"
                        description="Buka di Google Drive untuk melihat isinya."
                    />
                )}
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 px-5 pb-5 text-[15px]">
                {owner && (
                    <>
                        <dt className="text-text-muted">Pemilik</dt>
                        <dd className="truncate text-text">{owner}</dd>
                    </>
                )}
                {file.modified_at && (
                    <>
                        <dt className="text-text-muted">Diubah</dt>
                        <dd className="text-text">
                            {formatDateTime(file.modified_at)}
                        </dd>
                    </>
                )}
                {!isGoogleNative(file.kind) && file.size_bytes !== null && (
                    <>
                        <dt className="text-text-muted">Ukuran</dt>
                        <dd className="text-text tabular-nums">
                            {formatFileSize(file.size_bytes)}
                        </dd>
                    </>
                )}
            </dl>

            {!file.deleted && (
                <footer className="flex gap-2 border-t border-border p-4">
                    <Button asChild className="flex-1">
                        <a
                            href={file.web_view_link}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {openLabel(file.kind)}
                            <ExternalLink />
                        </a>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-11 md:size-9"
                        aria-label="Salin tautan"
                        onClick={() => void copyLink()}
                    >
                        <Link2 />
                    </Button>
                </footer>
            )}
        </section>
    );
}
