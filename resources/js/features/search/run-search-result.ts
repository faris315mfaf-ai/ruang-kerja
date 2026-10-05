import { router } from '@inertiajs/react';
import type { SearchResult } from '@/features/search/types';

type Handlers = {
    /** Client-side actions such as "theme.toggle". */
    onAction?: (action: string) => void;
};

/** Opens a search hit: Inertia visit, external link (mailto, Drive) or client action. */
export function runSearchResult(
    result: SearchResult,
    handlers: Handlers = {},
): void {
    if (result.action) {
        handlers.onAction?.(result.action);

        return;
    }

    if (!result.url) {
        return;
    }

    if (result.external) {
        if (result.url.startsWith('mailto:')) {
            window.location.href = result.url;
        } else {
            window.open(result.url, '_blank', 'noopener,noreferrer');
        }

        return;
    }

    router.visit(result.url);
}
