import { Link } from '@inertiajs/react';
import { Archive, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { toneText } from '@/features/notifications/notification-icon';
import { cn } from '@/lib/utils';
import type {
    InboxCounts,
    InboxFilters,
    InboxKind,
    InboxNotification,
    InboxTab,
} from '@/types/notifications';

const TABS: { value: InboxTab; label: string; count?: keyof InboxCounts }[] = [
    { value: 'all', label: 'Semua' },
    { value: 'unread', label: 'Belum dibaca', count: 'unread' },
    { value: 'action', label: 'Perlu tindakan', count: 'action' },
];

/** Segmented tabs Semua · Belum dibaca · Perlu tindakan (mockup Inbox/MInbox). */
export function InboxTabs({
    value,
    counts,
    onChange,
    size = 'md',
}: {
    value: InboxTab;
    counts: InboxCounts;
    onChange: (tab: InboxTab) => void;
    size?: 'md' | 'lg';
}) {
    return (
        <div
            role="tablist"
            aria-label="Saring Inbox"
            className="flex rounded-lg border border-border bg-surface-2 p-1"
        >
            {TABS.map((tab) => {
                const active = tab.value === value;
                const count = tab.count ? counts[tab.count] : 0;

                return (
                    <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(tab.value)}
                        className={cn(
                            'flex flex-auto items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                            size === 'lg'
                                ? 'h-11 px-2.5 text-sm'
                                : 'h-8 px-2 text-[13px]',
                            active
                                ? 'bg-surface text-text shadow-card'
                                : 'text-text-muted hover:text-text',
                        )}
                    >
                        {tab.label}
                        {count > 0 && (
                            <span
                                className={cn(
                                    'rounded-full px-1.5 text-[11px] leading-4 tnum',
                                    tab.count === 'action'
                                        ? 'bg-warning-soft text-warning'
                                        : 'bg-primary/15 text-primary',
                                )}
                            >
                                {count > 99 ? '99+' : count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/** Funnel menu: kind (Disebut / category) + archive toggle (desktop). */
export function InboxFilterMenu({
    filters,
    kinds,
    onChange,
}: {
    filters: InboxFilters;
    kinds: InboxKind[];
    onChange: (next: Partial<InboxFilters>) => void;
}) {
    const active = filters.kind !== null || filters.archived;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                        'relative size-8',
                        active && 'border-primary text-primary',
                    )}
                    aria-label="Saring jenis notifikasi"
                >
                    <Filter className="size-4" strokeWidth={1.75} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-text-muted">
                    Jenis
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                    value={filters.kind ?? 'all'}
                    onValueChange={(value) =>
                        onChange({ kind: value === 'all' ? null : value })
                    }
                >
                    <DropdownMenuRadioItem value="all">
                        Semua jenis
                    </DropdownMenuRadioItem>
                    {kinds.map((kind) => (
                        <DropdownMenuRadioItem
                            key={kind.value}
                            value={kind.value}
                        >
                            {kind.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                    checked={filters.archived}
                    onCheckedChange={(checked) =>
                        onChange({ archived: checked === true })
                    }
                >
                    <Archive className="size-4" aria-hidden />
                    Tampilkan arsip
                </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** "lewat 1 hari kerja" in the tone the module asked for. */
export function ContextText({
    notification,
}: {
    notification: InboxNotification;
}) {
    const { context, context_tone: tone } = notification.meta;

    if (typeof context !== 'string' || context === '') {
        return null;
    }

    return (
        <span className={tone ? toneText[tone] : 'text-text-muted'}>
            {context}
        </span>
    );
}

export function ActionBadge() {
    return (
        <span className="inline-flex h-5 items-center rounded-sm bg-warning-soft px-1.5 text-[11px] font-medium text-warning">
            Perlu tindakan
        </span>
    );
}

export function InboxFooter({ retentionDays }: { retentionDays: number }) {
    return (
        <p className="text-[13px] text-text-muted">
            Notifikasi disimpan {retentionDays} hari.{' '}
            <Link
                href="/pengaturan/notifikasi"
                prefetch
                className="text-primary hover:underline"
            >
                Atur notifikasi
            </Link>
        </p>
    );
}

export function InboxListSkeleton({ rows = 6 }: { rows?: number }) {
    return (
        <div className="space-y-1 p-2" aria-label="Memuat notifikasi">
            {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="flex gap-3 rounded-md p-3">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export const emptyCopy = (
    filters: InboxFilters,
): { title: string; description: string } => {
    if (filters.archived) {
        return {
            title: 'Arsip kosong',
            description: 'Notifikasi yang Anda arsipkan muncul di sini.',
        };
    }

    if (filters.tab === 'unread') {
        return {
            title: 'Semua sudah dibaca',
            description: 'Tidak ada notifikasi baru untuk Anda.',
        };
    }

    if (filters.tab === 'action') {
        return {
            title: 'Tidak ada yang perlu tindakan',
            description:
                'Persetujuan dan tugas terlambat Anda akan muncul di sini.',
        };
    }

    return {
        title: 'Inbox Anda bersih',
        description:
            'Penugasan, sebutan, komentar, dan pengajuan akan muncul di sini.',
    };
};
