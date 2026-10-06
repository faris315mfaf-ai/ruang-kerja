import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { NewMeetingAction } from '@/features/meetings/agenda-parts';
import { AgendaDesktop } from '@/features/meetings/agenda.desktop';
import { AgendaMobile } from '@/features/meetings/agenda.mobile';
import { MeetingsProvider } from '@/features/meetings/meetings-context';
import type { AgendaProps } from '@/features/meetings/types';
import { useAgenda } from '@/features/meetings/use-agenda';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /rapat — the viewer's meetings of the week (designs DRapat, MRapat),
 * props from MeetingController@index (AgendaQuery).
 */
export default function MeetingsIndexPage({ agenda }: { agenda: AgendaProps }) {
    const breakpoint = useBreakpoint();
    const data = useAgenda(agenda);

    return (
        <MeetingsProvider people={agenda.people} me={agenda.viewer_id}>
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
        </MeetingsProvider>
    );
}

MeetingsIndexPage.layout = {
    breadcrumbs: [{ title: 'Rapat', href: '/rapat' }],
    title: 'Rapat',
    appBarActions: <NewMeetingAction />,
};
