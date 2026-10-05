import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowUpRight, CornerDownLeft } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { Fragment, useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    Kbd,
} from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import {
    setCommandPaletteOpen,
    useCommandPaletteOpen,
} from '@/features/search/command-palette-store';
import { HighlightedText } from '@/features/search/highlighted-text';
import { resultTitle } from '@/features/search/result-title';
import { runSearchResult } from '@/features/search/run-search-result';
import { searchIcon } from '@/features/search/search-icon';
import type { SearchGroup, SearchResult } from '@/features/search/types';
import { useSearch } from '@/features/search/use-search';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';

const itemValue = (group: string, item: SearchResult) => `${group}:${item.id}`;

function ResultRow({
    item,
    query,
    title,
}: {
    item: SearchResult;
    query: string;
    title: string;
}) {
    const Icon = searchIcon(item.icon);

    return (
        <>
            {item.icon === 'user' ? (
                <UserAvatar
                    name={item.title}
                    src={item.avatar}
                    className="size-9 text-[13px]"
                />
            ) : (
                <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-link-soft text-link group-data-[selected=true]/item:bg-surface"
                >
                    <Icon className="size-[18px]" strokeWidth={2} />
                </span>
            )}
            {item.code && (
                <span className="min-w-16 shrink-0 font-mono text-[14px] font-semibold whitespace-nowrap text-text-muted">
                    {item.code}
                </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[16px] leading-6 font-semibold text-text">
                    <HighlightedText text={title} query={query} />
                </span>
                {item.snippet && (
                    <span className="truncate text-meta text-text-muted">
                        <HighlightedText text={item.snippet} query={query} />
                    </span>
                )}
            </span>
            {(item.meta ?? item.subtitle) && (
                <span className="hidden max-w-56 shrink-0 truncate text-meta text-text-muted sm:block">
                    {item.meta ?? item.subtitle}
                </span>
            )}
            {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
            {item.external && (
                <ArrowUpRight
                    aria-hidden
                    className="size-4 text-text-subtle"
                    strokeWidth={2.2}
                />
            )}
            <CornerDownLeft
                aria-hidden
                className="hidden size-4 text-link group-data-[selected=true]/item:block"
                strokeWidth={2.2}
            />
        </>
    );
}

function LoadingRows() {
    return (
        <div className="space-y-1 p-3" aria-label="Memuat hasil">
            {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3 px-3 py-2">
                    <Skeleton className="size-9 rounded-[10px]" />
                    <Skeleton className="h-4 flex-1" />
                </div>
            ))}
        </div>
    );
}

/** Centered one-liner inside the palette list (empty / error). */
function Notice({
    tone,
    children,
}: {
    tone: 'muted' | 'danger';
    children: string;
}) {
    return (
        <p
            className={cn(
                'px-6 py-12 text-center text-[16px]',
                tone === 'danger' ? 'text-danger' : 'text-text-muted',
            )}
        >
            {children}
        </p>
    );
}

/**
 * Global command palette (⌘K / Ctrl+K): glass-strong modal 640px (radius
 * 24, e-2), 36px tinted tiles per row like the list rows, groups
 * Aksi · Tugas · Orang · Workspace · Dokumen from the search providers.
 */
export function CommandPalette() {
    const open = useCommandPaletteOpen();
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState('');
    const { groups, loading, error } = useSearch(query, null, open);
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const total = groups.reduce((sum, group) => sum + group.items.length, 0);

    const close = () => {
        setCommandPaletteOpen(false);
        setQuery('');
    };

    const select = (item: SearchResult) => {
        close();
        runSearchResult(item, {
            onAction: (action) => {
                if (action === 'theme.toggle') {
                    updateAppearance(
                        resolvedAppearance === 'dark' ? 'light' : 'dark',
                    );
                }
            },
        });
    };

    // Tab / Shift+Tab jump to the first item of the next / previous group.
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Tab' || groups.length < 2) {
            return;
        }

        event.preventDefault();
        const current = Math.max(
            0,
            groups.findIndex((group) =>
                group.items.some(
                    (item) => itemValue(group.key, item) === selected,
                ),
            ),
        );
        const step = event.shiftKey ? -1 : 1;
        const next: SearchGroup =
            groups[(current + step + groups.length) % groups.length];
        setSelected(itemValue(next.key, next.items[0]));
    };

    return (
        <DialogPrimitive.Root
            open={open}
            onOpenChange={(next) =>
                next ? setCommandPaletteOpen(true) : close()
            }
        >
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/60 backdrop-blur-[3px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    className="glass-strong fixed top-[14vh] left-1/2 z-50 w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-panel shadow-float duration-180 ease-brand data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-98 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-98"
                >
                    <DialogPrimitive.Title className="sr-only">
                        Cari atau jalankan perintah
                    </DialogPrimitive.Title>
                    <Command
                        shouldFilter={false}
                        loop
                        value={selected}
                        onValueChange={setSelected}
                        onKeyDown={onKeyDown}
                    >
                        <div className="relative">
                            <CommandInput
                                autoFocus
                                value={query}
                                onValueChange={setQuery}
                                placeholder="Cari perintah, tugas, dokumen, atau workspace"
                                aria-label="Cari"
                            />
                            <Kbd className="absolute top-1/2 right-4 -translate-y-1/2">
                                Esc
                            </Kbd>
                        </div>
                        <CommandList>
                            {loading && total === 0 && <LoadingRows />}
                            {error && (
                                <Notice tone="danger">
                                    Pencarian gagal. Periksa koneksi lalu coba
                                    lagi.
                                </Notice>
                            )}
                            {!loading && !error && total === 0 && (
                                <Notice tone="muted">
                                    {query.trim()
                                        ? `Tidak ada hasil untuk “${query.trim()}”.`
                                        : 'Ketik untuk mencari tugas, orang, workspace, atau dokumen.'}
                                </Notice>
                            )}
                            {groups.map((group, index) => (
                                <Fragment key={group.key}>
                                    {index > 0 && <CommandSeparator />}
                                    <CommandGroup heading={group.label}>
                                        {group.items.map((item) => (
                                            <CommandItem
                                                key={item.id}
                                                value={itemValue(
                                                    group.key,
                                                    item,
                                                )}
                                                onSelect={() => select(item)}
                                                className="group/item"
                                            >
                                                <ResultRow
                                                    item={item}
                                                    query={query}
                                                    title={resultTitle(
                                                        item,
                                                        resolvedAppearance,
                                                    )}
                                                />
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </Fragment>
                            ))}
                        </CommandList>
                        <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3 text-meta text-text-muted">
                            <Kbd>↑↓</Kbd> pilih
                            <span aria-hidden>·</span>
                            <Kbd>Enter</Kbd> buka
                            <span aria-hidden>·</span>
                            <Kbd>Tab</Kbd> ke grup berikutnya
                            <span className="ml-auto font-semibold tnum">
                                {total} hasil
                            </span>
                        </div>
                    </Command>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
