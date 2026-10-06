import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { MeetingsProvider } from '@/features/meetings/meetings-context';
import {
    MinutesDesktop,
    MinutesMobile,
} from '@/features/meetings/minutes-view';
import type { MinutesProps } from '@/features/meetings/types';
import { useMinutes } from '@/features/meetings/use-minutes';
import { useBreakpoint } from '@/hooks/use-breakpoint';

function MinutesScreen({ record }: { record: MinutesProps }) {
    const breakpoint = useBreakpoint();
    const data = useMinutes(record);

    if (breakpoint === null) {
        return (
            <div className="flex flex-col gap-4" aria-busy>
                <Skeleton className="h-12 w-96" />
                <Skeleton className="h-[560px] w-full" />
            </div>
        );
    }

    return breakpoint === 'mobile' ? (
        <MinutesMobile data={data} />
    ) : (
        <MinutesDesktop data={data} />
    );
}

/**
 * /rapat/{meeting}/notulen — minutes of one occurrence: attendance, notes
 * per agenda item, decisions, follow-ups → tasks, draft/final (designs
 * DNotulen, MNotulen, MgPNotulen). Props from MinutesController@show; keyed
 * per occurrence so local edits reset when another date is opened.
 */
export default function MeetingsMinutesPage({
    record,
}: {
    record: MinutesProps;
}) {
    return (
        <MeetingsProvider people={record.people} me={record.viewer_id}>
            <Head title={`Notulen · ${record.meeting.title}`} />
            <MinutesScreen key={record.meeting.key} record={record} />
        </MeetingsProvider>
    );
}

MeetingsMinutesPage.layout = {
    breadcrumbs: [
        { title: 'Rapat', href: '/rapat' },
        { title: 'Notulen', href: '/rapat' },
    ],
    title: 'Notulen',
    back: '/rapat',
};
