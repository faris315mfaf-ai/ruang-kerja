import { FileText } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { ListRow } from '@/components/ui/list-row';
import { formatRequestPeriod, statusTone } from '@/lib/requests';
import type { Tone } from '@/lib/requests';
import type { RequestItem } from '@/types/requests';

const BADGE_TONE: Record<Tone, BadgeTone> = {
    warning: 'warning',
    success: 'success',
    danger: 'danger',
    info: 'info',
    muted: 'neutral',
};

function statusLabel(item: RequestItem): string {
    if (item.status === 'pending' && item.waiting) {
        return item.waiting.approver
            ? `Menunggu ${item.waiting.approver.name.split(' ')[0]}`
            : `Menunggu ${item.waiting.label}`;
    }

    return item.status_label;
}

/**
 * "Pengajuan saya" / approval queue rows (SBeranda, DBeranda "Menunggu
 * persetujuan"): type or requester, period, status pill (text + dot).
 */
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
        return (
            <div className="px-5 pb-2 md:px-7">
                <EmptyState size="sm" icon={FileText} title={empty} />
            </div>
        );
    }

    return (
        <ul className="divide-y divide-divider border-t border-divider">
            {items.map((item) => (
                <li key={item.id}>
                    <ListRow
                        href={`${hrefBase}/${item.id}`}
                        leading={
                            showUser ? (
                                <UserAvatar
                                    name={item.user.name}
                                    src={item.user.avatar}
                                    className="size-11 text-[15px]"
                                />
                            ) : undefined
                        }
                        title={showUser ? item.user.name : item.type.name}
                        meta={
                            <>
                                {showUser
                                    ? `${item.type.name} · `
                                    : item.number && (
                                          <span className="font-mono text-[14px] font-semibold">
                                              {item.number} ·{' '}
                                          </span>
                                      )}
                                {formatRequestPeriod(item)}
                            </>
                        }
                        trailing={
                            <Badge
                                variant="status"
                                tone={BADGE_TONE[statusTone[item.status]]}
                                dot
                                className="h-[30px] text-[14px]"
                            >
                                {statusLabel(item)}
                            </Badge>
                        }
                    />
                </li>
            ))}
        </ul>
    );
}
