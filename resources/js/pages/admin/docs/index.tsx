import { Head, Link, router } from '@inertiajs/react';
import { BookOpen, ChevronDown, FileText, ListTree } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { AdminPageHeader } from '@/features/admin/page-header';
import { DocArticle } from '@/features/docs/doc-article';
import { DocList } from '@/features/docs/doc-list';
import { DocToc } from '@/features/docs/doc-toc';
import type { DocDetail, DocGroup, DocListItem } from '@/features/docs/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatNumber } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
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
                    <div className="flex flex-col gap-5">
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
                            <details className="group rounded-[22px] border border-border bg-surface">
                                <summary className="flex min-h-13 cursor-pointer list-none items-center gap-2 px-4 text-[16px] font-semibold text-text">
                                    <ListTree
                                        aria-hidden
                                        className="size-5 text-link"
                                    />
                                    Daftar isi
                                    <ChevronDown
                                        aria-hidden
                                        className="ml-auto size-5 text-text-muted transition-transform duration-180 ease-brand group-open:rotate-180 motion-reduce:transition-none"
                                    />
                                </summary>
                                <DocToc
                                    items={document.toc}
                                    className="border-t border-divider p-2 text-[15px]"
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
                        <p className="mb-2 px-2 text-overline text-text-muted">
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
        <AdminPageHeader
            title="Dokumentasi"
            description={`${formatNumber(count)} dokumen proyek: serah terima, hal kritis, arsitektur, database, keamanan, dan ringkasan tiap sprint. Hanya bisa dibaca; sumbernya file Markdown di repositori.`}
        />
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
        <div className="flex flex-col gap-6">
            <Intro count={documents.length} />
            {featured.length > 0 && (
                <section aria-labelledby="docs-start">
                    <h2 id="docs-start" className="mb-3 text-h3">
                        {start?.label}
                    </h2>
                    <ul className="grid gap-4 md:grid-cols-2">
                        {featured.map((doc) => (
                            <li key={doc.slug}>
                                <Link
                                    href={docsRoutes.show.url(doc.slug)}
                                    prefetch
                                    className={cn(
                                        'flex h-full items-center gap-4 rounded-card border border-border bg-surface p-5 shadow-card transition-colors duration-120 ease-brand hover:border-border-strong',
                                        focusRing,
                                    )}
                                >
                                    <span
                                        aria-hidden
                                        className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-grad-soft text-link"
                                    >
                                        <FileText
                                            className="size-5"
                                            strokeWidth={2}
                                        />
                                    </span>
                                    <span className="flex min-w-0 flex-col gap-0.5">
                                        <span className="text-[17px] leading-6 font-semibold text-text">
                                            {doc.title}
                                        </span>
                                        <span className="truncate font-mono text-[13px] font-medium text-text-muted">
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
        { title: 'Admin', href: '' },
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
