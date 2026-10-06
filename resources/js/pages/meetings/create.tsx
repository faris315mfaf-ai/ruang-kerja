import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import {
    CreateMeetingDesktop,
    CreateMeetingMobile,
} from '@/features/meetings/create-meeting';
import { useMeetingForm } from '@/features/meetings/use-meeting-form';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** /rapat/baru — schedule a meeting (design DRapatBaru). Prototype only. */
export default function MeetingsCreatePage() {
    const breakpoint = useBreakpoint();
    const form = useMeetingForm();

    return (
        <>
            <Head title="Jadwalkan rapat" />
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
        </>
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
