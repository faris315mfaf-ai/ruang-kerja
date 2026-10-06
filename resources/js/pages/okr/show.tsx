import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { ObjectiveDetail } from '@/features/okr/objective-detail';
import type { ObjectiveDetailProps } from '@/features/okr/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /okr/{objective} — objective detail (F3-3): key results with progress,
 * check-ins and linked tasks. Props: App\Domain\Okr\Queries\ObjectiveDetail.
 * An unknown or hidden objective is a 404 from the server.
 */
export default function OkrShowPage(props: ObjectiveDetailProps) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title={props.objective.title} />
            {breakpoint === null ? (
                <div
                    className="flex flex-col gap-5"
                    aria-busy
                    aria-label="Memuat"
                >
                    <Skeleton className="h-48 w-full rounded-panel" />
                    <div className="grid grid-cols-3 gap-5">
                        <Skeleton className="h-28" />
                        <Skeleton className="h-28" />
                        <Skeleton className="h-28" />
                    </div>
                    <Skeleton className="h-96 w-full rounded-panel" />
                </div>
            ) : (
                <ObjectiveDetail
                    props={props}
                    mobile={breakpoint === 'mobile'}
                />
            )}
        </>
    );
}

OkrShowPage.layout = {
    breadcrumbs: [
        { title: 'OKR', href: '/okr' },
        { title: 'Detail objective', href: '/okr' },
    ],
    title: 'Detail OKR',
    back: '/okr',
};
