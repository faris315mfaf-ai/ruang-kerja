import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { NotulenReview } from '@/features/meetings/notulen/notulen-review';
import type { NotulenPageProps } from '@/features/meetings/notulen/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /rapat/{meeting}/notulen-otomatis — transcript + AI draft after a video
 * meeting with "Notulen otomatis" (NotulenController@page, contract
 * docs/fitur/notulen-otomatis-kontrak.md §2.3).
 */
export default function MeetingNotulenOtomatisPage(props: NotulenPageProps) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title={`Notulen otomatis · ${props.meeting.title}`} />
            {breakpoint === null ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-12 w-96" />
                    <Skeleton className="h-96 w-full" />
                </div>
            ) : (
                <NotulenReview
                    key={`${props.meeting.id}:${props.meeting.occurrence_date}`}
                    props={props}
                    mobile={breakpoint === 'mobile'}
                />
            )}
        </>
    );
}

MeetingNotulenOtomatisPage.layout = {
    breadcrumbs: [
        { title: 'Rapat', href: '/rapat' },
        { title: 'Notulen otomatis', href: '/rapat' },
    ],
    title: 'Notulen otomatis',
    back: '/rapat',
};
