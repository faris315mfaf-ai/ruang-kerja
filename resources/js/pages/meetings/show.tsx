import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import {
    MeetingDetailDesktop,
    MeetingDetailMobile,
    useMeetingDetail,
} from '@/features/meetings/meeting-detail';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /rapat/{meeting} — meeting detail: join, RSVP, agenda, participants,
 * related documents (designs DRapat hero, MRapatDetail). Prototype only.
 */
export default function MeetingsShowPage({ meetingId }: { meetingId: string }) {
    const breakpoint = useBreakpoint();
    const data = useMeetingDetail(meetingId);

    return (
        <>
            <Head title={data.meeting?.title ?? 'Detail rapat'} />
            {breakpoint === null ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-12 w-96" />
                    <Skeleton className="h-96 w-full" />
                </div>
            ) : breakpoint === 'mobile' ? (
                <MeetingDetailMobile data={data} />
            ) : (
                <MeetingDetailDesktop
                    data={data}
                    isTablet={breakpoint === 'tablet'}
                />
            )}
        </>
    );
}

MeetingsShowPage.layout = {
    breadcrumbs: [
        { title: 'Rapat', href: '/rapat' },
        { title: 'Detail rapat', href: '/rapat' },
    ],
    title: 'Detail rapat',
    back: '/rapat',
};
