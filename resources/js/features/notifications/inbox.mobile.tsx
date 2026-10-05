import { InfiniteScroll } from '@inertiajs/react';
import { Archive, ArchiveRestore, Check, Inbox, Mail } from 'lucide-react';
import { useMemo } from 'react';
import { EmptyState } from '@/components/empty-state';
import { SwipeableRow } from '@/components/mobile/swipeable-row';
import {
    emptyCopy,
    InboxFooter,
    InboxListSkeleton,
    InboxTabs,
} from '@/features/notifications/inbox-parts';
import { InboxRow } from '@/features/notifications/inbox-row';
import type { InboxState } from '@/features/notifications/use-inbox';
import { groupByDay } from '@/features/notifications/utils';

type Props = {
    inbox: InboxState;
    retentionDays: number;
};

/** Mobile Inbox (mockup MInbox): tabs, day groups, swipe to read/archive. */
export function InboxMobile({ inbox, retentionDays }: Props) {
    const { list, filters, counts } = inbox;
    const groups = useMemo(() => groupByDay(list), [list]);
    const copy = emptyCopy(filters);

    return (
        <div className="-mx-4 space-y-2">
            <div className="px-4">
                <InboxTabs
                    size="lg"
                    value={filters.tab}
                    counts={counts}
                    onChange={(tab) => inbox.setFilters({ tab })}
                />
                {filters.archived && (
                    <p className="mt-2 text-[13px] text-text-muted">
                        Menampilkan arsip.
                    </p>
                )}
            </div>

            {inbox.changingFilters ? (
                <InboxListSkeleton />
            ) : list.length === 0 ? (
                <EmptyState
                    icon={Inbox}
                    title={copy.title}
                    description={copy.description}
                    className="mx-4 mt-6"
                />
            ) : (
                <InfiniteScroll
                    data="items"
                    onlyNext
                    preserveUrl
                    loading={<InboxListSkeleton rows={2} />}
                >
                    {groups.map((group) => (
                        <section key={group.label}>
                            <h2 className="px-4 pt-4 pb-1 text-[13px] font-medium text-text-muted">
                                {group.label}
                            </h2>
                            <ul className="divide-y divide-border border-y border-border">
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
                                                        : inbox.markRead(item)
                                                }
                                            />
                                        </SwipeableRow>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </InfiniteScroll>
            )}

            <div className="px-4 pt-3">
                <InboxFooter retentionDays={retentionDays} />
            </div>
        </div>
    );
}
