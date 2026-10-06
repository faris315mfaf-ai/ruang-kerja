import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MeetingsCreatePage() {
    return (
        <>
            <Head title="Jadwalkan rapat" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 2" />
                <h1 className="text-display">Jadwalkan rapat</h1>
            </div>
        </>
    );
}

MeetingsCreatePage.layout = {
    breadcrumbs: [{ title: 'Jadwalkan rapat', href: '/rapat/baru' }],
    title: 'Jadwalkan rapat',
    back: '/rapat',
};
