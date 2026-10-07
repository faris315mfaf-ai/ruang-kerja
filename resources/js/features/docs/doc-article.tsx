import { router } from '@inertiajs/react';
import type { MouseEvent } from 'react';
import { formatDateTime } from '@/lib/format';
import type { DocDetail } from './types';

const DOCS_PREFIX = '/admin/dokumentasi/';

/**
 * The rendered document. Links to other docs (rewritten server-side to
 * /admin/dokumentasi/… or, in the preview guide, /pratinjau/panduan…)
 * navigate inside the app instead of reloading.
 */
export function DocArticle({
    document,
    linkPrefix = DOCS_PREFIX,
}: {
    document: DocDetail;
    /** Path prefix of in-app document links. */
    linkPrefix?: string;
}) {
    const onClick = (event: MouseEvent<HTMLDivElement>) => {
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }

        const anchor = (event.target as HTMLElement).closest('a');
        const href = anchor?.getAttribute('href');

        if (href?.startsWith(linkPrefix)) {
            event.preventDefault();
            router.visit(href);
        }
    };

    return (
        <article className="min-w-0 rounded-[22px] border border-border bg-surface p-5 shadow-card md:rounded-panel md:p-8">
            <p className="mb-5 flex flex-wrap gap-x-2 border-b border-divider pb-4 text-meta text-text-muted">
                <span className="font-mono font-semibold">{document.path}</span>
                <span aria-hidden>·</span>
                <span>Diperbarui {formatDateTime(document.updatedAt)}</span>
            </p>
            {/* Server-rendered Markdown with raw HTML escaped (DocumentRenderer). */}
            <div
                className="doc-prose"
                onClick={onClick}
                dangerouslySetInnerHTML={{ __html: document.html }}
            />
        </article>
    );
}
