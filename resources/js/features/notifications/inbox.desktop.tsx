import { InfiniteScroll } from '@inertiajs/react';
import { CheckCheck, Inbox } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { InboxDetail } from '@/features/notifications/inbox-detail';
import '@/features/tasks/register-inbox';
import {
    emptyCopy,
    InboxFilterMenu,
    InboxFooter,
    InboxListSkeleton,
    InboxTabs,
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

function isTyping(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    );
}

/** Desktop & tablet Inbox: list (420px) + detail pane (mockup Inbox). */
export function InboxDesktop({ inbox, kinds, retentionDays }: Props) {
    const { list, filters, counts } = inbox;
    const [selectedId, setSelectedId] = useState<string | null>(
        list[0]?.id ?? null,
    );
    const selected =
        list.find((item) => item.id === selectedId) ?? list[0] ?? null;
    const groups = useMemo(() => groupByDay(list), [list]);
    const copy = emptyCopy(filters);

    const select = (id: string) => {
        setSelectedId(id);
        const item = list.find((candidate) => candidate.id === id);

        if (item) {
            inbox.markRead(item);
        }
    };

    // Keep a valid selection when the selected item leaves the list (archived).
    useEffect(() => {
        if (selectedId && !list.some((item) => item.id === selectedId)) {
            setSelectedId(list[0]?.id ?? null);
        }
    }, [list, selectedId]);

    // Linear-style shortcuts: J/K move, E archive, U toggle read, Enter open.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                isTyping(event.target)
            ) {
                return;
            }

            const index = selected
                ? list.findIndex((item) => item.id === selected.id)
                : -1;
            const key = event.key.toLowerCase();

            if ((key === 'j' || key === 'k') && list.length > 0) {
                event.preventDefault();
                const next =
                    list[
                        Math.min(
                            list.length - 1,
                            Math.max(0, index + (key === 'j' ? 1 : -1)),
                        )
                    ];
                select(next.id);
                document
                    .querySelector(`[data-notification-id="${next.id}"]`)
                    ?.scrollIntoView({ block: 'nearest' });
            } else if (key === 'e' && selected) {
                event.preventDefault();

                if (selected.archived_at) {
                    inbox.unarchive(selected);
                } else {
                    inbox.archive(selected);
                }
            } else if (key === 'u' && selected) {
                event.preventDefault();
                inbox.toggleRead(selected);
            } else if (
                event.key === 'Enter' &&
                selected?.url &&
                event.target === document.body
            ) {
                event.preventDefault();
                inbox.open(selected);
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    });

    return (
        <div className="-m-4 flex h-[calc(100svh-3.5rem)] min-h-0 lg:-m-6">
            <section
                aria-label="Daftar notifikasi"
                className="flex w-[380px] shrink-0 flex-col border-r border-border xl:w-[420px]"
            >
                <div className="space-y-3 border-b border-border px-4 pt-4 pb-3">
                    <div className="flex items-center gap-2">
                        <h1 className="flex-1 text-xl leading-7 font-semibold text-text">
                            {filters.archived ? 'Arsip' : 'Inbox'}
                        </h1>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={inbox.markAllRead}
                            disabled={counts.unread === 0}
                        >
                            <CheckCheck />
                            Tandai semua dibaca
                        </Button>
                        <InboxFilterMenu
                            filters={filters}
                            kinds={kinds}
                            onChange={inbox.setFilters}
                        />
                    </div>
                    <InboxTabs
                        value={filters.tab}
                        counts={counts}
                        onChange={(tab) => inbox.setFilters({ tab })}
                    />
                </div>

                <div
                    className="min-h-0 flex-1 overflow-y-auto"
                    id="inbox-scroll"
                >
                    {inbox.changingFilters ? (
                        <InboxListSkeleton />
                    ) : list.length === 0 ? (
                        <EmptyState
                            icon={Inbox}
                            title={copy.title}
                            description={copy.description}
                            className="m-4 border-none"
                        />
                    ) : (
                        <InfiniteScroll
                            data="items"
                            onlyNext
                            preserveUrl
                            className="px-2 pb-2"
                            loading={<InboxListSkeleton rows={2} />}
                        >
                            {groups.map((group) => (
                                <div key={group.label}>
                                    <h2 className="px-3 pt-4 pb-1.5 text-[11px] font-medium tracking-[.04em] text-text-muted uppercase">
                                        {group.label}
                                    </h2>
                                    <ul className="space-y-0.5">
                                        {group.items.map((item) => (
                                            <li key={item.id}>
                                                <InboxRow
                                                    variant="desktop"
                                                    notification={item}
                                                    selected={
                                                        item.id === selected?.id
                                                    }
                                                    onClick={() =>
                                                        select(item.id)
                                                    }
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </InfiniteScroll>
                    )}
                </div>

                <div className="border-t border-border px-4 py-3">
                    <InboxFooter retentionDays={retentionDays} />
                </div>
            </section>

            <div className="min-w-0 flex-1">
                <InboxDetail notification={selected} inbox={inbox} />
            </div>
        </div>
    );
}
