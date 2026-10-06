import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { OKR_INDEX } from '@/features/okr/fixtures';
import { OkrList } from '@/features/okr/okr-list';
import { PreviewHeader, usePreviewState } from '@/features/okr/preview-state';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /okr — division OKR per quarter (Fase 3 preview, sample data from
 * features/okr/fixtures.ts; a controller will later send OkrIndexProps).
 */
export default function OkrIndexPage() {
    const breakpoint = useBreakpoint();
    const state = usePreviewState();

    return (
        <>
            <Head title="OKR divisi" />
            <div className="flex flex-col gap-5">
                <PreviewHeader />
                {breakpoint === null ? (
                    <div
                        className="flex flex-col gap-4"
                        aria-busy
                        aria-label="Memuat"
                    >
                        <Skeleton className="h-12 w-72" />
                        <Skeleton className="h-36 w-full" />
                        <Skeleton className="h-72 w-full" />
                    </div>
                ) : (
                    <OkrList
                        props={OKR_INDEX}
                        mobile={breakpoint === 'mobile'}
                        state={state}
                    />
                )}
            </div>
        </>
    );
}

OkrIndexPage.layout = {
    breadcrumbs: [{ title: 'OKR', href: '/okr' }],
    title: 'OKR',
};
