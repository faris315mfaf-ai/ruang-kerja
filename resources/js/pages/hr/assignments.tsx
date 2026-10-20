import { Head } from '@inertiajs/react';

/**
 * Ruang HR › Penugasan (keputusan pemilik 20 Okt 2026). Placeholder page: the
 * screen itself is built by the frontend task (docs/fitur/ruang-hr.md).
 */
export default function HrAssignmentsPage() {
    return <Head title="Penugasan · Ruang HR" />;
}

HrAssignmentsPage.layout = {
    breadcrumbs: [
        { title: 'Ruang HR', href: '/hr' },
    ],
    title: 'Ruang HR',
};
