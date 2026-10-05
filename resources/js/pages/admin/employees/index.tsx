import { Head } from '@inertiajs/react';
import { EmployeesDesktop } from '@/features/employees/employees-desktop';
import { EmployeesMobile } from '@/features/employees/employees-mobile';
import type { EmployeeIndexProps } from '@/features/employees/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { index } from '@/routes/admin/employees';

/** Admin › Karyawan (HR & Super Admin manage; Direksi & Kepala Divisi read). */
export default function EmployeesIndex(props: EmployeeIndexProps) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title="Karyawan" />
            {breakpoint === 'mobile' ? (
                <EmployeesMobile {...props} />
            ) : (
                <EmployeesDesktop {...props} />
            )}
        </>
    );
}

EmployeesIndex.layout = {
    breadcrumbs: [
        { title: 'Admin', href: index() },
        { title: 'Karyawan', href: index() },
    ],
    title: 'Karyawan',
    back: '/menu',
};
