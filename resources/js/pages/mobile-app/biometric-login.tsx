import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MobileAppBiometricLoginPage() {
    return (
        <>
            <Head title="Masuk biometrik" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 3" />
                <h1 className="text-display">Masuk biometrik</h1>
            </div>
        </>
    );
}

MobileAppBiometricLoginPage.layout = {
    breadcrumbs: [
        { title: 'Masuk biometrik', href: '/pratinjau/ponsel/masuk' },
    ],
    title: 'Masuk biometrik',
    back: '/pratinjau/ponsel',
};
