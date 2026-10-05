import { InfiniteScroll } from '@inertiajs/react';
import { Archive, ArchiveRestore, Check, Inbox, Mail } from 'lucide-react';
import { useMemo } from 'react';
import { EmptyState } from '@/components/empty-state';
import { SwipeableRow } from '@/components/mobile/swipeable-row';
import {
    emptyCopy,
    InboxFilterChips,
    InboxFooter,
    InboxListSkeleton,
} from '@/features/notifications/inbox-parts';
import { InboxRow } from '@/features/notifications/inbox-row';
import type { InboxState } from '@/features/notifications/use-inbox';
import { groupByDay } from '@/features/notifications/utils';
import type { InboxKind } from '@/types/notifications';

type Props = {
    inbox: InboxState;
    kinds: InboxKind[];
    retentionDays: number;
};

/**
 * Mobile Inbox (MInbox + MNotifCenter chips): filter pills, day groups as
 * rounded cards ("HARI INI · 3 BARU"), swipe to read/archive.
 */
export function InboxMobile({ inbox, kinds, retentionDays }: Props) {
    const { list, filters, counts } = inbox;
    const groups = useMemo(() => groupByDay(list), [list]);
    const copy = emptyCopy(filters);

    return (
        <div className="flex flex-col gap-3.5">
            <InboxFilterChips
                scroll
                filters={filters}
                counts={counts}
                kinds={kinds}
                onChange={inbox.setFilters}
            />
            {filters.archived && (
                <p className="text-meta text-text-muted">Menampilkan arsip.</p>
            )}

            {inbox.changingFilters ? (
                <div className="overflow-hidden rounded-[22px] border border-border bg-surface">
                    <InboxListSkeleton />
                </div>
            ) : list.length === 0 ? (
                <EmptyState
                    icon={Inbox}
                    title={copy.title}
                    description={copy.description}
                    className="mt-2"
                />
            ) : (
                <InfiniteScroll
                    data="items"
                    onlyNext
                    preserveUrl
                    className="flex flex-col gap-3.5"
                    loading={
                        <div className="overflow-hidden rounded-[22px] border border-border bg-surface">
                            <InboxListSkeleton rows={2} />
                        </div>
                    }
                >
                    {groups.map((group) => {
                        const fresh = group.items.filter(
                            (item) => item.read_at === null,
                        ).length;

                        return (
                            <section
                                key={group.label}
                                className="flex flex-col gap-3.5"
                            >
                                <h2 className="px-1 pt-1.5 text-overline text-text-muted">
                                    {group.label}
                                    {fresh > 0 && ` · ${fresh} baru`}
                                </h2>
                                <ul className="divide-y divide-divider overflow-hidden rounded-[22px] border border-border bg-surface">
                                    {group.items.map((item) => (
                                        <li key={item.id}>
                                            <SwipeableRow
                                                actions={[
                                                    item.read_at
                                                        ? {
                                                              label: 'Belum dibaca',
                                                              icon: Mail,
                                                              tone: 'info',
                                                              onAction: () =>
                                                                  inbox.markUnread(
                                                                      item,
                                                                  ),
                                                          }
                                                        : {
                                                              label: 'Dibaca',
                                                              icon: Check,
                                                              tone: 'info',
                                                              onAction: () =>
                                                                  inbox.markRead(
                                                                      item,
                                                                  ),
                                                          },
                                                    item.archived_at
                                                        ? {
                                                              label: 'Kembalikan',
                                                              icon: ArchiveRestore,
                                                              tone: 'primary',
                                                              onAction: () =>
                                                                  inbox.unarchive(
                                                                      item,
                                                                  ),
                                                          }
                                                        : {
                                                              label: 'Arsipkan',
                                                              icon: Archive,
                                                              tone: 'primary',
                                                              onAction: () =>
                                                                  inbox.archive(
                                                                      item,
                                                                  ),
                                                          },
                                                ]}
                                            >
                                                <InboxRow
                                                    variant="mobile"
                                                    notification={item}
                                                    onClick={() =>
                                                        item.url
                                                            ? inbox.open(item)
                                                            : inbox.markRead(
                                                                  item,
                                                              )
                                                    }
                                                />
                                            </SwipeableRow>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        );
                    })}
                </InfiniteScroll>
            )}

            <div className="px-1 pt-1">
                <InboxFooter retentionDays={retentionDays} />
            </div>
        </div>
    );
}
