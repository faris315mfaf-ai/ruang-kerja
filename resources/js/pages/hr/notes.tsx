import { Head } from '@inertiajs/react';

/**
 * Ruang HR › Catatan (keputusan pemilik 20 Okt 2026). Placeholder page: the
 * screen itself is built by the frontend task (docs/fitur/ruang-hr.md).
 */
export default function HrNotesPage() {
    return <Head title="Catatan · Ruang HR" />;
}

HrNotesPage.layout = {
    breadcrumbs: [{ title: 'Ruang HR', href: '/hr' }],
    title: 'Ruang HR',
};
