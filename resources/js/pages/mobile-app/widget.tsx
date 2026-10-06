import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function MobileAppWidgetPage() {
    return (
        <>
            <Head title="Widget" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 3" />
                <h1 className="text-display">Widget</h1>
            </div>
        </>
    );
}

MobileAppWidgetPage.layout = {
    breadcrumbs: [{ title: 'Widget', href: '/pratinjau/ponsel/widget' }],
    title: 'Widget',
    back: '/pratinjau/ponsel',
};
