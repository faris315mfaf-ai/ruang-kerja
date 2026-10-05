import { applyFiltersToParams } from '../lib/filters';
import type { TaskFilters } from '../lib/filters';
import type { SavedView, TaskViewMode } from '../types';

/** Placeholder for "the viewer" in shared views such as "Tugas saya". */
export const ME = 'me';

/** URL of a saved view: layout + filters ("me" → the viewer). */
export function savedViewUrl(
    basePath: string,
    view: Pick<SavedView, 'layout' | 'filters'>,
    viewerId: string | undefined,
): string {
    const filters: TaskFilters = {
        ...view.filters,
        assignees: view.filters.assignees.flatMap((id) =>
            id === ME ? (viewerId ? [viewerId] : []) : [id],
        ),
    };
    const params = applyFiltersToParams(new URLSearchParams(), filters);

    if (view.layout !== 'board') {
        params.set('view', view.layout);
    }

    const query = params.toString();

    return `${basePath}${query ? `?${query}` : ''}`;
}

/** Is the page currently showing exactly this view? */
export function isCurrentView(
    view: Pick<SavedView, 'layout' | 'filters'>,
    layout: TaskViewMode,
    filters: TaskFilters,
    viewerId: string | undefined,
): boolean {
    if (view.layout !== layout) {
        return false;
    }

    const expected = new URL(
        savedViewUrl('/', view, viewerId),
        'https://x.test',
    ).searchParams;
    const actual = applyFiltersToParams(new URLSearchParams(), filters);
    expected.delete('view');

    return expected.toString() === actual.toString();
}
