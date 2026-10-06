import { Head } from '@inertiajs/react';
import { PreviewSkeleton } from '@/features/automation/preview-state';
import { RecurringScreen } from '@/features/automation/recurring/recurring-screen';
import type { RecurringProps } from '@/features/automation/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /otomasi/berulang — recurring tasks (Fase 2 · F2-4). Props from
 * RecurringTaskController (App\Domain\Automation\Queries\RecurringPage).
 */
export default function AutomationRecurringPage({
    recurring,
}: {
    recurring: RecurringProps;
}) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title="Tugas berulang" />
            {breakpoint === null ? (
                <PreviewSkeleton />
            ) : (
                <RecurringScreen
                    props={recurring}
                    mobile={breakpoint === 'mobile'}
                />
            )}
        </>
    );
}

AutomationRecurringPage.layout = {
    breadcrumbs: [
        { title: 'Otomasi', href: '/otomasi' },
        { title: 'Tugas berulang', href: '/otomasi/berulang' },
    ],
    title: 'Tugas berulang',
    back: '/otomasi',
};
