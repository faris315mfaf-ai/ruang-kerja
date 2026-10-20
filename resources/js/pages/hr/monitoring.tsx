import { HrMonitoring } from '@/features/hr/monitoring';
import { HubSkeleton } from '@/features/hr/page-skeleton';
import type { HrMonitoringProps } from '@/features/hr/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** Ruang HR › Monitoring (keputusan pemilik 20 Okt 2026). */
export default function HrMonitoringPage(props: HrMonitoringProps) {
    const breakpoint = useBreakpoint();

    if (breakpoint === null) {
        return <HubSkeleton />;
    }

    return <HrMonitoring props={props} mobile={breakpoint === 'mobile'} />;
}

HrMonitoringPage.layout = {
    breadcrumbs: [
        { title: 'Ruang HR', href: '/hr' },
        { title: 'Monitoring', href: '/hr/monitoring' },
    ],
    title: 'Monitoring',
    back: '/hr',
    width: 'wide',
};
