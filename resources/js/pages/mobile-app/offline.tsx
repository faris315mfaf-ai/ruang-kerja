import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MobileAppOfflinePage() {
    return (
        <>
            <Head title="Offline & sinkron" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 3" />
                <h1 className="text-display">Offline & sinkron</h1>
            </div>
        </>
    );
}

MobileAppOfflinePage.layout = {
    breadcrumbs: [
        { title: 'Offline & sinkron', href: '/pratinjau/ponsel/offline' },
    ],
    title: 'Offline & sinkron',
    back: '/pratinjau/ponsel',
};
