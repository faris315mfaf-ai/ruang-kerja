import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import {
    CalendarDesktop,
    CalendarMobile,
} from '@/features/meetings/calendar-view';
import type { CalendarProps } from '@/features/meetings/types';
import { useCalendar } from '@/features/meetings/use-calendar';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /kalender — meetings, task deadlines, approved leave and holidays in one
 * calendar with layer filters (F2-3). Props from CalendarController
 * (CalendarFeed); Google Calendar sync is on hold.
 */
export default function MeetingsCalendarPage({
    calendar,
}: {
    calendar: CalendarProps;
}) {
    const breakpoint = useBreakpoint();
    const data = useCalendar(calendar);

    return (
        <>
            <Head title="Kalender" />
            {breakpoint === null ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-10 w-60" />
                    <Skeleton className="h-[640px] w-full" />
                </div>
            ) : breakpoint === 'mobile' ? (
                <CalendarMobile data={data} />
            ) : (
                <CalendarDesktop
                    data={data}
                    isTablet={breakpoint === 'tablet'}
                />
            )}
        </>
    );
}

MeetingsCalendarPage.layout = {
    breadcrumbs: [{ title: 'Kalender', href: '/kalender' }],
    title: 'Kalender',
};
