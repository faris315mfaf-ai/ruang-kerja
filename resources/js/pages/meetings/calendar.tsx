import { Head, usePage } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import {
    CalendarDesktop,
    CalendarMobile,
} from '@/features/meetings/calendar-view';
import { useCalendar } from '@/features/meetings/use-calendar';
import { useBreakpoint } from '@/hooks/use-breakpoint';

function CalendarScreen() {
    const breakpoint = useBreakpoint();
    const data = useCalendar();

    if (breakpoint === null) {
        return (
            <div className="flex flex-col gap-4" aria-busy>
                <Skeleton className="h-10 w-60" />
                <Skeleton className="h-[640px] w-full" />
            </div>
        );
    }

    return breakpoint === 'mobile' ? (
        <CalendarMobile data={data} />
    ) : (
        <CalendarDesktop data={data} isTablet={breakpoint === 'tablet'} />
    );
}

/**
 * /kalender — task deadlines, approved leave, meetings and holidays in one
 * calendar with layer filters and the Google Calendar sync status (F2-3).
 * Prototype only; the preview state in the URL remounts the screen.
 */
export default function MeetingsCalendarPage() {
    const { url } = usePage();

    return (
        <>
            <Head title="Kalender" />
            <CalendarScreen key={url} />
        </>
    );
}

MeetingsCalendarPage.layout = {
    breadcrumbs: [{ title: 'Kalender', href: '/kalender' }],
    title: 'Kalender',
};
