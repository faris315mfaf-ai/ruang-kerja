import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { OkrList } from '@/features/okr/okr-list';
import type { OkrIndexProps } from '@/features/okr/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /okr — division OKR per quarter (F3-3). Props: App\Domain\Okr\Queries\OkrIndex.
 */
export default function OkrIndexPage(props: OkrIndexProps) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title="OKR divisi" />
            {breakpoint === null ? (
                <div
                    className="flex flex-col gap-4"
                    aria-busy
                    aria-label="Memuat"
                >
                    <Skeleton className="h-12 w-72" />
                    <div className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
                        {[0, 1, 2, 3].map((key) => (
                            <Skeleton key={key} className="h-32 rounded-card" />
                        ))}
                    </div>
                    <Skeleton className="h-72 w-full rounded-panel" />
                </div>
            ) : (
                <OkrList props={props} mobile={breakpoint === 'mobile'} />
            )}
        </>
    );
}

OkrIndexPage.layout = {
    breadcrumbs: [{ title: 'OKR', href: '/okr' }],
    title: 'OKR',
};
