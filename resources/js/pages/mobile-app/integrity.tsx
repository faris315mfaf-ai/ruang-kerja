import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MobileAppIntegrityPage() {
    return (
        <>
            <Head title="Integritas perangkat" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 3" />
                <h1 className="text-display">Integritas perangkat</h1>
            </div>
        </>
    );
}

MobileAppIntegrityPage.layout = {
    breadcrumbs: [
        { title: 'Integritas perangkat', href: '/pratinjau/ponsel/integritas' },
    ],
    title: 'Integritas perangkat',
    back: '/pratinjau/ponsel',
};
