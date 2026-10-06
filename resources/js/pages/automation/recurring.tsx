import { Head } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';

// Placeholder created by the prototype scaffold; replaced by the module build.
export default function AutomationRecurringPage() {
    return (
        <>
            <Head title="Tugas berulang" />
            <div className="flex flex-col gap-4">
                <PrototypeBanner phase="Fase 2" />
                <h1 className="text-display">Tugas berulang</h1>
            </div>
        </>
    );
}

AutomationRecurringPage.layout = {
    breadcrumbs: [{ title: 'Tugas berulang', href: '/otomasi/berulang' }],
    title: 'Tugas berulang',
    back: '/otomasi',
};
