import { HubSkeleton } from '@/features/hr/page-skeleton';
import { HrSchedule } from '@/features/hr/schedule';
import type { HrScheduleProps } from '@/features/hr/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** Ruang HR › Jadwal (keputusan pemilik 20 Okt 2026). */
export default function HrSchedulePage(props: HrScheduleProps) {
    const breakpoint = useBreakpoint();

    if (breakpoint === null) {
        return <HubSkeleton />;
    }

    return <HrSchedule props={props} mobile={breakpoint === 'mobile'} />;
}

HrSchedulePage.layout = {
    breadcrumbs: [
        { title: 'Ruang HR', href: '/hr' },
        { title: 'Jadwal', href: '/hr/jadwal' },
    ],
    title: 'Jadwal',
    back: '/hr',
    width: 'wide',
};
