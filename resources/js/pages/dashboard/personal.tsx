import { Head } from '@inertiajs/react';
import { PersonalDesktop } from '@/features/dashboard/personal.desktop';
import { PersonalMobile } from '@/features/dashboard/personal.mobile';
import type { PersonalProps } from '@/features/dashboard/personal-types';
import { TaskComposerProvider } from '@/features/tasks/form/task-composer';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** Dashboard Saya / Beranda (PRD M7, Sprint 9). */
export default function PersonalDashboard(props: PersonalProps) {
    const breakpoint = useBreakpoint();
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
    breadcrumbs: [{ title: 'Dashboard', href: '/dashboard' }],
    title: 'Beranda',
    appBar: 'greeting',
};
