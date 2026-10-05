import { Head } from '@inertiajs/react';
import { DivisionDesktop } from '@/features/dashboard/division.desktop';
import { DivisionMobile } from '@/features/dashboard/division.mobile';
import type { DivisionProps } from '@/features/dashboard/division-types';
import { useLiveAttendance } from '@/features/dashboard/use-live-attendance';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** Dashboard Kepala Divisi (PRD M7, Sprint 9). */
export default function DivisionDashboard(props: DivisionProps) {
    const breakpoint = useBreakpoint();
    const live = useLiveAttendance(props.channels, ['attendance']);

    return (
        <>
            <Head title="Dashboard Divisi" />
            {breakpoint === 'mobile' ? (
                <DivisionMobile {...props} live={live} />
            ) : (
                <DivisionDesktop {...props} live={live} />
            )}
        </>
    );
}

DivisionDashboard.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Divisi', href: '/dashboard/divisi' },
    ],
    title: 'Dashboard',
};
