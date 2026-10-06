import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function AutomationPerformancePage() {
    return (
        <>
            <Head title="Kinerja saya" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 2" />
                <h1 className="text-display">Kinerja saya</h1>
            </div>
        </>
    );
}

AutomationPerformancePage.layout = {
    breadcrumbs: [{ title: 'Kinerja saya', href: '/kinerja' }],
    title: 'Kinerja saya',
};
