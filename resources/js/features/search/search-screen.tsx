import { router } from '@inertiajs/react';
import { ArrowUpRight, ChevronRight, Clock, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Chip } from '@/components/mobile/chip-scroller';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HighlightedText } from '@/features/search/highlighted-text';
import {
    clearRecentSearches,
    readRecentSearches,
    rememberSearch,
} from '@/features/search/recent-searches';
import { resultTitle } from '@/features/search/result-title';
import { runSearchResult } from '@/features/search/run-search-result';
import { searchIcon } from '@/features/search/search-icon';
import type {
    SearchGroup,
    SearchGroupInfo,
    SearchResult,
} from '@/features/search/types';
import { useSearch } from '@/features/search/use-search';
import { useAppearance } from '@/hooks/use-appearance';
import { cn, focusRing } from '@/lib/utils';

type Props = {
    initialQuery: string;
    groups: SearchGroupInfo[];
};

const ALL = 'all';

function groupLabel(group: SearchGroup): string {
    return group.key === 'actions' ? 'Aksi cepat' : group.label;
}

function ResultItem({
    item,
    query,
    title,
    onOpen,
}: {
    item: SearchResult;
    query: string;
    title: string;
    onOpen: () => void;
}) {
    const Icon = searchIcon(item.icon);
    const secondaryRest = [item.subtitle, item.meta]
        .filter(Boolean)
        .join(' · ');
    const secondary = Boolean(item.code || secondaryRest);

    return (
        <li>
            <button
                type="button"
                onClick={onOpen}
                className="flex min-h-[72px] w-full items-center gap-3 bg-surface p-4 text-left text-text transition-colors duration-120 ease-brand hover:bg-surface-2/60 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset active:bg-surface-2"
            >
                {item.icon === 'user' ? (
                    <UserAvatar
                        name={item.title}
                        src={item.avatar}
                        className="size-11 text-[15px]"
                    />
                ) : (
                    <span
                        aria-hidden
                        className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-link-soft text-link"
                    >
                        <Icon className="size-[22px]" strokeWidth={1.9} />
                    </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[17px] leading-[23px] font-semibold">
                        <HighlightedText text={title} query={query} />
                    </span>
                    {item.snippet && (
                        <span className="truncate text-[15px] leading-[22px] text-text-muted">
                            <HighlightedText
                                text={item.snippet}
                                query={query}
                            />
                        </span>
                    )}
                    {secondary && (
                        <span className="truncate text-[15px] leading-[22px] text-text-muted">
                            {item.code && (
                                <span className="font-mono font-semibold">
                                    {item.code}
                                </span>
                            )}
                            {item.code && secondaryRest && ' · '}
                            {secondaryRest}
                        </span>
                    )}
                </span>
                {item.external ? (
                    <ArrowUpRight
                        aria-hidden
                        className="size-[18px] shrink-0 text-text-subtle"
                        strokeWidth={2.4}
                    />
                ) : (
                    item.url && (
                        <ChevronRight
                            aria-hidden
                            className="size-[18px] shrink-0 text-text-subtle"
                            strokeWidth={2.4}
                        />
                    )
                )}
            </button>
        </li>
    );
}

/** Section label + rounded list card (MInbox "HARI INI" + card). */
function ListSection({
    title,
    action,
    children,
}: {
    title: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="flex flex-col gap-3 pt-4">
            <div className="flex min-h-11 items-end justify-between gap-3 px-1">
                <h2 className="pb-1 text-overline text-text-muted">{title}</h2>
                {action}
            </div>
            <ul className="divide-y divide-divider overflow-hidden rounded-[22px] border border-border bg-surface">
                {children}
            </ul>
        </section>
    );
}

/**
 * Full-screen search (mockup MCari). Mobile reaches it from the app bar;
 * desktop users normally use the command palette but /cari works too.
 */
export function SearchScreen({ initialQuery, groups: providers }: Props) {
    const [query, setQuery] = useState(initialQuery);
    const [chip, setChip] = useState<string>(ALL);
    const [recent, setRecent] = useState<string[]>([]);
    const input = useRef<HTMLInputElement>(null);
    const { groups, loading, error } = useSearch(
        query,
        chip === ALL ? null : chip,
    );
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const term = query.trim();
    const total = groups.reduce((sum, group) => sum + group.items.length, 0);

    useEffect(() => {
        setRecent(readRecentSearches());
        input.current?.focus();
    }, []);

    const counts = new Map(
        groups.map((group) => [group.key, group.items.length]),
    );
    const chips: Chip<string>[] = [
        { value: ALL, label: 'Semua' },
        ...providers
            .filter((provider) => provider.key !== 'actions')
            .map((provider) => ({
                value: provider.key,
                label: provider.label,
                count:
                    term && counts.get(provider.key)
                        ? counts.get(provider.key)
                        : undefined,
            })),
    ];

    const open = (item: SearchResult) => {
        setRecent(rememberSearch(term));
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

    const cancel = () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            router.visit('/dashboard');
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col">
            <h1 className="hidden pb-4 text-h1 text-text md:block lg:text-display">
                Cari
            </h1>
            <div className="sticky top-0 z-20 -mx-4 bg-background/95 px-4 pt-safe pb-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
                <div className="flex items-center gap-2 pt-3 md:pt-0">
                    <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-control border border-border-strong bg-surface px-3.5 transition-[border-color,box-shadow] duration-120 ease-brand focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring">
                        <Search
                            aria-hidden
                            className="size-[22px] shrink-0 text-text-muted"
                            strokeWidth={2}
                        />
                        <span className="sr-only">Cari</span>
                        <input
                            ref={input}
                            type="search"
                            inputMode="search"
                            enterKeyHint="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Cari tugas, dokumen, orang, atau workspace"
                            className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-text outline-none placeholder:text-text-subtle md:text-[16px] [&::-webkit-search-cancel-button]:hidden"
                        />
                        {query && (
                            <button
                                type="button"
                                aria-label="Hapus kata kunci"
                                onClick={() => {
                                    setQuery('');
                                    input.current?.focus();
                                }}
                                className={cn(
                                    '-mr-2 flex size-11 items-center justify-center rounded-full text-text-muted',
                                    focusRing,
                                )}
                            >
                                <span className="flex size-7 items-center justify-center rounded-full bg-surface-2">
                                    <X className="size-4" aria-hidden />
                                </span>
                            </button>
                        )}
                    </label>
                    <Button variant="quiet" onClick={cancel} className="px-3">
                        Batal
                    </Button>
                </div>
                <ChipScroller
                    label="Saring hasil"
                    chips={chips}
                    value={chip}
                    onChange={setChip}
                    className="mt-3 md:mx-0 md:scroll-px-0 md:px-0"
                />
            </div>

            <div className="pb-8">
                {loading && total === 0 && (
                    <div
                        className="mt-4 divide-y divide-divider overflow-hidden rounded-[22px] border border-border bg-surface"
                        aria-label="Memuat hasil"
                    >
                        {[0, 1, 2, 3].map((row) => (
                            <div key={row} className="flex gap-3 p-4">
                                <Skeleton className="size-11 rounded-[14px]" />
                                <div className="flex-1 space-y-2 pt-0.5">
                                    <Skeleton className="h-4 w-2/3" />
                                    <Skeleton className="h-3.5 w-1/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <EmptyState
                        icon={Search}
                        size="sm"
                        title="Pencarian gagal"
                        description="Periksa koneksi lalu coba lagi."
                        className="mt-4"
                    />
                )}

                {!loading && !error && term && total === 0 && (
                    <EmptyState
                        icon={Search}
                        size="sm"
                        title={`Tidak ada hasil untuk “${term}”.`}
                        description="Coba kata kunci lain atau pilih jenis Semua."
                        className="mt-4"
                    />
                )}

                {groups.map((group) => (
                    <ListSection key={group.key} title={groupLabel(group)}>
                        {group.items.map((item) => (
                            <ResultItem
                                key={item.id}
                                item={item}
                                query={term}
                                title={resultTitle(item, resolvedAppearance)}
                                onOpen={() => open(item)}
                            />
                        ))}
                    </ListSection>
                ))}

                {!term && recent.length > 0 && (
                    <ListSection
                        title="Pencarian terakhir"
                        action={
                            <Button
                                variant="quiet"
                                size="sm"
                                onClick={() => {
                                    clearRecentSearches();
                                    setRecent([]);
                                }}
                            >
                                Hapus
                            </Button>
                        }
                    >
                        {recent.map((item) => (
                            <li key={item}>
                                <button
                                    type="button"
                                    onClick={() => setQuery(item)}
                                    className={cn(
                                        'flex min-h-14 w-full items-center gap-3 bg-surface px-4 text-left text-[17px] text-text transition-colors duration-120 ease-brand hover:bg-surface-2/60 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                                        /^[A-Z]+-\d+$/.test(item) &&
                                            'font-mono font-semibold',
                                    )}
                                >
                                    <Clock
                                        aria-hidden
                                        className="size-5 text-text-muted"
                                        strokeWidth={2}
                                    />
                                    {item}
                                </button>
                            </li>
                        ))}
                    </ListSection>
                )}
            </div>
        </div>
    );
}
