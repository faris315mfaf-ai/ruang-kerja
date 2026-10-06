import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function AutomationWhatsappPage() {
    return (
        <>
            <Head title="WhatsApp" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 2" />
                <h1 className="text-display">WhatsApp</h1>
            </div>
        </>
    );
}

AutomationWhatsappPage.layout = {
    breadcrumbs: [{ title: 'WhatsApp', href: '/pengaturan/whatsapp' }],
    title: 'WhatsApp',
    back: '/menu',
};
