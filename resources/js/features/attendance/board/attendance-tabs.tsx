import { usePage } from '@inertiajs/react';
import { TabNav } from '@/components/ui/tabs';
import type { RoleName } from '@/lib/roles';
import { hasAnyRole } from '@/lib/roles';
import { cn } from '@/lib/utils';

export type AttendanceTab =
    | 'today'
    | 'employees'
    | 'recap'
    | 'discipline'
    | 'payroll';

export const ATTENDANCE_TABS: {
    tab: AttendanceTab;
    label: string;
    href: string;
    /** Roles that see the tab; none = everyone who sees the module. */
    roles?: RoleName[];
}[] = [
    { tab: 'today', label: 'Hari ini', href: '/absensi/hari-ini' },
    {
        tab: 'employees',
        label: 'Absen pegawai',
        href: '/absensi/pegawai',
        // attendance.manage (AttendanceDayPolicy::manageDays)
        roles: ['super_admin', 'hr'],
    },
    { tab: 'recap', label: 'Rekap', href: '/absensi/rekap' },
    { tab: 'discipline', label: 'Kedisiplinan', href: '/absensi/kedisiplinan' },
    {
        tab: 'payroll',
        label: 'Gaji',
        href: '/absensi/gaji',
        // payroll.view (PayrollPolicy::viewAny)
        roles: ['super_admin', 'hr', 'direksi'],
    },
];

/** Tabs a person with these roles may open. */
export function attendanceTabsFor(roles: readonly string[]) {
    return ATTENDANCE_TABS.filter(
        (item) => !item.roles || hasAnyRole(roles, ...item.roles),
    );
}

/**
 * Absensi module tabs for HR, Direksi, Super Admin and team leads
 * (keputusan pemilik 6 Okt 2026): Hari ini · Rekap · Kedisiplinan, plus
 * Absen pegawai (HR, Super Admin) and Gaji (HR, Super Admin, Direksi;
 * keputusan pemilik 20 Okt 2026). Each tab is its own page (bookmarkable,
 * filters in the URL).
 */
export function AttendanceTabs({
    active,
    mobile = false,
    className,
}: {
    active: AttendanceTab;
    mobile?: boolean;
    className?: string;
}) {
    const { auth } = usePage().props;

    return (
        <TabNav
            label="Bagian absensi"
            items={attendanceTabsFor(auth.roles).map((item) => ({
                href: item.href,
                label: item.label,
                active: item.tab === active,
            }))}
            className={cn(
                mobile
                    ? '-mx-4 gap-6 px-4 [&>a]:min-h-11'
                    : '[&>a]:text-[17px]',
                className,
            )}
        />
    );
}
