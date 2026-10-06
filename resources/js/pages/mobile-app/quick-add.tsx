import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MobileAppQuickAddPage() {
    return (
        <>
            <Head title="Aksi cepat" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 3" />
                <h1 className="text-display">Aksi cepat</h1>
            </div>
        </>
    );
}

MobileAppQuickAddPage.layout = {
    breadcrumbs: [
        { title: 'Aksi cepat', href: '/pratinjau/ponsel/aksi-cepat' },
    ],
    title: 'Aksi cepat',
    back: '/pratinjau/ponsel',
};
