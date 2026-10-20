import { useLiveAttendance } from '@/features/dashboard/use-live-attendance';
import { HrAttendance } from '@/features/hr/attendance';
import { HubSkeleton } from '@/features/hr/page-skeleton';
import type { HrAttendanceProps } from '@/features/hr/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** Ruang HR › Absensi (keputusan pemilik 20 Okt 2026). */
export default function HrAttendancePage(props: HrAttendanceProps) {
    const breakpoint = useBreakpoint();
    const live = useLiveAttendance(props.channels, ['attendance']);

    if (breakpoint === null) {
        return <HubSkeleton />;
    }

    return (
        <HrAttendance
            props={props}
            mobile={breakpoint === 'mobile'}
            live={live}
        />
    );
}

HrAttendancePage.layout = {
    breadcrumbs: [
        { title: 'Ruang HR', href: '/hr' },
        { title: 'Absensi', href: '/hr/absensi' },
    ],
    title: 'Absensi',
    back: '/hr',
    width: 'wide',
};
