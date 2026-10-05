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
                    className="size-5 text-[9px]"
                />
            ) : (
                <Icon
                    aria-hidden
                    className="size-4 text-text-muted"
                    strokeWidth={1.75}
                />
            )}
            {item.code && (
                <span className="min-w-16 shrink-0 font-mono text-[14px] font-semibold whitespace-nowrap text-text-muted">
                    {item.code}
                </span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-text">
                    <HighlightedText text={title} query={query} />
                </span>
                {item.snippet && (
                    <span className="block truncate text-[14px] text-text-muted">
                        <HighlightedText text={item.snippet} query={query} />
                    </span>
                )}
            </span>
            {(item.meta ?? item.subtitle) && (
                <span className="hidden max-w-56 shrink-0 truncate text-[14px] text-text-muted sm:block">
                    {item.meta ?? item.subtitle}
                </span>
            )}
            {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
            {item.external && (
                <ArrowUpRight
                    aria-hidden
                    className="size-3.5 text-text-subtle"
                />
            )}
            <CornerDownLeft
                aria-hidden
                className="hidden size-3.5 text-text-subtle group-data-[selected=true]/item:block"
            />
        </>
    );
}

function LoadingRows() {
    return (
        <div className="space-y-2 p-4" aria-label="Memuat hasil">
            {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-8 w-full" />
            ))}
        </div>
    );
}

/**
 * Global command palette (⌘K / Ctrl+K): glass modal 640px, groups
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
                                <p className="py-10 text-center text-[16px] text-danger">
                                    Pencarian gagal. Periksa koneksi lalu coba
                                    lagi.
                                </p>
                            )}
                            {!loading && !error && total === 0 && (
                                <p className="py-10 text-center text-[16px] text-text-muted">
                                    {query.trim()
                                        ? `Tidak ada hasil untuk “${query.trim()}”.`
                                        : 'Ketik untuk mencari tugas, orang, workspace, atau dokumen.'}
                                </p>
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
                        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-xs text-text-muted">
                            <Kbd>↑↓</Kbd> pilih
                            <span aria-hidden>·</span>
                            <Kbd>Enter</Kbd> buka
                            <span aria-hidden>·</span>
                            <Kbd>Tab</Kbd> ke grup berikutnya
                            <span className="ml-auto tnum">{total} hasil</span>
                        </div>
                    </Command>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
