import { router, usePage } from '@inertiajs/react';
import { Archive, CheckCheck, Filter } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { cn } from '@/lib/utils';
import InboxNotificationController from '@/actions/App/Http/Controllers/Notifications/InboxNotificationController';
import { inbox as inboxRoute } from '@/routes';
import type { InboxFilters, InboxKind } from '@/types/notifications';

const iconButton =
    'relative flex size-11 items-center justify-center rounded-full text-text transition-colors duration-120 ease-brand hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

type PageProps = { filters?: InboxFilters; kinds?: InboxKind[] };

/**
 * Mobile app bar actions for /inbox (mockup MInbox): filter sheet and
 * "Tandai semua dibaca". Self-contained so it can be passed via Page.layout.
 */
export function InboxAppBarActions() {
    const { filters, kinds = [] } = usePage<PageProps>().props;
    const [open, setOpen] = useState(false);

    if (!filters) {
        return null;
    }

    const apply = (next: Partial<InboxFilters>) => {
        const merged = { ...filters, ...next };
        const query: Record<string, string> = {};

        if (merged.tab !== 'all') {
            query.tab = merged.tab;
        }

        if (merged.kind) {
            query.kind = merged.kind;
        }

        if (merged.archived) {
            query.archived = '1';
        }

        setOpen(false);
        router.visit(inboxRoute.url({ query }), {
            preserveState: true,
            replace: true,
            reset: ['items'],
        });
    };

    const options = [{ value: '', label: 'Semua jenis' }, ...kinds];
    const active = filters.kind !== null || filters.archived;

    return (
        <>
            <button
                type="button"
                className={iconButton}
                aria-label="Saring jenis notifikasi"
                onClick={() => setOpen(true)}
            >
                <Filter className="size-5.5" strokeWidth={1.75} />
                {active && (
                    <span
                        aria-hidden
                        className="absolute top-2.5 right-2.5 size-2 rounded-full bg-primary"
                    />
                )}
            </button>
            <button
                type="button"
                className={iconButton}
                aria-label="Tandai semua dibaca"
                onClick={() =>
                    router.visit(InboxNotificationController.readAll(), {
                        preserveScroll: true,
                        preserveState: false,
                    })
                }
            >
                <CheckCheck className="size-5.5" strokeWidth={1.75} />
            </button>

            <BottomSheet
                open={open}
                onOpenChange={setOpen}
                title="Saring notifikasi"
            >
                <div
                    role="radiogroup"
                    aria-label="Jenis"
                    className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface"
                >
                    {options.map((option) => {
                        const checked = (filters.kind ?? '') === option.value;

                        return (
                            <button
                                key={option.value || 'all'}
                                type="button"
                                role="radio"
                                aria-checked={checked}
                                onClick={() =>
                                    apply({ kind: option.value || null })
                                }
                                className={cn(
                                    'flex min-h-12 w-full items-center justify-between px-4 text-left text-[15px]',
                                    checked
                                        ? 'font-medium text-primary'
                                        : 'text-text',
                                )}
                            >
                                {option.label}
                                {checked && (
                                    <span
                                        aria-hidden
                                        className="size-2 rounded-full bg-primary"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={filters.archived}
                    onClick={() => apply({ archived: !filters.archived })}
                    className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 text-left text-[15px] text-text"
                >
                    <Archive
                        className="size-5 text-text-muted"
                        strokeWidth={1.75}
                        aria-hidden
                    />
                    <span className="flex-1">Tampilkan arsip</span>
                    <span className="text-sm text-text-muted">
                        {filters.archived ? 'Aktif' : 'Nonaktif'}
                    </span>
                </button>
            </BottomSheet>
        </>
    );
}
