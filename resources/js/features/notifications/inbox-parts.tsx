import { Link } from '@inertiajs/react';
import { Archive } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toneText } from '@/features/notifications/notification-icon';
import { cn, focusRing } from '@/lib/utils';
import type {
    InboxCounts,
    InboxFilters,
    InboxKind,
    InboxNotification,
    InboxTab,
} from '@/types/notifications';

type ChipProps = {
    pressed: boolean;
    onClick: () => void;
    size: 'md' | 'lg';
    children: ReactNode;
};

/** Filter pill of DInbox / MNotifCenter: outline, pressed = inverse fill. */
function FilterChip({ pressed, onClick, size, children }: ChipProps) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            onClick={onClick}
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 text-[15px] whitespace-nowrap transition-colors duration-120 ease-brand',
                size === 'lg' ? 'h-11 font-bold' : 'h-10 font-semibold',
                pressed
                    ? 'border-inverse bg-inverse text-on-inverse'
                    : 'border-border-strong bg-surface text-text hover:bg-surface-2',
                focusRing,
            )}
        >
            {children}
        </button>
    );
}

const TABS: { value: InboxTab; label: string; count?: keyof InboxCounts }[] = [
    { value: 'unread', label: 'Belum dibaca', count: 'unread' },
    { value: 'action', label: 'Perlu tindakan', count: 'action' },
];

/**
 * Filter pills (DInbox "Semua · Belum dibaca · Disebut · Tugas · Pengajuan",
 * MNotifCenter chips). Two dimensions: status (Semua / Belum dibaca / Perlu
 * tindakan) and kind (toggle), plus the archive switch. `scroll` = one
 * horizontally scrolling row (phone).
 */
export function InboxFilterChips({
    filters,
    counts,
    kinds,
    onChange,
    scroll = false,
}: {
    filters: InboxFilters;
    counts: InboxCounts;
    kinds: InboxKind[];
    onChange: (next: Partial<InboxFilters>) => void;
    scroll?: boolean;
}) {
    const size = scroll ? 'lg' : 'md';

    return (
        <div
            className={cn(
                'flex gap-2.5',
                scroll
                    ? '-mx-4 [scrollbar-width:none] overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden'
                    : 'flex-wrap',
            )}
        >
            <div
                role="group"
                aria-label="Saring status"
                className={cn('flex gap-2.5', !scroll && 'flex-wrap')}
            >
                <FilterChip
                    size={size}
                    pressed={filters.tab === 'all' && filters.kind === null}
                    onClick={() => onChange({ tab: 'all', kind: null })}
                >
                    Semua
                </FilterChip>
                {TABS.map((tab) => {
                    const count = tab.count ? counts[tab.count] : 0;

                    return (
                        <FilterChip
                            key={tab.value}
                            size={size}
                            pressed={filters.tab === tab.value}
                            onClick={() => onChange({ tab: tab.value })}
                        >
                            {tab.label}
                            {count > 0 && (
                                <span className="tnum">
                                    · {count > 99 ? '99+' : count}
                                </span>
                            )}
                        </FilterChip>
                    );
                })}
            </div>
            <span
                aria-hidden
                className="my-2 w-px shrink-0 self-stretch bg-border"
            />
            <div
                role="group"
                aria-label="Saring jenis"
                className={cn('flex gap-2.5', !scroll && 'flex-wrap')}
            >
                {kinds.map((kind) => {
                    const pressed = filters.kind === kind.value;

                    return (
                        <FilterChip
                            key={kind.value}
                            size={size}
                            pressed={pressed}
                            onClick={() =>
                                onChange({ kind: pressed ? null : kind.value })
                            }
                        >
                            {kind.label}
                        </FilterChip>
                    );
                })}
                <FilterChip
                    size={size}
                    pressed={filters.archived}
                    onClick={() => onChange({ archived: !filters.archived })}
                >
                    <Archive aria-hidden className="size-4" strokeWidth={2} />
                    Arsip
                </FilterChip>
            </div>
        </div>
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
        <Badge variant="label" tone="warning" className="h-7 px-2.5">
            Perlu tindakan
        </Badge>
    );
}

export function InboxFooter({ retentionDays }: { retentionDays: number }) {
    return (
        <p className="text-meta text-text-muted">
            Notifikasi disimpan {retentionDays} hari.{' '}
            <Link
                href="/pengaturan/notifikasi"
                prefetch
                className="font-semibold text-link hover:underline"
            >
                Atur notifikasi
            </Link>
        </p>
    );
}

export function InboxListSkeleton({ rows = 6 }: { rows?: number }) {
    return (
        <div aria-label="Memuat notifikasi" className="divide-y divide-divider">
            {Array.from({ length: rows }, (_, index) => (
                <div
                    key={index}
                    className="flex gap-3.5 px-4 py-4 md:px-[22px]"
                >
                    <Skeleton className="size-11 rounded-[14px]" />
                    <div className="flex-1 space-y-2 pt-0.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3.5 w-1/2" />
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
