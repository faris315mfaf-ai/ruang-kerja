import { Head } from '@inertiajs/react';
import { TEMPLATES } from '@/features/automation/fixtures';
import {
    PreviewSkeleton,
    usePreviewState,
} from '@/features/automation/preview-state';
import { TemplatesScreen } from '@/features/automation/templates/templates-screen';
import type { TemplatesProps } from '@/features/automation/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** /otomasi/template — task & workspace templates (Fase 2 · F2-4, preview). */
export default function AutomationTemplatesPage({
    templates: data = TEMPLATES,
}: {
    /** Same shape as the fixture; the controller passes it later. */
    templates?: TemplatesProps;
}) {
    const breakpoint = useBreakpoint();
    const { state } = usePreviewState();

    return (
        <>
            <Head title="Template" />
            {breakpoint === null ? (
                <PreviewSkeleton />
            ) : (
                <TemplatesScreen
                    key={state}
                    props={data}
                    state={state}
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
