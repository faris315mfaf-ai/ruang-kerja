import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function AutomationRulesPage() {
    return (
        <>
            <Head title="Otomasi" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 2" />
                <h1 className="text-display">Otomasi</h1>
            </div>
        </>
    );
}

AutomationRulesPage.layout = {
    breadcrumbs: [{ title: 'Otomasi', href: '/otomasi' }],
    title: 'Otomasi',
};
