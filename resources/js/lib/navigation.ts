import type { LucideIcon } from 'lucide-react';
import {
    Building2,
    CheckCheck,
    CircleCheck,
    Clock,
    FileText,
    Home,
    Inbox,
    LayoutGrid,
    MapPin,
    ListChecks,
    Menu,
    Network,
    ScrollText,
    Users,
    WalletCards,
} from 'lucide-react';
import type { RoleName } from '@/lib/roles';
import { hasAnyRole } from '@/lib/roles';

export type AppNavItem = {
    title: string;
    href: string;
    icon: LucideIcon;
    /** Match nested routes too (e.g. /pengajuan/123). */
    matchPrefix?: boolean;
    /** Shared-prop counter shown as a badge. */
    badge?: 'approvals';
    /** Hidden from the mobile Menu tab (docs/PLATFORM.md §3, "—" on mobile). */
    desktopOnly?: boolean;
};

/** Desktop sidebar: main navigation (docs/DESIGN.md §5). */
export const mainNavItems: AppNavItem[] = [
    { title: 'Inbox', href: '/inbox', icon: Inbox, matchPrefix: true },
    {
        title: 'Tugas saya',
        href: '/tugas',
        icon: CircleCheck,
        matchPrefix: true,
    },
    { title: 'Dashboard', href: '/dashboard', icon: LayoutGrid },
    { title: 'Absensi', href: '/absensi', icon: MapPin, matchPrefix: true },
    {
        title: 'Pengajuan',
        href: '/pengajuan',
        icon: FileText,
        matchPrefix: true,
    },
    {
        title: 'Persetujuan',
        href: '/persetujuan',
        icon: CheckCheck,
        matchPrefix: true,
        badge: 'approvals',
    },
    {
        title: 'Struktur organisasi',
        href: '/organisasi/struktur',
        icon: Network,
        matchPrefix: true,
    },
];

/** Mobile bottom tab bar: exactly five items (docs/PLATFORM.md §2). */
export const tabNavItems: AppNavItem[] = [
    { title: 'Beranda', href: '/dashboard', icon: Home },
    { title: 'Absen', href: '/absensi', icon: MapPin, matchPrefix: true },
    { title: 'Tugas', href: '/tugas', icon: CircleCheck, matchPrefix: true },
    { title: 'Inbox', href: '/inbox', icon: Inbox, matchPrefix: true },
    { title: 'Menu', href: '/menu', icon: Menu },
];

/** Admin entries depend on global roles. */
export function adminNavItems(roles: readonly string[]): AppNavItem[] {
    const items: AppNavItem[] = [];

    if (hasAnyRole(roles, 'super_admin', 'hr')) {
        items.push({
            title: 'Karyawan',
            href: '/admin/karyawan',
            icon: Users,
            matchPrefix: true,
        });
    } else if (hasAnyRole(roles, 'kepala_divisi' satisfies RoleName)) {
        items.push({
            title: 'Anggota divisi',
            href: '/admin/karyawan',
            icon: Users,
            matchPrefix: true,
        });
    }

    if (hasAnyRole(roles, 'super_admin', 'hr')) {
        items.push({
            title: 'Organisasi',
            href: '/admin/organisasi',
            icon: Building2,
            matchPrefix: true,
            desktopOnly: true,
        });
    }

    if (hasAnyRole(roles, 'super_admin', 'hr')) {
        items.push({
            title: 'Lokasi & shift',
            href: '/admin/absensi',
            icon: Clock,
            matchPrefix: true,
            desktopOnly: true,
        });
    }

    if (hasAnyRole(roles, 'super_admin')) {
        items.push({
            title: 'Audit log',
            href: '/admin/audit',
            icon: ScrollText,
            matchPrefix: true,
            desktopOnly: true,
        });
    }

    if (hasAnyRole(roles, 'super_admin', 'hr')) {
        items.push(
            {
                title: 'Jenis pengajuan',
                href: '/admin/pengajuan',
                icon: ListChecks,
                matchPrefix: true,
                desktopOnly: true,
            },
            {
                title: 'Saldo cuti',
                href: '/admin/saldo-cuti',
                icon: WalletCards,
                matchPrefix: true,
                desktopOnly: true,
            },
        );
    }

    return items;
}

export function isActivePath(item: AppNavItem, currentPath: string): boolean {
    if (item.matchPrefix) {
        return (
            currentPath === item.href || currentPath.startsWith(`${item.href}/`)
        );
    }

    return currentPath === item.href;
}
