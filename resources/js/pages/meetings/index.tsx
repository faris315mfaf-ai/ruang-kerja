import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MeetingsIndexPage() {
    return (
        <>
            <Head title="Rapat" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 2" />
                <h1 className="text-display">Rapat</h1>
            </div>
        </>
    );
}

MeetingsIndexPage.layout = {
    breadcrumbs: [{ title: 'Rapat', href: '/rapat' }],
    title: 'Rapat',
};
