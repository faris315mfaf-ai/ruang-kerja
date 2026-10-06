import type { LucideIcon } from 'lucide-react';
import {
    ArrowRightLeft,
    CircleAlert,
    CircleCheck,
    Cloud,
    LoaderCircle,
    LogIn,
    MessageSquare,
    NotebookPen,
    RefreshCw,
    Wifi,
    WifiOff,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { QueueBanner, QueueSummary } from './logic';
import type { SyncItem, SyncKind, SyncStatus } from './types';

export const OFFLINE_FLOW = [
    'Tanpa sinyal: aksi disimpan terenkripsi di perangkat (maks. 72 jam)',
    'Antrean menampilkan setiap perubahan dengan statusnya',
    'Sinyal kembali: dikirim satu per satu, urut waktu',
    'Konflik atau galat: ditandai Gagal dengan alasan dan Coba lagi',
    'Semua tersinkron: data di perangkat diganti data server',
];

const KIND_ICON: Record<SyncKind, LucideIcon> = {
    check_in: LogIn,
    comment: MessageSquare,
    status: ArrowRightLeft,
    note: NotebookPen,
};

const STATUS: Record<
    SyncStatus,
    { label: string; tone: 'warning' | 'info' | 'danger' | 'success' }
> = {
    pending: { label: 'Menunggu', tone: 'warning' },
    syncing: { label: 'Menyinkron', tone: 'info' },
    failed: { label: 'Gagal', tone: 'danger' },
    sent: { label: 'Terkirim', tone: 'success' },
};

const BANNER_STYLE: Record<QueueBanner['tone'], string> = {
    warning: 'bg-warning-soft text-warning',
    info: 'bg-info-soft text-info',
    danger: 'bg-danger-soft text-danger',
    success: 'bg-success-soft text-success',
};

const BANNER_ICON: Record<QueueBanner['tone'], LucideIcon> = {
    warning: WifiOff,
    info: Wifi,
    danger: CircleAlert,
    success: Cloud,
};

/** Network / sync status strip (MOffline top bar). */
export function SyncBanner({
    banner,
    className,
}: {
    banner: QueueBanner;
    className?: string;
}) {
    const Icon = BANNER_ICON[banner.tone];

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                'flex items-center gap-3 rounded-[18px] px-4 py-3',
                BANNER_STYLE[banner.tone],
                className,
            )}
        >
            <Icon
                aria-hidden
                className="size-[22px] shrink-0"
                strokeWidth={2.2}
            />
            <span className="flex min-w-0 flex-col">
                <span className="text-[16px] font-extrabold">
                    {banner.title}
                </span>
                <span className="text-[14px] font-semibold">
                    {banner.detail}
                </span>
            </span>
        </div>
    );
}

function QueueRow({
    item,
    onRetry,
}: {
    item: SyncItem;
    onRetry: (id: string) => void;
}) {
    const Icon = KIND_ICON[item.kind];
    const status = STATUS[item.status];

    return (
        <li className="flex flex-col gap-2 border-t border-divider py-3 first:border-t-0">
            <div className="flex items-center gap-3">
                <span
                    aria-hidden
                    className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-full',
                        item.status === 'sent'
                            ? 'bg-success-soft text-success'
                            : item.status === 'failed'
                              ? 'bg-danger-soft text-danger'
                              : 'bg-surface-2 text-text-muted',
                    )}
                >
                    {item.status === 'sent' ? (
                        <CircleCheck className="size-5" />
                    ) : item.status === 'syncing' ? (
                        <LoaderCircle className="size-5 animate-spin" />
                    ) : (
                        <Icon className="size-5" />
                    )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 text-[16px] leading-[22px] font-bold">
                        {item.title}
                    </span>
                    <span className="line-clamp-2 text-[14px] leading-5 text-text-muted">
                        {formatTime(item.queued_at)} · {item.meta}
                    </span>
                </span>
                <Badge
                    variant="status"
                    tone={status.tone}
                    className="h-7 px-2.5 text-[13px]"
                >
                    {status.label}
                </Badge>
            </div>
            {item.status === 'failed' && (
                <div className="ml-[52px] flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 text-[14px] leading-5 text-danger">
                        {item.error}
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11 md:min-h-9"
                        onClick={() => onRetry(item.id)}
                    >
                        <RefreshCw aria-hidden />
                        Coba lagi
                    </Button>
                </div>
            )}
        </li>
    );
}

/** "Antrean sinkron" card with every queued change and its status. */
export function QueueList({
    items,
    summary,
    onRetry,
}: {
    items: SyncItem[];
    summary: QueueSummary;
    onRetry: (id: string) => void;
}) {
    if (items.length === 0) {
        return (
            <EmptyState
                icon={Cloud}
                title="Tidak ada yang menunggu"
                description="Semua check-in, komentar, dan perubahan status sudah tersinkron."
            />
        );
    }

    return (
        <section
            aria-labelledby="antrean-sinkron"
            className="rounded-[22px] border border-border bg-surface px-4 pt-3.5 pb-1 shadow-card"
        >
            <div className="flex items-baseline justify-between pb-1">
                <h2 id="antrean-sinkron" className="text-[18px] font-extrabold">
                    Antrean sinkron
                </h2>
                <span className="text-[14px] font-bold text-text-muted tnum">
                    {summary.waiting} menunggu
                </span>
            </div>
            <ul aria-live="polite">
                {items.map((item) => (
                    <QueueRow key={item.id} item={item} onRetry={onRetry} />
                ))}
            </ul>
        </section>
    );
}

/** What still works without signal (MOffline second card). */
export function OfflineCapabilities() {
    return (
        <section className="flex flex-col gap-1.5 rounded-[22px] border border-border bg-surface p-4 shadow-card">
            <h2 className="text-[18px] font-extrabold">
                Tetap bisa dikerjakan tanpa sinyal
            </h2>
            <p className="text-[16px] leading-6 text-text-muted">
                Check-in dengan GPS & selfie atau wajah, ubah status tugas,
                centang checklist, tulis komentar dan catatan. Lampiran foto
                dikompres dulu di perangkat.
            </p>
            <p className="text-[14px] text-text-muted">
                Data tersimpan terenkripsi di perangkat maksimal 72 jam.
            </p>
        </section>
    );
}
