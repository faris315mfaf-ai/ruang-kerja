import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, ChevronDown, ListTree } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DocArticle } from '@/features/docs/doc-article';
import { DocToc } from '@/features/docs/doc-toc';
import type { DocDetail, DocListItem } from '@/features/docs/types';
import { GUIDE_URL, guideHref } from '@/features/prototype/guide';
import { GuideNav } from '@/features/prototype/guide-nav';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn, focusRing } from '@/lib/utils';

type Props = {
    /** Slug of docs/fitur/PANDUAN-PRATINJAU.md (served at /pratinjau/panduan). */
    guideSlug: string;
    /** The guide and the module docs of docs/fitur (config/docs.php `features`). */
    documents: DocListItem[];
    document: DocDetail;
};

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
 * /pratinjau/panduan — the preview guide (docs/fitur/PANDUAN-PRATINJAU.md)
 * and the module docs, rendered server-side by the same DocumentRenderer as
 * Admin › Dokumentasi, with screenshots. Desktop/tablet: document list, the
 * document and its table of contents. Phone: collapsible table of contents,
 * the document, then the other documents.
 */
export default function PrototypeGuide({
    guideSlug,
    documents,
    document,
}: Props) {
    const breakpoint = useBreakpoint();
    const visiting = useVisiting();
    const mobile = breakpoint === 'mobile';

    const article = (
        <div
            aria-busy={visiting}
            className={cn(
                'min-w-0 transition-opacity duration-180 ease-brand',
                visiting && 'opacity-60',
            )}
        >
            <DocArticle document={document} linkPrefix={GUIDE_URL} />
        </div>
    );

    if (mobile) {
        return (
            <>
                <Head title={document.title} />
                <div className="flex flex-col gap-4">
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
                    {article}
                    <GuideNav
                        documents={documents}
                        guideSlug={guideSlug}
                        currentSlug={document.slug}
                        variant="mobile"
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <Head title={document.title} />
            <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_220px]">
                <aside className={cn('flex min-w-0 flex-col gap-3', STICKY)}>
                    <Link
                        href="/pratinjau"
                        className={cn(
                            'flex min-h-11 items-center gap-2 rounded-control px-2 text-[15px] font-semibold text-link transition-colors duration-120 ease-brand hover:bg-surface-2',
                            focusRing,
                        )}
                    >
                        <ArrowLeft aria-hidden className="size-[18px]" />
                        Kembali ke pratinjau
                    </Link>
                    <GuideNav
                        documents={documents}
                        guideSlug={guideSlug}
                        currentSlug={document.slug}
                        variant="sidebar"
                    />
                </aside>

                {article}

                {document.toc.length > 0 && (
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

PrototypeGuide.layout = (props: Props) => {
    const isGuide = props.document.slug === props.guideSlug;

    return {
        breadcrumbs: [
            { title: 'Pratinjau', href: '/pratinjau' },
            { title: 'Panduan', href: GUIDE_URL },
            ...(isGuide
                ? []
                : [
                      {
                          title: props.document.title,
                          href: guideHref(props.document.slug, props.guideSlug),
                      },
                  ]),
        ],
        title: isGuide ? 'Panduan pratinjau' : props.document.title,
        back: isGuide ? '/pratinjau' : GUIDE_URL,
    };
};
