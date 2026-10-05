import { useEffect, useState } from 'react';
import type { SearchGroup } from '@/features/search/types';
import { requestJson } from '@/lib/http';
import { results } from '@/routes/search';

export const SEARCH_DEBOUNCE_MS = 150;

type State = {
    groups: SearchGroup[];
    loading: boolean;
    error: boolean;
};

/**
 * Debounced server search (GET /cari/hasil). Every provider filters by the
 * viewer's access on the server; the client only renders.
 */
export function useSearch(
    query: string,
    group: string | null = null,
    enabled = true,
): State {
    const [state, setState] = useState<State>({
        groups: [],
        loading: false,
        error: false,
    });

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const controller = new AbortController();
        const term = query.trim();

        setState((previous) => ({ ...previous, loading: true, error: false }));

        const timer = window.setTimeout(
            () => {
                const params: Record<string, string> = {};

                if (term !== '') {
                    params.q = term;
                }

                if (group) {
                    params.group = group;
                }

                requestJson<{ groups: SearchGroup[] }>(
                    results.url({ query: params }),
                    {
                        signal: controller.signal,
                    },
                )
                    .then((data) =>
                        setState({
                            groups: data.groups,
                            loading: false,
                            error: false,
                        }),
                    )
                    .catch((error: unknown) => {
                        if (
                            error instanceof DOMException &&
                            error.name === 'AbortError'
                        ) {
                            return;
                        }

                        setState({ groups: [], loading: false, error: true });
                    });
            },
            term === '' ? 0 : SEARCH_DEBOUNCE_MS,
        );

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [query, group, enabled]);

    return state;
}
