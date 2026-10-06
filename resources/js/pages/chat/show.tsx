import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function ChatShowPage() {
    return (
        <>
            <Head title="Obrolan" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 2" />
                <h1 className="text-display">Obrolan</h1>
            </div>
        </>
    );
}

ChatShowPage.layout = {
    breadcrumbs: [{ title: 'Obrolan', href: '/obrolan' }],
    title: 'Obrolan',
    back: '/obrolan',
};
