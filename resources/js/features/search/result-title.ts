import type { ResolvedAppearance } from '@/hooks/use-appearance';
import type { SearchResult } from '@/features/search/types';

/** Client-side wording for action results ("Ganti ke tema terang"). */
export function resultTitle(
    result: SearchResult,
    appearance: ResolvedAppearance,
): string {
    if (result.action === 'theme.toggle') {
        return appearance === 'dark'
            ? 'Ganti ke tema terang'
            : 'Ganti ke tema gelap';
    }

    return result.title;
}
