import { router } from '@inertiajs/react';
import { useState } from 'react';
import { index as portfolioIndex } from '@/routes/portfolio';
import { resolveDecision } from '@/routes/projects/updates';
import { DirectionDialog, RequestUpdateDialog } from './steering-dialogs';
import type { PortfolioFilters } from './types';

type Target = { key: string; name: string };

/**
 * Shared state of the portfolio (desktop & mobile): filter navigation (kept
 * in the URL) and the Direksi dialogs.
 */
export function usePortfolio(filters: PortfolioFilters) {
    const [direction, setDirection] = useState<{
        project: Target;
        updateId: string | null;
        context: string | null;
    } | null>(null);
    const [request, setRequest] = useState<{
        project: Target;
        leadName: string | null;
    } | null>(null);
    const [resolving, setResolving] = useState<string | null>(null);

    const setFilter = (changes: Partial<PortfolioFilters>) => {
        const next = { ...filters, ...changes };

        router.get(
            portfolioIndex.url({
                query: {
                    periode:
                        next.periode === 'kuartal' ? undefined : next.periode,
                    divisi: next.divisi ?? undefined,
                    status: next.status ?? undefined,
                    arsip: next.arsip ? 1 : undefined,
                },
            }),
            {},
            { preserveScroll: true, preserveState: true },
        );
    };

    const resolve = (project: Target, updateId: string) => {
        setResolving(updateId);
        router.post(
            resolveDecision({ workspace: project.key, projectUpdate: updateId })
                .url,
            {},
            { preserveScroll: true, onFinish: () => setResolving(null) },
        );
    };

    const dialogs = (
        <>
            <DirectionDialog
                key={
                    direction
                        ? `${direction.project.key}-${direction.updateId}`
                        : 'none'
                }
                project={direction?.project ?? null}
                updateId={direction?.updateId}
                context={direction?.context}
                open={direction !== null}
                onOpenChange={(open) => !open && setDirection(null)}
            />
            <RequestUpdateDialog
                key={request?.project.key ?? 'none'}
                project={request?.project ?? null}
                leadName={request?.leadName}
                open={request !== null}
                onOpenChange={(open) => !open && setRequest(null)}
            />
        </>
    );

    return {
        setFilter,
        resolve,
        resolving,
        openDirection: (
            project: Target,
            updateId: string | null = null,
            context: string | null = null,
        ) => setDirection({ project, updateId, context }),
        openRequest: (project: Target, leadName: string | null = null) =>
            setRequest({ project, leadName }),
        dialogs,
    };
}

export type PortfolioActions = ReturnType<typeof usePortfolio>;
