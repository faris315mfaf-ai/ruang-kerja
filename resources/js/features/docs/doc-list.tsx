import { Link } from '@inertiajs/react';
import { ChevronRight, FileText, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn, focusRing } from '@/lib/utils';
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
        <div
            className={cn(
                'flex flex-col gap-4',
                !mobile &&
                    'rounded-panel border border-border bg-surface p-4 shadow-card',
            )}
        >
            <div className="relative">
                <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-text-muted"
                />
                <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari dokumen…"
                    aria-label="Cari dokumen"
                    className={cn('pl-11', mobile && 'text-[17px]')}
                />
            </div>

            {sections.length === 0 ? (
                <p className="px-1 py-6 text-center text-[15px] text-text-muted">
                    Tidak ada dokumen yang cocok dengan “{query.trim()}”.
                </p>
            ) : (
                <nav
                    aria-label="Daftar dokumen"
                    className="flex flex-col gap-4"
                >
                    {sections.map(({ group, documents: items }) => (
                        <section key={group.key}>
                            <h2 className="mb-1.5 px-2 text-overline text-text-muted">
                                {group.label}
                            </h2>
                            <ul
                                className={cn(
                                    mobile &&
                                        'divide-y divide-divider overflow-hidden rounded-[22px] border border-border bg-surface',
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
                                                title={`${doc.title} · ${doc.path}`}
                                                className={cn(
                                                    'flex items-center gap-3 text-text transition-colors duration-120 ease-brand',
                                                    focusRing,
                                                    mobile &&
                                                        'focus-visible:ring-inset',
                                                    mobile
                                                        ? 'min-h-14 px-4 py-2 text-[16px] font-semibold active:bg-surface-2'
                                                        : 'min-h-10 rounded-control px-2.5 py-2 text-[15px] hover:bg-surface-2',
                                                    active &&
                                                        'bg-link-soft font-semibold text-link hover:bg-link-soft',
                                                )}
                                            >
                                                <FileText
                                                    aria-hidden
                                                    className={cn(
                                                        'size-[18px] shrink-0',
                                                        active
                                                            ? 'text-link'
                                                            : 'text-text-subtle',
                                                    )}
                                                />
                                                <span
                                                    className={cn(
                                                        'min-w-0 flex-1',
                                                        mobile
                                                            ? 'line-clamp-2'
                                                            : 'truncate',
                                                    )}
                                                >
                                                    {doc.title}
                                                </span>
                                                {mobile && (
                                                    <ChevronRight
                                                        aria-hidden
                                                        className="size-[18px] shrink-0 text-text-subtle"
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
