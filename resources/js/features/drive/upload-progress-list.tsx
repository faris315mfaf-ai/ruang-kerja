import { CheckCircle2, CircleAlert, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from './drive-files';
import type { UploadItem } from './use-drive-uploads';

type Props = {
    items: UploadItem[];
    onDismiss: (key: string) => void;
    className?: string;
};

function percent(item: UploadItem): number {
    return item.total === 0
        ? 0
        : Math.min(100, Math.round((item.sent / item.total) * 100));
}

function detail(item: UploadItem): string {
    switch (item.phase) {
        case 'processing':
            return 'Menyimpan ke Google Drive…';
        case 'done':
            return 'Selesai';
        case 'failed':
            return item.message ?? 'Gagal mengunggah.';
        default: {
            const eta =
                item.etaSeconds === null
                    ? ''
                    : item.etaSeconds < 60
                      ? ` · sekitar ${Math.max(1, item.etaSeconds)} detik lagi`
                      : ` · sekitar ${Math.ceil(item.etaSeconds / 60)} menit lagi`;

            return `${formatFileSize(item.sent)} dari ${formatFileSize(item.total)}${eta}`;
        }
    }
}

/**
 * Floating upload progress (mockups WorkspaceFile bottom-right, MFile above
 * the sheet): one card per file with a bar, cancel/dismiss button.
 */
export function UploadProgressList({ items, onDismiss, className }: Props) {
    if (items.length === 0) {
        return null;
    }

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                'fixed inset-x-4 bottom-[calc(var(--tab-bar-height,0px)+env(safe-area-inset-bottom)+12px)] z-40 space-y-2 md:inset-x-auto md:right-6 md:bottom-6 md:w-[340px]',
                className,
            )}
        >
            {items.map((item) => {
                const value = item.phase === 'uploading' ? percent(item) : 100;
                const Icon =
                    item.phase === 'done'
                        ? CheckCircle2
                        : item.phase === 'failed'
                          ? CircleAlert
                          : Upload;

                return (
                    <div
                        key={item.key}
                        className="glass rounded-lg border border-border p-3 shadow-card"
                    >
                        <div className="flex items-start gap-3">
                            <span
                                aria-hidden
                                className={cn(
                                    'flex size-8 shrink-0 items-center justify-center rounded-md border border-border',
                                    item.phase === 'failed'
                                        ? 'text-danger'
                                        : item.phase === 'done'
                                          ? 'text-success'
                                          : 'text-primary',
                                )}
                            >
                                <Icon className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[14px] font-medium text-text">
                                    {item.phase === 'uploading' ||
                                    item.phase === 'processing'
                                        ? 'Mengunggah '
                                        : ''}
                                    {item.name}
                                    {item.phase === 'uploading' && (
                                        <span className="text-text-muted tnum">
                                            {' '}
                                            · {value}%
                                        </span>
                                    )}
                                </p>
                                <p
                                    className={cn(
                                        'truncate text-[12px] tnum',
                                        item.phase === 'failed'
                                            ? 'text-danger'
                                            : 'text-text-muted',
                                    )}
                                >
                                    {detail(item)}
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label={
                                    item.phase === 'uploading'
                                        ? `Batalkan unggahan ${item.name}`
                                        : `Tutup ${item.name}`
                                }
                                onClick={() => onDismiss(item.key)}
                                className="-m-1.5 flex size-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:size-8"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        <div
                            role="progressbar"
                            aria-label={`Progres ${item.name}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={value}
                            className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-2"
                        >
                            <div
                                className={cn(
                                    'h-full rounded-full transition-[width] duration-200 ease-brand',
                                    item.phase === 'failed'
                                        ? 'bg-danger'
                                        : item.phase === 'processing'
                                          ? 'animate-pulse bg-primary'
                                          : 'bg-primary',
                                )}
                                style={{ width: `${value}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
