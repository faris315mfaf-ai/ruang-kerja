import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MeetingsMinutesPage() {
    return (
        <>
            <Head title="Notulen" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 2" />
                <h1 className="text-display">Notulen</h1>
            </div>
        </>
    );
}

MeetingsMinutesPage.layout = {
    breadcrumbs: [{ title: 'Notulen', href: '/rapat' }],
    title: 'Notulen',
    back: '/rapat',
};
