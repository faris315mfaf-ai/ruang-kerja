import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MobileAppLockScreenPage() {
    return (
        <>
            <Head title="Layar kunci" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 3" />
                <h1 className="text-display">Layar kunci</h1>
            </div>
        </>
    );
}

MobileAppLockScreenPage.layout = {
    breadcrumbs: [{ title: 'Layar kunci', href: '/pratinjau/ponsel/kunci' }],
    title: 'Layar kunci',
    back: '/pratinjau/ponsel',
};
