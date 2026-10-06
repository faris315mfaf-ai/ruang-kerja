import { Head } from '@inertiajs/react';
import { AUTOMATION } from '@/features/automation/fixtures';
import {
    PreviewSkeleton,
    usePreviewState,
} from '@/features/automation/preview-state';
import { RulesScreen } from '@/features/automation/rules/rules-screen';
import type { AutomationProps } from '@/features/automation/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /otomasi — automation rules "jika … maka …" (Fase 2 · F2-4, preview).
 * Props default to fixtures (features/automation/types.ts shape).
 */
export default function AutomationRulesPage({
    automation: data = AUTOMATION,
}: {
    /** Same shape as the fixture; the controller passes it later. */
    automation?: AutomationProps;
}) {
    const breakpoint = useBreakpoint();
    const { state } = usePreviewState();

    return (
        <>
            <Head title="Otomasi" />
            {breakpoint === null ? (
                <PreviewSkeleton kpis={3} />
            ) : (
                <RulesScreen
                    key={state}
                    props={data}
                    state={state}
                    mobile={breakpoint === 'mobile'}
                />
            )}
        </>
    );
}

AutomationRulesPage.layout = {
    breadcrumbs: [{ title: 'Otomasi', href: '/otomasi' }],
    title: 'Otomasi',
};
