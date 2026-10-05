import { InfiniteScroll } from '@inertiajs/react';
import { CheckCheck, Inbox } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { InboxDetail } from '@/features/notifications/inbox-detail';
import '@/features/tasks/register-inbox';
import {
    emptyCopy,
    InboxFilterChips,
    InboxFooter,
    InboxListSkeleton,
} from '@/features/notifications/inbox-parts';
import { InboxRow } from '@/features/notifications/inbox-row';
import type { InboxState } from '@/features/notifications/use-inbox';
import { groupByDay } from '@/features/notifications/utils';
import { cn } from '@/lib/utils';
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

/**
 * Desktop & tablet Inbox (DInbox): title + "Tandai semua dibaca", filter
 * pills, then the list card next to the detail card (sticky, scrolls on its
 * own when taller than the viewport).
 */
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
        <div className="flex flex-col gap-[22px]">
            <section className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-h1 text-text lg:text-display">
                        {filters.archived ? 'Arsip' : 'Inbox'}
                    </h1>
                    <p className="text-body-lg text-text-muted">
                        <span className="tnum">{counts.unread}</span> belum
                        dibaca · <span className="tnum">{counts.action}</span>{' '}
                        perlu tindakan
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={inbox.markAllRead}
                    disabled={counts.unread === 0}
                >
                    <CheckCheck />
                    Tandai semua dibaca
                </Button>
            </section>

            <InboxFilterChips
                filters={filters}
                counts={counts}
                kinds={kinds}
                onChange={inbox.setFilters}
            />

            <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <section
                    aria-label="Daftar notifikasi"
                    className="min-w-0 overflow-hidden rounded-panel border border-border bg-surface shadow-card"
                >
                    {inbox.changingFilters ? (
                        <InboxListSkeleton />
                    ) : list.length === 0 ? (
                        <div className="p-5">
                            <EmptyState
                                icon={Inbox}
                                size="sm"
                                title={copy.title}
                                description={copy.description}
                            />
                        </div>
                    ) : (
                        <InfiniteScroll
                            data="items"
                            onlyNext
                            preserveUrl
                            loading={<InboxListSkeleton rows={2} />}
                        >
                            {groups.map((group, index) => (
                                <div key={group.label}>
                                    <h2
                                        className={cn(
                                            'bg-background px-[22px] pt-4 pb-2 text-[13px] font-bold tracking-[.06em] text-text-muted uppercase',
                                            index > 0 &&
                                                'border-t border-divider',
                                        )}
                                    >
                                        {group.label}
                                    </h2>
                                    <ul className="divide-y divide-divider border-t border-divider">
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
                    <div className="border-t border-divider px-[22px] py-4">
                        <InboxFooter retentionDays={retentionDays} />
                    </div>
                </section>

                {/* Sticky; scrolls on its own when taller than the viewport. The
                    padding (cancelled by the negative margin; 32px on desktop
                    = reach of the panel shadow 0 8px 24px, 24px on tablet
                    where the page gutter is narrower) keeps the scroll box
                    from cutting the shadow into a rectangle. The box overlaps
                    the list column, hence pointer events only on the panel. */}
                <div className="pointer-events-none min-w-0 md:sticky md:top-0 md:-m-6 md:max-h-[100svh] md:overflow-y-auto md:p-6 lg:top-[calc(var(--menu-bar-height)-8px)] lg:-m-8 lg:max-h-[calc(100svh-var(--menu-bar-height)-var(--dock-space)+56px)] lg:p-8 [&>*]:pointer-events-auto">
                    <InboxDetail notification={selected} inbox={inbox} />
                </div>
            </div>
        </div>
    );
}
