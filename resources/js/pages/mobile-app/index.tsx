import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MobileAppIndexPage() {
    return (
        <>
            <Head title="Aplikasi ponsel" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 3" />
                <h1 className="text-display">Aplikasi ponsel</h1>
            </div>
        </>
    );
}

MobileAppIndexPage.layout = {
    breadcrumbs: [{ title: 'Aplikasi ponsel', href: '/pratinjau/ponsel' }],
    title: 'Aplikasi ponsel',
    back: '/pratinjau',
};
