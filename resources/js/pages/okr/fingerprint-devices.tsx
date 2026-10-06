import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function OkrFingerprintDevicesPage() {
    return (
        <>
            <Head title="Mesin absensi" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 3" />
                <h1 className="text-display">Mesin absensi</h1>
            </div>
        </>
    );
}

OkrFingerprintDevicesPage.layout = {
    breadcrumbs: [{ title: 'Mesin absensi', href: '/admin/mesin-absensi' }],
    title: 'Mesin absensi',
};
