import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MobileAppFaceCheckInPage() {
    return (
        <>
            <Head title="Check-in wajah" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 3" />
                <h1 className="text-display">Check-in wajah</h1>
            </div>
        </>
    );
}

MobileAppFaceCheckInPage.layout = {
    breadcrumbs: [{ title: 'Check-in wajah', href: '/absensi/wajah' }],
    title: 'Check-in wajah',
    back: '/absensi',
};
