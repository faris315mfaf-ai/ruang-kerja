import { Head, Link, router } from '@inertiajs/react';
import { BookOpen, ChevronDown, FileText, ListTree } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { DocArticle } from '@/features/docs/doc-article';
import { DocList } from '@/features/docs/doc-list';
import { DocToc } from '@/features/docs/doc-toc';
import type { DocDetail, DocGroup, DocListItem } from '@/features/docs/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import docsRoutes from '@/routes/admin/docs';

type Props = {
    documents: DocListItem[];
    groups: DocGroup[];
    document: DocDetail | null;
};

const INDEX_URL = '/admin/dokumentasi';
const STICKY =
    'lg:sticky lg:top-[calc(var(--menu-bar-height,0px)+var(--screen-gutter,16px))] lg:max-h-[calc(100dvh-var(--menu-bar-height,0px)-var(--dock-space,0px)-2*var(--screen-gutter,16px))] lg:overflow-y-auto';

/** True while an Inertia visit (opening another document) is in flight. */
function useVisiting(): boolean {
    const [visiting, setVisiting] = useState(false);

    useEffect(() => {
        const offStart = router.on('start', () => setVisiting(true));
        const offFinish = router.on('finish', () => setVisiting(false));

        return () => {
            offStart();
            offFinish();
        };
    }, []);

    return visiting;
}

/**
 * Admin › Dokumentasi (Super Admin, read-only): curated repository docs
 * rendered server-side. Desktop/tablet: document list with search, the
 * document and its table of contents. Mobile: a simple reading view (list →
 * document with a collapsible table of contents) — reading docs on a phone is
 * useful and nothing here needs a wide screen to operate.
 */
export default function DocsIndex({ documents, groups, document }: Props) {
    const breakpoint = useBreakpoint();
    const visiting = useVisiting();
    const title = document?.title ?? 'Dokumentasi';

    if (breakpoint === 'mobile') {
        return (
            <>
                <Head title={title} />
                {document === null ? (
                    <div className="space-y-4">
                        <Intro count={documents.length} />
                        <DocList
                            documents={documents}
                            groups={groups}
                            variant="mobile"
                        />
                    </div>
                ) : (
                    <div
                        aria-busy={visiting}
                        className={cn(
                            'space-y-3 transition-opacity duration-180 ease-brand',
                            visiting && 'opacity-60',
                        )}
                    >
                        {document.toc.length > 0 && (
                            <details className="group rounded-lg border border-border bg-surface">
                                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-[15px] font-medium text-text">
                                    <ListTree
                                        aria-hidden
                                        className="size-4 text-text-muted"
                                    />
                                    Daftar isi
                                    <ChevronDown
                                        aria-hidden
                                        className="ml-auto size-4 text-text-muted transition-transform duration-180 ease-brand group-open:rotate-180"
                                    />
                                </summary>
                                <DocToc
                                    items={document.toc}
                                    className="border-t border-border p-2 text-[15px]"
                                />
                            </details>
                        )}
                        <DocArticle document={document} />
                    </div>
                )}
            </>
        );
    }

    return (
        <>
            <Head title={title} />
            <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_220px]">
                <aside className={cn('min-w-0', STICKY)}>
                    <DocList
                        documents={documents}
                        groups={groups}
                        currentSlug={document?.slug}
                        variant="sidebar"
                    />
                </aside>

                <div
                    aria-busy={visiting}
                    className={cn(
                        'min-w-0 transition-opacity duration-180 ease-brand',
                        visiting && 'opacity-60',
                    )}
                >
                    {document === null ? (
                        <Overview documents={documents} groups={groups} />
                    ) : (
                        <DocArticle document={document} />
                    )}
                </div>

                {document !== null && document.toc.length > 0 && (
                    <nav
                        aria-label="Daftar isi"
                        className={cn('hidden min-w-0 xl:block', STICKY)}
                    >
                        <p className="mb-1 px-2 text-xs font-medium tracking-wide text-text-subtle uppercase">
                            Daftar isi
                        </p>
                        <DocToc items={document.toc} />
                    </nav>
                )}
            </div>
        </>
    );
}

function Intro({ count }: { count: number }) {
    return (
        <header>
            <h1 className="text-xl leading-7 font-semibold text-text">
                Dokumentasi
            </h1>
            <p className="text-sm text-text-muted">
                {formatNumber(count)} dokumen proyek: serah terima, hal kritis,
                arsitektur, database, keamanan, dan ringkasan tiap sprint. Hanya
                bisa dibaca; sumbernya file Markdown di repositori.
            </p>
        </header>
    );
}

/** Desktop landing: what is here, with the "start here" docs as cards. */
function Overview({
    documents,
    groups,
}: {
    documents: DocListItem[];
    groups: DocGroup[];
}) {
    if (documents.length === 0) {
        return (
            <EmptyState
                icon={BookOpen}
                title="Belum ada dokumen"
                description="Berkas dokumentasi tidak ditemukan di server. Periksa daftar di config/docs.php dan pastikan folder docs/ ikut dipasang."
            />
        );
    }

    const start = groups[0];
    const featured = documents.filter((doc) => doc.group === start?.key);

    return (
        <div className="space-y-5">
            <Intro count={documents.length} />
            {featured.length > 0 && (
                <section aria-labelledby="docs-start">
                    <h2
                        id="docs-start"
                        className="mb-2 text-sm font-semibold text-text"
                    >
                        {start?.label}
                    </h2>
                    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {featured.map((doc) => (
                            <li key={doc.slug}>
                                <Link
                                    href={docsRoutes.show.url(doc.slug)}
                                    className="flex h-full items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-card transition-colors duration-150 ease-brand hover:border-border-strong"
                                >
                                    <FileText
                                        aria-hidden
                                        className="mt-0.5 size-5 shrink-0 text-primary"
                                        strokeWidth={1.75}
                                    />
                                    <span className="min-w-0">
                                        <span className="block font-medium text-text">
                                            {doc.title}
                                        </span>
                                        <span className="block truncate font-mono text-xs text-text-muted">
                                            {doc.path}
                                        </span>
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

DocsIndex.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Admin', href: INDEX_URL },
        { title: 'Dokumentasi', href: INDEX_URL },
        ...(props.document
            ? [
                  {
                      title: props.document.title,
                      href: `${INDEX_URL}/${props.document.slug}`,
                  },
              ]
            : []),
    ],
    title: props.document?.title ?? 'Dokumentasi',
    back: props.document ? INDEX_URL : '/menu',
});
