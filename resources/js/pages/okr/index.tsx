import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function OkrIndexPage() {
    return (
        <>
            <Head title="OKR" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 3" />
                <h1 className="text-display">OKR</h1>
            </div>
        </>
    );
}

OkrIndexPage.layout = {
    breadcrumbs: [{ title: 'OKR', href: '/okr' }],
    title: 'OKR',
};
