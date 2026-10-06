import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { MeetingsProvider } from '@/features/meetings/meetings-context';
import {
    ScheduleDesktop,
    ScheduleMobile,
    useSchedule,
} from '@/features/meetings/schedule-view';
import type { ScheduleProps } from '@/features/meetings/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /manajemen/jadwal — leadership schedule, latest minutes and open
 * follow-ups for Direksi/HR (designs MgJadwal, TfJadwal, MgPJadwal). Props
 * from ManagementScheduleController (ManagementSchedule).
 */
export default function MeetingsManagementSchedulePage({
    schedule,
}: {
    schedule: ScheduleProps;
}) {
    const breakpoint = useBreakpoint();
    const data = useSchedule(schedule);

    return (
        <MeetingsProvider people={schedule.people} me={schedule.viewer_id}>
            <Head title="Jadwal & notulensi" />
            {breakpoint === null ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-10 w-72" />
                    <Skeleton className="h-[600px] w-full" />
                </div>
            ) : breakpoint === 'mobile' ? (
                <ScheduleMobile data={data} />
            ) : (
                <ScheduleDesktop
                    data={data}
                    isTablet={breakpoint === 'tablet'}
                />
            )}
        </MeetingsProvider>
    );
}

MeetingsManagementSchedulePage.layout = {
    breadcrumbs: [
        { title: 'Manajemen', href: '/manajemen' },
        { title: 'Jadwal & notulensi', href: '/manajemen/jadwal' },
    ],
    title: 'Jadwal',
    back: '/manajemen',
};
