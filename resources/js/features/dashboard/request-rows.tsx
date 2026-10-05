import { Link } from '@inertiajs/react';
import { StatusBadge } from '@/features/requests/badges';
import { formatRequestPeriod } from '@/lib/requests';
import type { RequestItem } from '@/types/requests';
import { PanelEmpty } from './panel';

/** "Pengajuan saya" / approval queue rows: type, number, period, status. */
export function RequestRows({
    items,
    showUser = false,
    hrefBase = '/pengajuan',
    empty = 'Belum ada pengajuan.',
}: {
    items: RequestItem[];
    showUser?: boolean;
    /** Detail route: /pengajuan/{id} (own) or /persetujuan/{id} (to decide). */
    hrefBase?: string;
    empty?: string;
}) {
    if (items.length === 0) {
        return <PanelEmpty>{empty}</PanelEmpty>;
    }

    return (
        <ul className="divide-y divide-border">
            {items.map((item) => (
                <li key={item.id}>
                    <Link
                        href={`${hrefBase}/${item.id}`}
                        className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                    >
                        <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-2 text-sm text-text">
                                <span className="truncate font-medium">
                                    {showUser ? item.user.name : item.type.name}
                                </span>
                                {item.number && !showUser && (
                                    <span className="shrink-0 font-mono text-xs text-text-muted">
                                        {item.number}
                                    </span>
                                )}
                            </span>
                            <span className="mt-0.5 block truncate text-[13px] text-text-muted">
                                {showUser ? `${item.type.name} · ` : ''}
                                {formatRequestPeriod(item)}
                            </span>
                        </span>
                        <StatusBadge
                            status={item.status}
                            label={
                                item.status === 'pending' && item.waiting
                                    ? item.waiting.approver
                                        ? `Menunggu ${item.waiting.approver.name.split(' ')[0]}`
                                        : `Menunggu ${item.waiting.label}`
                                    : item.status_label
                            }
                        />
                    </Link>
                </li>
            ))}
        </ul>
    );
}
