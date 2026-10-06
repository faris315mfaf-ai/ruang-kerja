import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function OkrShowPage() {
    return (
        <>
            <Head title="Detail OKR" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 3" />
                <h1 className="text-display">Detail OKR</h1>
            </div>
        </>
    );
}

OkrShowPage.layout = {
    breadcrumbs: [{ title: 'Detail OKR', href: '/okr' }],
    title: 'Detail OKR',
    back: '/okr',
};
