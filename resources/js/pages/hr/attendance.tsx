import { Head } from '@inertiajs/react';

/**
 * Ruang HR › Absensi (keputusan pemilik 20 Okt 2026). Placeholder page: the
 * screen itself is built by the frontend task (docs/fitur/ruang-hr.md).
 */
export default function HrAttendancePage() {
    return <Head title="Absensi · Ruang HR" />;
}

HrAttendancePage.layout = {
    breadcrumbs: [{ title: 'Ruang HR', href: '/hr' }],
    title: 'Ruang HR',
};
