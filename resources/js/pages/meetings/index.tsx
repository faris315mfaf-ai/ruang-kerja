import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { NewMeetingAction } from '@/features/meetings/agenda-parts';
import { AgendaDesktop } from '@/features/meetings/agenda.desktop';
import { AgendaMobile } from '@/features/meetings/agenda.mobile';
import { useAgenda } from '@/features/meetings/use-agenda';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /rapat — meeting agenda (designs DRapat, MRapat). Prototype: sample data
 * from features/meetings/fixtures; the backend will pass the same shapes.
 */
export default function MeetingsIndexPage() {
    const breakpoint = useBreakpoint();
    const data = useAgenda();

    return (
        <>
            <Head title="Rapat" />
            {breakpoint === null ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-10 w-60" />
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-80 w-full" />
                </div>
            ) : breakpoint === 'mobile' ? (
                <AgendaMobile data={data} />
            ) : (
                <AgendaDesktop data={data} isTablet={breakpoint === 'tablet'} />
            )}
        </>
    );
}

MeetingsIndexPage.layout = {
    breadcrumbs: [{ title: 'Rapat', href: '/rapat' }],
    title: 'Rapat',
    appBarActions: <NewMeetingAction />,
};
