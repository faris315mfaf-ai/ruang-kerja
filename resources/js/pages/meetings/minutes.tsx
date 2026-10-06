import { Head, usePage } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import {
    MinutesDesktop,
    MinutesMobile,
} from '@/features/meetings/minutes-view';
import { useMinutes } from '@/features/meetings/use-minutes';
import { useBreakpoint } from '@/hooks/use-breakpoint';

function MinutesScreen({ meetingId }: { meetingId: string }) {
    const breakpoint = useBreakpoint();
    const data = useMinutes(meetingId);

    return (
        <>
            <Head
                title={
                    data.meeting ? `Notulen · ${data.meeting.title}` : 'Notulen'
                }
            />
            {breakpoint === null ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-12 w-96" />
                    <Skeleton className="h-[560px] w-full" />
                </div>
            ) : breakpoint === 'mobile' ? (
                <MinutesMobile data={data} />
            ) : (
                <MinutesDesktop data={data} />
            )}
        </>
    );
}

/**
 * /rapat/{meeting}/notulen — minutes: attendance, notes per agenda item,
 * decisions, follow-ups → tasks, draft/final (designs DNotulen, MNotulen,
 * MgPNotulen). Prototype only; the preview state in the URL remounts it.
 */
export default function MeetingsMinutesPage({
    meetingId,
}: {
    meetingId: string;
}) {
    const { url } = usePage();

    return <MinutesScreen key={url} meetingId={meetingId} />;
}

MeetingsMinutesPage.layout = {
    breadcrumbs: [
        { title: 'Rapat', href: '/rapat' },
        { title: 'Notulen', href: '/rapat' },
    ],
    title: 'Notulen',
    back: '/rapat',
};
