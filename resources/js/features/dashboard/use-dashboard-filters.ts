import { router } from '@inertiajs/react';
import type { DashboardFilterState, PeriodPresetKey } from '@/types/dashboard';

export type FilterQuery = {
    periode: PeriodPresetKey;
    dari: string | null;
    sampai: string | null;
    divisi: string | null;
    tim: string | null;
};

/** Current filter as URL query (custom dates only for "kustom"). */
export function filterQuery(
    filters: FilterQuery,
    changes: Partial<FilterQuery> = {},
): Record<string, string> {
    const next: FilterQuery = { ...filters, ...changes };

    if (next.periode !== 'kustom') {
        next.dari = null;
        next.sampai = null;
    }

    // A new division resets the team (it may belong elsewhere).
    if ('divisi' in changes && changes.divisi !== filters.divisi) {
        next.tim = changes.tim ?? null;
    }

    return Object.fromEntries(
        Object.entries(next).filter(
            (entry): entry is [string, string] =>
                typeof entry[1] === 'string' && entry[1] !== '',
        ),
    );
}

export function withQuery(url: string, query: Record<string, string>): string {
    const search = new URLSearchParams(query).toString();

    return search === '' ? url : `${url}?${search}`;
}

/**
 * Filters live in the URL (`?periode=…&divisi=…&tim=…`), so a dashboard can
 * be bookmarked and shared; changing one reloads the page props in place.
 */
export function useDashboardFilters(filters: DashboardFilterState) {
    const current: FilterQuery = {
        periode: filters.periode,
        dari: filters.dari,
        sampai: filters.sampai,
        divisi: filters.divisi,
        tim: filters.tim,
    };

    const apply = (changes: Partial<FilterQuery>) => {
        router.get(window.location.pathname, filterQuery(current, changes), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    return {
        current,
        apply,
        query: filterQuery(current),
    };
}
