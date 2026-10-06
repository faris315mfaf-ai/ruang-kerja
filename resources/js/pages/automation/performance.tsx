import { Head } from '@inertiajs/react';
import { PerformanceScreen } from '@/features/automation/performance/performance-screen';
import { PreviewSkeleton } from '@/features/automation/preview-state';
import type { PerformanceProps } from '@/features/automation/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /kinerja and /kinerja/{user} — Kinerja saya (design SKinerja /
 * MSKinerja; Fase 2 · F2-4). Output metrics side by side, no combined
 * score (PRD M7). Props from PerformanceController
 * (App\Domain\Automation\Queries\PersonalPerformance).
 */
export default function AutomationPerformancePage({
    performance,
}: {
    performance: PerformanceProps;
}) {
    const breakpoint = useBreakpoint();
    const title = performance.person.is_self
        ? 'Kinerja saya'
        : `Kinerja ${performance.person.name}`;

    return (
        <>
            <Head title={title} />
            {breakpoint === null ? (
                <PreviewSkeleton kpis={4} />
            ) : (
                <PerformanceScreen
                    props={performance}
                    mobile={breakpoint === 'mobile'}
                />
            )}
        </>
    );
}

AutomationPerformancePage.layout = {
    breadcrumbs: [
        { title: 'Beranda', href: '/dashboard' },
        { title: 'Kinerja', href: '/kinerja' },
    ],
    title: 'Kinerja',
};
