import { Head } from '@inertiajs/react';
import { PreviewSkeleton } from '@/features/automation/preview-state';
import { RulesScreen } from '@/features/automation/rules/rules-screen';
import type { AutomationProps } from '@/features/automation/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /otomasi — automation rules "jika … maka …" (Fase 2 · F2-4).
 * Props from AutomationRuleController (App\Domain\Automation\Queries\AutomationPage).
 */
export default function AutomationRulesPage({
    automation,
}: {
    automation: AutomationProps;
}) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title="Otomasi" />
            {breakpoint === null ? (
                <PreviewSkeleton kpis={3} />
            ) : (
                <RulesScreen
                    props={automation}
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
