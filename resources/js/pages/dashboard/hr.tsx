import { Head } from '@inertiajs/react';
import { HrDesktop } from '@/features/dashboard/hr.desktop';
import { HrMobile } from '@/features/dashboard/hr.mobile';
import type { HrProps } from '@/features/dashboard/hr-types';
import { useLiveAttendance } from '@/features/dashboard/use-live-attendance';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** Dashboard HR (PRD M7; isi diperbarui keputusan pemilik 6 Okt 2026). */
export default function HrDashboard(props: HrProps) {
    const breakpoint = useBreakpoint();
    const live = useLiveAttendance(props.channels, ['attendance']);

    return (
        <>
            <Head title="Dashboard HR" />
            {breakpoint === 'mobile' ? (
                <HrMobile {...props} live={live} />
            ) : (
                <HrDesktop {...props} live={live} />
            )}
        </>
    );
}

HrDashboard.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'HR', href: '/dashboard/hr' },
    ],
    title: 'Dashboard',
};
