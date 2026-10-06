import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MeetingsShowPage() {
    return (
        <>
            <Head title="Detail rapat" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 2" />
                <h1 className="text-display">Detail rapat</h1>
            </div>
        </>
    );
}

MeetingsShowPage.layout = {
    breadcrumbs: [{ title: 'Detail rapat', href: '/rapat' }],
    title: 'Detail rapat',
    back: '/rapat',
};
