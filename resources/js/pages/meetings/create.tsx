import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import {
    CreateMeetingDesktop,
    CreateMeetingMobile,
} from '@/features/meetings/create-meeting';
import { MeetingsProvider } from '@/features/meetings/meetings-context';
import type { MeetingFormProps } from '@/features/meetings/types';
import { useMeetingForm } from '@/features/meetings/use-meeting-form';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /rapat/baru (schedule) and /rapat/{id}/ubah (edit) — design DRapatBaru.
 * Props from MeetingController@create / @edit; saves with an Inertia
 * POST/PATCH and redirects to the meeting.
 */
export default function MeetingsCreatePage({
    form: props,
}: {
    form: MeetingFormProps;
}) {
    const breakpoint = useBreakpoint();
    const form = useMeetingForm(props);

    return (
        <MeetingsProvider people={props.people} me={props.viewer_id}>
            <Head title={props.meeting ? 'Ubah rapat' : 'Jadwalkan rapat'} />
            {breakpoint === null ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-10 w-72" />
                    <Skeleton className="h-[640px] w-full" />
                </div>
            ) : breakpoint === 'mobile' ? (
                <CreateMeetingMobile form={form} />
            ) : (
                <CreateMeetingDesktop form={form} />
            )}
        </MeetingsProvider>
    );
}

MeetingsCreatePage.layout = {
    breadcrumbs: [
        { title: 'Rapat', href: '/rapat' },
        { title: 'Jadwalkan rapat', href: '/rapat/baru' },
    ],
    title: 'Jadwalkan rapat',
    back: '/rapat',
};
