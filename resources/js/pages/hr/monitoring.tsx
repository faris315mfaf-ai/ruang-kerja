import { Head } from '@inertiajs/react';

/**
 * Ruang HR › Monitoring (keputusan pemilik 20 Okt 2026). Placeholder page: the
 * screen itself is built by the frontend task (docs/fitur/ruang-hr.md).
 */
export default function HrMonitoringPage() {
    return <Head title="Monitoring · Ruang HR" />;
}

HrMonitoringPage.layout = {
    breadcrumbs: [{ title: 'Ruang HR', href: '/hr' }],
    title: 'Ruang HR',
};
