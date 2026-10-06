import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MeetingsManagementSchedulePage() {
    return (
        <>
            <Head title="Jadwal & notulensi" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 2" />
                <h1 className="text-display">Jadwal & notulensi</h1>
            </div>
        </>
    );
}

MeetingsManagementSchedulePage.layout = {
    breadcrumbs: [{ title: 'Jadwal & notulensi', href: '/manajemen/jadwal' }],
    title: 'Jadwal & notulensi',
    back: '/manajemen',
};
