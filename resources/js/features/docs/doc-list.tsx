import { Link } from '@inertiajs/react';
import { ChevronRight, FileText, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import docsRoutes from '@/routes/admin/docs';
import { filterDocs } from './filter';
import type { DocGroup, DocListItem } from './types';

type Props = {
    documents: DocListItem[];
    groups: DocGroup[];
    currentSlug?: string | null;
    /** `sidebar`: compact desktop list; `mobile`: full-width rows ≥ 44px. */
    variant: 'sidebar' | 'mobile';
};

/** Searchable, grouped list of the allowlisted docs. */
export function DocList({ documents, groups, currentSlug, variant }: Props) {
    const [query, setQuery] = useState('');
    const sections = useMemo(
        () => filterDocs(documents, groups, query),
        [documents, groups, query],
    );
    const mobile = variant === 'mobile';

    return (
        <div className="space-y-3">
            <div className="relative">
                <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle"
                />
                <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari dokumen…"
                    aria-label="Cari dokumen"
                    className={cn(
                        'bg-surface pl-9',
                        mobile && 'h-11 text-base md:text-base',
                    )}
                />
            </div>

            {sections.length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-text-muted">
                    Tidak ada dokumen yang cocok dengan “{query.trim()}”.
                </p>
            ) : (
                <nav aria-label="Daftar dokumen" className="space-y-4">
                    {sections.map(({ group, documents: items }) => (
                        <section key={group.key}>
                            <h2 className="mb-1 px-2 text-xs font-medium tracking-wide text-text-subtle uppercase">
                                {group.label}
                            </h2>
                            <ul
                                className={cn(
                                    mobile &&
                                        'divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface',
                                )}
                            >
                                {items.map((doc) => {
                                    const active = doc.slug === currentSlug;

                                    return (
                                        <li key={doc.slug}>
                                            <Link
                                                href={docsRoutes.show.url(
                                                    doc.slug,
                                                )}
                                                prefetch
                                                aria-current={
                                                    active ? 'page' : undefined
                                                }
                                                title={doc.path}
                                                className={cn(
                                                    'flex items-center gap-2 text-text transition-colors duration-150 ease-brand',
                                                    mobile
                                                        ? 'min-h-12 px-3 py-2 text-[15px] active:bg-surface-2'
                                                        : 'min-h-8 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2',
                                                    active &&
                                                        'bg-primary/10 font-medium text-primary hover:bg-primary/10',
                                                )}
                                            >
                                                <FileText
                                                    aria-hidden
                                                    className={cn(
                                                        'size-4 shrink-0',
                                                        active
                                                            ? 'text-primary'
                                                            : 'text-text-subtle',
                                                    )}
                                                />
                                                <span className="min-w-0 flex-1 truncate">
                                                    {doc.title}
                                                </span>
                                                {mobile && (
                                                    <ChevronRight
                                                        aria-hidden
                                                        className="size-4 shrink-0 text-text-subtle"
                                                    />
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </nav>
            )}
        </div>
    );
}
