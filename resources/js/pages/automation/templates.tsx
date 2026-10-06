import { Head } from '@inertiajs/react';
import { PreviewSkeleton } from '@/features/automation/preview-state';
import { TemplatesScreen } from '@/features/automation/templates/templates-screen';
import type { TemplatesProps } from '@/features/automation/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /otomasi/template — task & workspace templates (Fase 2 · F2-4). Props
 * from TaskTemplateController (App\Domain\Automation\Queries\TemplatesPage).
 */
export default function AutomationTemplatesPage({
    templates,
}: {
    templates: TemplatesProps;
}) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title="Template" />
            {breakpoint === null ? (
                <PreviewSkeleton />
            ) : (
                <TemplatesScreen
                    props={templates}
                    mobile={breakpoint === 'mobile'}
                />
            )}
        </>
    );
}

AutomationTemplatesPage.layout = {
    breadcrumbs: [
        { title: 'Otomasi', href: '/otomasi' },
        { title: 'Template', href: '/otomasi/template' },
    ],
    title: 'Template',
    back: '/otomasi',
};
