import { Head, router, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { PersonalDesktop } from '@/features/dashboard/personal.desktop';
import { PersonalMobile } from '@/features/dashboard/personal.mobile';
import type { PersonalProps } from '@/features/dashboard/personal-types';
import { TaskComposerProvider } from '@/features/tasks/form/task-composer';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** Dashboard Saya / Beranda (PRD M7, Sprint 9). */
export default function PersonalDashboard(props: PersonalProps) {
    const breakpoint = useBreakpoint();
    const { attendanceStatus, auth } = usePage().props;
    const missingStatus = attendanceStatus == null && auth.user !== null;

    // The once-prop may have been remembered from the guest login page; fetch it
    // so the check-in card shows right after signing in.
    useEffect(() => {
        if (missingStatus) {
            router.reload({ only: ['attendanceStatus'] });
        }
    }, [missingStatus]);

    return (
        <>
            <Head title="Dashboard Saya" />
            <TaskComposerProvider today={props.today} canCreate>
                {breakpoint === 'mobile' ? (
                    <PersonalMobile {...props} />
                ) : (
                    <PersonalDesktop {...props} />
                )}
            </TaskComposerProvider>
        </>
    );
}

PersonalDashboard.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Saya', href: '/dashboard/saya' },
    ],
    title: 'Beranda',
    appBar: 'greeting',
};
