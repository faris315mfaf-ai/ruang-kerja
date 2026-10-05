import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import type { TaskFilters } from './lib/filters';
import {
    applyFiltersToParams,
    EMPTY_FILTERS,
    parseFilters,
} from './lib/filters';

/**
 * Filters of a task view, kept in the query string (?assignee=…&due=week&q=…)
 * so a filtered board can be shared and survives reloads. Filtering itself
 * runs on the client (the view already has every task of the workspace).
 */
export function useTaskFilters() {
    const [filters, setFilters] = useState<TaskFilters>(() =>
        typeof window === 'undefined'
            ? EMPTY_FILTERS
            : parseFilters(window.location.search),
    );
    const first = useRef(true);

    useEffect(() => {
        if (first.current) {
            first.current = false;

            return;
        }

        // Debounced so typing in the search box does not flood history.
        const timer = window.setTimeout(() => {
            const params = applyFiltersToParams(
                new URLSearchParams(window.location.search),
                filters,
            );
            const query = params.toString();

            router.replace({
                url: `${window.location.pathname}${query ? `?${query}` : ''}`,
                preserveScroll: true,
                preserveState: true,
            });
        }, 250);

        return () => window.clearTimeout(timer);
    }, [filters]);

    return {
        filters,
        setFilters,
        reset: () => setFilters(EMPTY_FILTERS),
    };
}
