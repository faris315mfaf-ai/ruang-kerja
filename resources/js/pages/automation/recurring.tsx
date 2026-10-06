import { Head } from '@inertiajs/react';
import { RECURRING } from '@/features/automation/fixtures';
import {
    PreviewSkeleton,
    usePreviewState,
} from '@/features/automation/preview-state';
import { RecurringScreen } from '@/features/automation/recurring/recurring-screen';
import type { RecurringProps } from '@/features/automation/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** /otomasi/berulang — recurring tasks (Fase 2 · F2-4, preview). */
export default function AutomationRecurringPage({
    recurring: data = RECURRING,
}: {
    /** Same shape as the fixture; the controller passes it later. */
    recurring?: RecurringProps;
}) {
    const breakpoint = useBreakpoint();
    const { state } = usePreviewState();

    return (
        <>
            <Head title="Tugas berulang" />
            {breakpoint === null ? (
                <PreviewSkeleton />
            ) : (
                <RecurringScreen
                    key={state}
                    props={data}
                    state={state}
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
