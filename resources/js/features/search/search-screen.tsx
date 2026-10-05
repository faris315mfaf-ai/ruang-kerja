import { router } from '@inertiajs/react';
import { ArrowUpRight, ChevronRight, Clock, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Chip } from '@/components/mobile/chip-scroller';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { UserAvatar } from '@/components/shell/user-avatar';
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
import { cn } from '@/lib/utils';

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
    const secondary = [item.code, item.subtitle, item.meta]
        .filter(Boolean)
        .join(' · ');

    return (
        <li>
            <button
                type="button"
                onClick={onOpen}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-120 ease-brand hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
            >
                {item.icon === 'user' ? (
                    <UserAvatar
                        name={item.title}
                        src={item.avatar}
                        className="size-10 text-sm"
                    />
                ) : (
                    <span
                        aria-hidden
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary"
                    >
                        <Icon className="size-5" strokeWidth={1.75} />
                    </span>
                )}
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-text">
                        <HighlightedText text={title} query={query} />
                    </span>
                    {item.snippet && (
                        <span className="block truncate text-[13px] text-text-muted">
                            <HighlightedText
                                text={item.snippet}
                                query={query}
                            />
                        </span>
                    )}
                    {secondary && (
                        <span className="block truncate text-[13px] text-text-muted">
                            {secondary}
                        </span>
                    )}
                </span>
                {item.external ? (
                    <ArrowUpRight
                        aria-hidden
                        className="size-4.5 shrink-0 text-text-subtle"
                    />
                ) : (
                    item.url && (
                        <ChevronRight
                            aria-hidden
                            className="size-4.5 shrink-0 text-text-subtle"
                        />
                    )
                )}
            </button>
        </li>
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
            <div className="sticky top-0 z-20 -mx-4 bg-background/95 px-4 pt-safe pb-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0">
                <div className="flex items-center gap-3 pt-3">
                    <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 transition-colors duration-120 ease-brand focus-within:border-primary focus-within:ring-3 focus-within:ring-ring">
                        <Search
                            aria-hidden
                            className="size-5 shrink-0 text-text-muted"
                            strokeWidth={1.75}
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
                            className="h-full min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-text-subtle [&::-webkit-search-cancel-button]:hidden"
                        />
                        {query && (
                            <button
                                type="button"
                                aria-label="Hapus kata kunci"
                                onClick={() => {
                                    setQuery('');
                                    input.current?.focus();
                                }}
                                className="-mr-1.5 flex size-8 items-center justify-center rounded-full bg-surface-2 text-text-muted"
                            >
                                <X className="size-4" aria-hidden />
                            </button>
                        )}
                    </label>
                    <button
                        type="button"
                        onClick={cancel}
                        className="min-h-11 text-[15px] font-medium text-primary focus-visible:underline focus-visible:outline-none"
                    >
                        Batal
                    </button>
                </div>
                <ChipScroller
                    label="Saring hasil"
                    chips={chips}
                    value={chip}
                    onChange={setChip}
                    className="mt-3"
                />
            </div>

            <div className="-mx-4 pb-8 md:mx-0">
                {loading && total === 0 && (
                    <div
                        className="space-y-3 px-4 pt-4"
                        aria-label="Memuat hasil"
                    >
                        {[0, 1, 2, 3].map((row) => (
                            <Skeleton key={row} className="h-12 w-full" />
                        ))}
                    </div>
                )}

                {error && (
                    <p className="px-4 pt-8 text-center text-sm text-danger">
                        Pencarian gagal. Periksa koneksi lalu coba lagi.
                    </p>
                )}

                {!loading && !error && term && total === 0 && (
                    <p className="px-4 pt-8 text-center text-sm text-text-muted">
                        Tidak ada hasil untuk “{term}”.
                    </p>
                )}

                {groups.map((group) => (
                    <section key={group.key} className="pt-4">
                        <h2 className="px-4 pb-1 text-[13px] font-medium text-text-muted">
                            {groupLabel(group)}
                        </h2>
                        <ul>
                            {group.items.map((item) => (
                                <ResultItem
                                    key={item.id}
                                    item={item}
                                    query={term}
                                    title={resultTitle(
                                        item,
                                        resolvedAppearance,
                                    )}
                                    onOpen={() => open(item)}
                                />
                            ))}
                        </ul>
                    </section>
                ))}

                {!term && recent.length > 0 && (
                    <section className="mx-4 mt-4 border-t border-border pt-4">
                        <div className="flex items-center justify-between pb-1">
                            <h2 className="text-[13px] font-medium text-text-muted">
                                Pencarian terakhir
                            </h2>
                            <button
                                type="button"
                                onClick={() => {
                                    clearRecentSearches();
                                    setRecent([]);
                                }}
                                className="min-h-11 px-1 text-[13px] text-text-muted hover:text-text"
                            >
                                Hapus
                            </button>
                        </div>
                        <ul>
                            {recent.map((item) => (
                                <li key={item}>
                                    <button
                                        type="button"
                                        onClick={() => setQuery(item)}
                                        className={cn(
                                            'flex min-h-12 w-full items-center gap-4 text-left text-[15px] text-text',
                                            /^[A-Z]+-\d+$/.test(item) &&
                                                'font-mono',
                                        )}
                                    >
                                        <Clock
                                            aria-hidden
                                            className="size-5 text-text-muted"
                                            strokeWidth={1.75}
                                        />
                                        {item}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </div>
    );
}
