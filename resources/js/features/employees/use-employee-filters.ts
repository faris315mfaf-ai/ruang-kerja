import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { index } from '@/routes/admin/employees';
import type { EmployeeFilters } from './types';

type FilterPatch = Partial<Omit<EmployeeFilters, 'per_page'>> & {
    page?: number;
    per_page?: number;
};

/** Props refreshed when the list changes (form options & editing stay). */
const LIST_PROPS = ['employees', 'filters', 'counts'];

function toQuery(filters: EmployeeFilters, page?: number) {
    const query: Record<string, string | number> = {};

    if (filters.search) query.search = filters.search;
    if (filters.division) query.division = filters.division;
    if (filters.role) query.role = filters.role;
    if (filters.status) query.status = filters.status;
    if (filters.sort !== 'name') query.sort = filters.sort;
    if (filters.direction !== 'asc') query.direction = filters.direction;
    if (filters.per_page !== 10) query.per_page = filters.per_page;
    if (page && page > 1) query.page = page;

    return query;
}

/**
 * Server-side list state kept in the query string. Search is debounced; every
 * other change resets to page 1 unless a page is given.
 */
export function useEmployeeFilters(filters: EmployeeFilters) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [loading, setLoading] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const apply = useCallback(
        (patch: FilterPatch) => {
            const { page, ...rest } = patch;
            const next = { ...filters, ...rest };

            router.get(index.url(), toQuery(next, page), {
                only: LIST_PROPS,
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            });
        },
        [filters],
    );

    const changeSearch = useCallback(
        (value: string) => {
            setSearch(value);

            if (timer.current) clearTimeout(timer.current);

            timer.current = setTimeout(() => {
                apply({ search: value.trim() === '' ? null : value.trim() });
            }, 300);
        },
        [apply],
    );

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        [],
    );

    const toggleSort = useCallback(
        (column: string) => {
            const direction =
                filters.sort === column && filters.direction === 'asc'
                    ? 'desc'
                    : 'asc';

            apply({ sort: column, direction });
        },
        [apply, filters.direction, filters.sort],
    );

    return { search, changeSearch, apply, toggleSort, loading };
}
