import { Head } from '@inertiajs/react';

/**
 * Ruang HR › Jadwal (keputusan pemilik 20 Okt 2026). Placeholder page: the
 * screen itself is built by the frontend task (docs/fitur/ruang-hr.md).
 */
export default function HrSchedulePage() {
    return <Head title="Jadwal · Ruang HR" />;
}

HrSchedulePage.layout = {
    breadcrumbs: [{ title: 'Ruang HR', href: '/hr' }],
    title: 'Ruang HR',
};
