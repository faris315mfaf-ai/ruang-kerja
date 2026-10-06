import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import {
    MeetingDetailDesktop,
    MeetingDetailMobile,
    useMeetingDetail,
} from '@/features/meetings/meeting-detail';
import { MeetingsProvider } from '@/features/meetings/meetings-context';
import type { MeetingDetailProps } from '@/features/meetings/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

function MeetingScreen({ detail }: { detail: MeetingDetailProps }) {
    const breakpoint = useBreakpoint();
    const data = useMeetingDetail(detail);

    if (breakpoint === null) {
        return (
            <div className="flex flex-col gap-4" aria-busy>
                <Skeleton className="h-12 w-96" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return breakpoint === 'mobile' ? (
        <MeetingDetailMobile data={data} />
    ) : (
        <MeetingDetailDesktop data={data} isTablet={breakpoint === 'tablet'} />
    );
}

/**
 * /rapat/{meeting} — meeting detail: join, RSVP, agenda, participants,
 * organizer tools (designs DRapat hero, MRapatDetail). Props from
 * MeetingController@show; keyed per occurrence so RSVP state resets.
 */
export default function MeetingsShowPage({
    detail,
}: {
    detail: MeetingDetailProps;
}) {
    return (
        <MeetingsProvider people={detail.people} me={detail.viewer_id}>
            <Head title={detail.meeting.title} />
            <MeetingScreen key={detail.meeting.key} detail={detail} />
        </MeetingsProvider>
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
