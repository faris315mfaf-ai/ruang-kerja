import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function AutomationTemplatesPage() {
    return (
        <>
            <Head title="Template" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 2" />
                <h1 className="text-display">Template</h1>
            </div>
        </>
    );
}

AutomationTemplatesPage.layout = {
    breadcrumbs: [{ title: 'Template', href: '/otomasi/template' }],
    title: 'Template',
    back: '/otomasi',
};
