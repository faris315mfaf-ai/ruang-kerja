import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function OkrRoleDashboardPage() {
    return (
        <>
            <Head title="Dashboard peran" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 3" />
                <h1 className="text-display">Dashboard peran</h1>
            </div>
        </>
    );
}

OkrRoleDashboardPage.layout = {
    breadcrumbs: [{ title: 'Dashboard peran', href: '/pratinjau' }],
    title: 'Dashboard peran',
    back: '/pratinjau',
};
