import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MeetingsCalendarPage() {
    return (
        <>
            <Head title="Kalender" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 2" />
                <h1 className="text-display">Kalender</h1>
            </div>
        </>
    );
}

MeetingsCalendarPage.layout = {
    breadcrumbs: [{ title: 'Kalender', href: '/kalender' }],
    title: 'Kalender',
};
