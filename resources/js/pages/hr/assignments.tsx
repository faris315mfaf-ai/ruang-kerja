import { HrAssignments } from '@/features/hr/assignments';
import { HubSkeleton } from '@/features/hr/page-skeleton';
import type { HrAssignmentsProps } from '@/features/hr/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** Ruang HR › Penugasan (keputusan pemilik 20 Okt 2026). */
export default function HrAssignmentsPage(props: HrAssignmentsProps) {
    const breakpoint = useBreakpoint();

    if (breakpoint === null) {
        return <HubSkeleton />;
    }

    return <HrAssignments props={props} mobile={breakpoint === 'mobile'} />;
}

HrAssignmentsPage.layout = {
    breadcrumbs: [
        { title: 'Ruang HR', href: '/hr' },
        { title: 'Penugasan', href: '/hr/penugasan' },
    ],
    title: 'Penugasan',
    back: '/hr',
    width: 'wide',
};
