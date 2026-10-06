import { Head } from '@inertiajs/react';
import { PERFORMANCE } from '@/features/automation/fixtures';
import { PerformanceScreen } from '@/features/automation/performance/performance-screen';
import {
    PreviewSkeleton,
    usePreviewState,
} from '@/features/automation/preview-state';
import type { PerformanceProps } from '@/features/automation/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /kinerja — Kinerja saya (design SKinerja / MSKinerja; Fase 2 · F2-4
 * preview). Output metrics side by side, no combined score (PRD M7).
 */
export default function AutomationPerformancePage({
    performance: data = PERFORMANCE,
}: {
    /** Same shape as the fixture; the controller passes it later. */
    performance?: PerformanceProps;
}) {
    const breakpoint = useBreakpoint();
    const { state } = usePreviewState();

    return (
        <>
            <Head title="Kinerja saya" />
            {breakpoint === null ? (
                <PreviewSkeleton kpis={4} />
            ) : (
                <PerformanceScreen
                    key={state}
                    props={data}
                    state={state}
                    mobile={breakpoint === 'mobile'}
                />
            )}
        </>
    );
}

AutomationPerformancePage.layout = {
    breadcrumbs: [
        { title: 'Beranda', href: '/dashboard' },
        { title: 'Kinerja saya', href: '/kinerja' },
    ],
    title: 'Kinerja saya',
};
