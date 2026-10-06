import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function NotesIndexPage() {
    return (
        <>
            <Head title="Catatan" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 2" />
                <h1 className="text-display">Catatan</h1>
            </div>
        </>
    );
}

NotesIndexPage.layout = {
    breadcrumbs: [{ title: 'Catatan', href: '/catatan' }],
    title: 'Catatan',
};
