import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MobileAppDevicesPage() {
    return (
        <>
            <Head title="Perangkat saya" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 3" />
                <h1 className="text-display">Perangkat saya</h1>
            </div>
        </>
    );
}

MobileAppDevicesPage.layout = {
    breadcrumbs: [{ title: 'Perangkat saya', href: '/pengaturan/perangkat' }],
    title: 'Perangkat saya',
    back: '/menu',
};
